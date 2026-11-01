import { skillKey } from './skills.js';

export const MIN_SKILL_HOURS = 4;

const MIN_COMPLETION = 0.7;
const WEEKS_TO_CHECK = 2;
const WORKLOAD_FACTOR = 0.75;
const LOW_SCORE = 3;
const HIGH_SCORE = 4;
const HIGH_SCORES_TO_FINISH = 2;
const PRACTICE_HOURS = 2;

// Keeps the highest gaps that fit the available hours. The rest are deferred.
export function selectSkills(gaps, totalHours) {
  const open = gaps.filter((gap) => gap.gap > 0);
  const limit = Math.max(1, Math.floor(totalHours / MIN_SKILL_HOURS));
  return { selected: open.slice(0, limit), deferred: open.slice(limit) };
}

// Keeps gap priority, except that a skill always comes after the skills it requires.
export function orderByPrerequisites(skills, dependencies) {
  const requiresByKey = new Map(
    dependencies.map(({ skill, requires }) => [skillKey(skill), requires.map(skillKey)]),
  );
  const byKey = new Map(skills.map((skill) => [skill.key, skill]));
  const visited = new Set();
  const ordered = [];

  function visit(key) {
    if (visited.has(key) || !byKey.has(key)) return;
    visited.add(key);
    (requiresByKey.get(key) ?? []).forEach(visit);
    ordered.push(byKey.get(key));
  }

  skills.forEach((skill) => visit(skill.key));
  return ordered;
}

// Gives each skill the minimum hours, then shares the rest in proportion to its gap.
function allocateHours(skills, totalHours) {
  if (skills.length === 1) return [totalHours];

  const spare = totalHours - skills.length * MIN_SKILL_HOURS;
  const totalGap = skills.reduce((sum, skill) => sum + skill.gap, 0);
  const shares = skills.map((skill) => (spare * skill.gap) / totalGap);
  const hours = shares.map((share) => MIN_SKILL_HOURS + Math.floor(share));

  let leftover = totalHours - hours.reduce((sum, value) => sum + value, 0);
  const byLargestRemainder = shares
    .map((share, index) => ({ index, remainder: share - Math.floor(share) }))
    .sort((a, b) => b.remainder - a.remainder);

  for (const { index } of byLargestRemainder) {
    if (leftover-- <= 0) break;
    hours[index]++;
  }
  return hours;
}

// Splits the ordered skills into weeks that each use exactly hoursPerWeek.
export function buildSchedule(skills, hoursPerWeek, timelineWeeks) {
  const totalHours = hoursPerWeek * timelineWeeks;
  const hours = allocateHours(skills, totalHours);
  const weeks = [];
  let skillIndex = 0;
  let remaining = hours[0];

  for (let week = 1; week <= timelineWeeks; week++) {
    const blocks = [];
    let capacity = hoursPerWeek;

    while (capacity > 0 && skillIndex < skills.length) {
      const blockHours = Math.min(capacity, remaining);
      blocks.push({ skill: skills[skillIndex].name, hours: blockHours });
      capacity -= blockHours;
      remaining -= blockHours;
      if (remaining === 0) remaining = hours[++skillIndex];
    }
    weeks.push({ week, blocks });
  }
  return weeks;
}

export const searchUrl = (skill, title) =>
  `https://www.google.com/search?q=${encodeURIComponent(`${skill} ${title} tutorial`)}`;

const sumHours = (tasks) => tasks.reduce((sum, task) => sum + task.hours, 0);

const weekTheme = (tasks) => [...new Set(tasks.map((task) => task.skill))].join(' and ');

// Lays open tasks out from startWeek, around any tasks already done in those weeks.
function packTasks(open, doneByWeek, hoursPerWeek, startWeek) {
  const queue = [...open];
  const pending = new Map(doneByWeek);
  const weeks = [];

  for (let week = startWeek; queue.length > 0 || [...pending.keys()].some((key) => key >= week); week++) {
    const done = pending.get(week) ?? [];
    pending.delete(week);
    const tasks = [...done];
    let capacity = hoursPerWeek - sumHours(done);

    while (queue.length > 0 && capacity > 0) {
      const task = queue[0];
      if (task.hours <= capacity) {
        tasks.push(queue.shift());
        capacity -= task.hours;
      } else {
        const { _id, ...rest } = task;
        tasks.push({ ...task, hours: capacity });
        const title = task.title.endsWith('(continued)') ? task.title : `${task.title} (continued)`;
        queue[0] = { ...rest, title, hours: task.hours - capacity };
        capacity = 0;
      }
    }
    weeks.push({ week, theme: weekTheme(tasks), tasks });
  }
  return weeks;
}

