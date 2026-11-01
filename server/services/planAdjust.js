import Interview from '../models/Interview.js';
import Plan from '../models/Plan.js';
import UserSkill from '../models/UserSkill.js';
import { applyPlanRules } from './planRules.js';
import { skillKey } from './skills.js';

const TASK_COMPLETE_PROFICIENCY = 0.65;

export const latestPlan = (userId) => Plan.findOne({ user: userId }).sort({ version: -1 });

async function loadScores(userId) {
  const interviews = await Interview.find({ user: userId }).sort({ createdAt: 1 }).lean();
  const answered = interviews
    .flatMap((interview) => interview.questions)
    .filter((question) => question.answeredAt)
    .sort((a, b) => a.answeredAt - b.answeredAt);

  const scores = new Map();
  for (const { skill, overall } of answered) {
    const key = skillKey(skill);
    if (!scores.has(key)) scores.set(key, { name: skill, overall: [] });
    scores.get(key).overall.push(overall);
  }
  return scores;
}

// Runs the plan rules and saves a new plan version when they change something.
export async function adjustPlan(plan) {
  const source = plan.toObject();
  const adjusted = applyPlanRules(source, await loadScores(plan.user));
  if (!adjusted) return null;

  const { _id, createdAt, updatedAt, __v, ...rest } = source;
  return Plan.create({
    ...rest,
    ...adjusted,
    version: source.version + 1,
    reason: 'Adjusted to your progress',
  });
}

// Undoes the last finished week as a new version, keeping the task ticks made since then.
export async function restoreLastWeek(plan) {
  const finishedWeeks = plan.weekLog.length;
  const history = await Plan.find({ user: plan.user, version: { $lte: plan.version } })
    .sort({ version: -1 })
    .lean();

  // Finishing a week edits the version it finishes, so the oldest version with
  // this many finished weeks still holds the week as it was. Versions from an
  // earlier restore are skipped, because they no longer count.
  let before = history[0];
  for (const version of history) {
    if (version.undone) continue;
    if (version.weekLog.length !== finishedWeeks) break;
    before = version;
  }

  const current = plan.toObject();
  const currentById = new Map(
    current.weeks.flatMap((week) => week.tasks).map((task) => [String(task._id), task]),
  );
  const { week } = before.weekLog.at(-1);

  // Ticks the user made are kept. Ticks made by finishing this week are undone with it.
  const restoreTask = (task) => {
    const latest = currentById.get(String(task._id)) ?? task;
    return latest.completedByFinish === week
      ? { ...task, done: false, completedByFinish: undefined }
      : { ...task, done: latest.done };
  };

  const restored = {
    weeks: before.weeks.map((item) => ({ ...item, tasks: item.tasks.map(restoreTask) })),
    currentWeek: week,
    weekLog: before.weekLog.slice(0, -1),
    hoursPerWeek: before.hoursPerWeek,
    lastWorkloadCutWeek: before.lastWorkloadCutWeek,
    deferredSkills: before.deferredSkills,
    targetRole: before.targetRole,
  };

  const adjusted = applyPlanRules(restored, await loadScores(plan.user));
  const summary = `Week ${week} restored, with its tasks and hours back in place.`;

  const created = await Plan.create({
    ...restored,
    ...adjusted,
    user: plan.user,
    version: plan.version + 1,
    reason: `Week ${week} restored`,
    changes: [summary, ...(adjusted?.changes ?? [])],
  });

  await Plan.updateMany(
    { user: plan.user, version: { $gte: before.version, $lte: plan.version } },
    { $set: { undone: true } },
  );
  return created;
}

export async function recordInterviewScore(userId, skill, overall) {
  const key = skillKey(skill);
  const existing = await UserSkill.findOne({ user: userId, key }).lean();
  const proficiency = ((existing?.proficiency ?? 0) + overall / 5) / 2;
  await UserSkill.updateOne(
    { user: userId, key },
    { $set: { name: skill, proficiency, source: 'interview' } },
    { upsert: true },
  );
}

// Finishing every task for a skill shows at least working knowledge of it.
export async function recordTaskProgress(plan, task) {
  const key = skillKey(task.skill);
  const finished = plan.weeks
    .flatMap((week) => week.tasks)
    .filter((item) => skillKey(item.skill) === key)
    .every((item) => item.done);
  if (!finished) return;

  const existing = await UserSkill.findOne({ user: plan.user, key }).lean();
  if ((existing?.proficiency ?? 0) >= TASK_COMPLETE_PROFICIENCY) return;
  await UserSkill.updateOne(
    { user: plan.user, key },
    { $set: { name: task.skill, proficiency: TASK_COMPLETE_PROFICIENCY, source: 'task' } },
    { upsert: true },
  );
}
