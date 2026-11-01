import { z } from 'zod';
import Plan from '../models/Plan.js';
import { document, planTextPrompt, prerequisitesPrompt } from '../prompts/index.js';
import { FAST_MODEL, generateJson, SMART_MODEL } from '../services/gemini.js';
import { adjustPlan, latestPlan, recordTaskProgress, restoreLastWeek } from '../services/planAdjust.js';
import { buildSchedule, mergePlanText, orderByPrerequisites, selectSkills } from '../services/planRules.js';
import { HttpError } from '../utils/httpError.js';
import { loadGaps } from './gaps.js';

const taskInput = z.object({ done: z.boolean() });
const finishInput = z.object({ completeAll: z.boolean().optional() });

export async function getPlan(req, res) {
  res.json(await latestPlan(req.user._id));
}

export async function generatePlan(req, res) {
  const { targetRole, hoursPerWeek, timelineWeeks, resume } = req.user;
  if (!targetRole) throw new HttpError(400, 'Set your target role first.');

  const gaps = await loadGaps(req.user);
  const { selected, deferred } = selectSkills(gaps, hoursPerWeek * timelineWeeks);
  if (selected.length === 0) throw new HttpError(400, 'Add job descriptions first, so there are gaps to plan for.');

  const { dependencies } = await generateJson({
    model: FAST_MODEL,
    system: prerequisitesPrompt.system,
    schema: prerequisitesPrompt.schema,
    parts: [{ text: `Skills: ${JSON.stringify(selected.map((skill) => skill.name))}` }],
  });

  const ordered = orderByPrerequisites(selected, dependencies);
  const schedule = buildSchedule(ordered, hoursPerWeek, timelineWeeks);

  const planText = await generateJson({
    model: SMART_MODEL,
    system: planTextPrompt.system,
    schema: planTextPrompt.schema,
    parts: [
      {
        text: [
          `Target role: ${targetRole}`,
          `Background: ${document(resume?.summary || 'Not provided')}`,
          `Schedule: ${JSON.stringify(schedule)}`,
        ].join('\n'),
      },
    ],
  });

  const previous = await latestPlan(req.user._id);
  const plan = await Plan.create({
    user: req.user._id,
    version: (previous?.version ?? 0) + 1,
    reason: previous ? 'Regenerated from the latest skill gaps' : 'First plan',
    targetRole,
    hoursPerWeek,
    weeks: mergePlanText(schedule, planText),
    deferredSkills: deferred.map((skill) => skill.name),
  });

  res.status(201).json(plan);
}

export async function updateTask(req, res) {
  const { done } = taskInput.parse(req.body);
  const plan = await latestPlan(req.user._id);
  const task = plan?.weeks.flatMap((week) => week.tasks).find((item) => item._id.equals(req.params.id));
  if (!task) throw new HttpError(404, 'Task not found.');

  task.done = done;
  await plan.save();
  if (done) await recordTaskProgress(plan, task);
  res.json(plan);
}

// Ends the current week, then lets the plan rules react to what was completed.
export async function checkIn(req, res) {
  const { completeAll } = finishInput.parse(req.body ?? {});
  const plan = await latestPlan(req.user._id);
  if (!plan) throw new HttpError(404, 'Build a plan first.');

  const tasks = plan.weeks.find((week) => week.week === plan.currentWeek)?.tasks ?? [];
  const remaining = plan.weeks.flatMap((week) => week.tasks).filter((task) => !task.done);
  if (remaining.length === 0) throw new HttpError(400, 'Every task is finished. Well done!');

  const unticked = tasks.filter((task) => !task.done);
  if (completeAll) {
    for (const task of unticked) {
      task.done = true;
      task.completedByFinish = plan.currentWeek;
    }
  }

  plan.weekLog.push({
    week: plan.currentWeek,
    plannedHours: tasks.reduce((sum, task) => sum + task.hours, 0),
    doneHours: tasks.reduce((sum, task) => sum + (task.done ? task.hours : 0), 0),
    moved: completeAll ? [] : unticked.map(({ title, skill, hours }) => ({ title, skill, hours })),
  });
  plan.currentWeek += 1;
  await plan.save();

  if (completeAll) {
    for (const task of unticked) await recordTaskProgress(plan, task);
  }

  res.json((await adjustPlan(plan)) ?? plan);
}

export async function restoreWeek(req, res) {
  const plan = await latestPlan(req.user._id);
  if (!plan || plan.weekLog.length === 0) throw new HttpError(400, 'There is no finished week to restore.');
  res.json(await restoreLastWeek(plan));
}