// Applies the plan adjustment rules. Returns null when nothing needs to change.
export function applyPlanRules(plan, scores) {
  const changes = [];
  const allTasks = plan.weeks.flatMap((week) => week.tasks.map((task) => ({ ...task, week: week.week })));
  let open = allTasks.filter((task) => !task.done);

  const overdue = sumHours(open.filter((task) => task.week < plan.currentWeek));
  if (overdue > 0) changes.push(`${overdue} unfinished hours moved forward.`);

  for (const [key, { name, overall }] of scores) {
    const highScores = overall.filter((score) => score >= HIGH_SCORE).length;
    const latest = overall.at(-1);

    if (highScores >= HIGH_SCORES_TO_FINISH) {
      const removed = open.filter((task) => skillKey(task.skill) === key);
      if (removed.length > 0) {
        open = open.filter((task) => skillKey(task.skill) !== key);
        changes.push(
          `${name} removed (${sumHours(removed)} hours saved): you scored ${HIGH_SCORE} or above ${highScores} times.`,
        );
      }
    } else if (
      latest < LOW_SCORE &&
      !allTasks.some(
        (task) => task.isPractice && skillKey(task.skill) === key && task.forScoreCount === overall.length,
      )
    ) {
      const title = `Practice: ${name}`;
      open.unshift({
        title,
        description: `Your last mock interview score for ${name} was ${latest} out of 5. Review the feedback, then answer a similar question out loud.`,
        skill: name,
        hours: PRACTICE_HOURS,
        resourceUrl: searchUrl(name, 'interview questions'),
        done: false,
        isPractice: true,
        forScoreCount: overall.length,
      });
      changes.push(`${PRACTICE_HOURS} hours of ${name} practice added: your last interview score was ${latest}.`);
    }
  }

  let { hoursPerWeek, lastWorkloadCutWeek } = plan;
  const recent = plan.weekLog.slice(-WEEKS_TO_CHECK);
  const behind =
    recent.length === WEEKS_TO_CHECK &&
    recent.every(({ plannedHours, doneHours }) => plannedHours > 0 && doneHours / plannedHours < MIN_COMPLETION);

  if (behind && hoursPerWeek > 1 && plan.currentWeek - lastWorkloadCutWeek >= WEEKS_TO_CHECK) {
    const reduced = Math.max(1, Math.floor(hoursPerWeek * WORKLOAD_FACTOR));
    changes.push(
      `Workload reduced from ${hoursPerWeek} to ${reduced} hours a week, because under ${MIN_COMPLETION * 100}% was completed for ${WEEKS_TO_CHECK} weeks. The timeline was extended to fit.`,
    );
    hoursPerWeek = reduced;
    lastWorkloadCutWeek = plan.currentWeek;
  }

  if (changes.length === 0) return null;

  const pastWeeks = plan.weeks
    .filter(({ week }) => week < plan.currentWeek)
    .map((week) => {
      const tasks = week.tasks.filter((task) => task.done);
      return { ...week, tasks, theme: tasks.length > 0 ? week.theme : '' };
    });

  const doneByWeek = new Map(
    plan.weeks
      .filter(({ week }) => week >= plan.currentWeek)
      .map(({ week, tasks }) => [week, tasks.filter((task) => task.done)])
      .filter(([, tasks]) => tasks.length > 0),
  );

  const stripWeek = ({ week, ...task }) => task;
  const upcoming = packTasks(open.map(stripWeek), doneByWeek, hoursPerWeek, plan.currentWeek);

  return { weeks: [...pastWeeks, ...upcoming], hoursPerWeek, lastWorkloadCutWeek, changes };
}

function splitHours(hours, count) {
  const base = Math.floor(hours / count);
  return Array.from({ length: count }, (_, index) => base + (index < hours % count ? 1 : 0));
}

// Adds Gemini's wording to the schedule. Weeks, skills and hours always come from the schedule.
export function mergePlanText(schedule, planText) {
  const textByWeek = new Map(planText.weeks.map((week) => [week.week, week]));

  return schedule.map(({ week, blocks }) => {
    const text = textByWeek.get(week);
    const tasks = blocks.flatMap(({ skill, hours }) => {
      const written = text?.blocks.find((block) => skillKey(block.skill) === skillKey(skill))?.tasks ?? [];
      const fallback = { title: `Study ${skill}`, description: `Work through a practical introduction to ${skill}.` };
      const chosen = (written.length ? written : [fallback]).slice(0, hours);
      const taskHours = splitHours(hours, chosen.length);

      return chosen.map((task, index) => ({
        ...task,
        skill,
        hours: taskHours[index],
        resourceUrl: searchUrl(skill, task.title),
      }));
    });

    return { week, theme: text?.theme || blocks.map((block) => block.skill).join(' and '), tasks };
  });
}
