import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeGaps } from '../services/gapScore.js';
import {
  applyPlanRules,
  buildSchedule,
  mergePlanText,
  orderByPrerequisites,
  selectSkills,
} from '../services/planRules.js';
import { applyRubric } from '../services/rubric.js';
import { quoteExists, skillKey, verifyEvidence } from '../services/skills.js';
import { computeInsights, responseRate } from '../services/trackerStats.js';

describe('applyPlanRules', () => {
  const task = (title, skill, hours, done = false) => ({ _id: title, title, skill, hours, done });
  const plan = (overrides = {}) => ({
    hoursPerWeek: 4,
    currentWeek: 1,
    lastWorkloadCutWeek: 0,
    weekLog: [],
    weeks: [
      { week: 1, theme: 'SQL', tasks: [task('a', 'SQL', 4)] },
      { week: 2, theme: 'SQL', tasks: [task('b', 'SQL', 4)] },
      { week: 3, theme: 'Python', tasks: [task('c', 'Python', 4)] },
    ],
    ...overrides,
  });
  const openHours = (weeks) =>
    weeks.flatMap((week) => week.tasks).reduce((sum, item) => sum + (item.done ? 0 : item.hours), 0);
  const noScores = new Map();

  it('changes nothing when the user is on track', () => {
    assert.equal(applyPlanRules(plan(), noScores), null);
  });

  it('adds practice after a low score, only once per score', () => {
    const scores = new Map([['sql', { name: 'SQL', overall: [2] }]]);
    const result = applyPlanRules(plan(), scores);
    assert.equal(result.weeks[0].tasks[0].title, 'Practice: SQL');
    assert.equal(openHours(result.weeks), 14);
    assert.match(result.changes[0], /practice added/);

    const again = applyPlanRules({ ...plan(), weeks: result.weeks }, scores);
    assert.equal(again, null);
  });

  it('removes remaining tasks after two high scores', () => {
    const scores = new Map([['sql', { name: 'SQL', overall: [4, 2, 4.5] }]]);
    const result = applyPlanRules(plan(), scores);
    const skills = result.weeks.flatMap((week) => week.tasks).map((item) => item.skill);
    assert.deepEqual(skills, ['Python']);
    assert.match(result.changes[0], /SQL removed \(8 hours saved\)/);
  });

  it('keeps tasks after only one high score', () => {
    assert.equal(applyPlanRules(plan(), new Map([['sql', { name: 'SQL', overall: [4.5] }]])), null);
  });

  it('cuts the workload after two weak weeks and keeps every open hour', () => {
    const result = applyPlanRules(
      plan({
        currentWeek: 3,
        weekLog: [
          { week: 1, plannedHours: 4, doneHours: 1 },
          { week: 2, plannedHours: 4, doneHours: 2 },
        ],
      }),
      noScores,
    );
    assert.equal(result.hoursPerWeek, 3);
    assert.equal(result.lastWorkloadCutWeek, 3);
    assert.equal(openHours(result.weeks), 12);
    for (const week of result.weeks.filter((item) => item.week >= 3)) {
      assert.ok(week.tasks.reduce((sum, item) => sum + item.hours, 0) <= 3);
    }
    assert.ok(result.weeks.length > 3);
  });

  it('does not cut after a single weak week or straight after a cut', () => {
    const weak = { plannedHours: 4, doneHours: 1 };
    const single = plan({ currentWeek: 2, weeks: plan().weeks.slice(1), weekLog: [{ week: 1, ...weak }] });
    assert.equal(applyPlanRules(single, noScores), null);

    const justCut = plan({
      currentWeek: 3,
      lastWorkloadCutWeek: 2,
      weeks: plan().weeks.slice(2),
      weekLog: [{ week: 1, ...weak }, { week: 2, ...weak }],
    });
    assert.equal(applyPlanRules(justCut, noScores), null);
  });

  it('moves unfinished work forward and keeps finished work in place', () => {
    const result = applyPlanRules(
      plan({
        currentWeek: 2,
        weeks: [
          { week: 1, theme: 'SQL', tasks: [task('done', 'SQL', 2, true), task('late', 'SQL', 2)] },
          { week: 2, theme: 'SQL', tasks: [task('b', 'SQL', 4)] },
        ],
      }),
      noScores,
    );
    assert.deepEqual(result.weeks[0].tasks.map((item) => item.title), ['done']);
    assert.equal(result.weeks[1].tasks[0].title, 'late');
    assert.equal(openHours(result.weeks), 6);
    assert.match(result.changes[0], /2 unfinished hours/);
  });
});

describe('applyRubric', () => {
  const raw = (score, quote = 'used a pivot table') =>
    ['relevance', 'depth', 'structure', 'evidence', 'communication'].map((criterion) => ({
      criterion,
      score,
      quote,
      feedback: 'f',
    }));

  it('averages verified scores', () => {
    const { overall, scores } = applyRubric(raw(4), 'I used a pivot table to do it');
    assert.equal(overall, 4);
    assert.ok(scores.every((item) => item.verified));
  });

  it('caps scores whose quote is not in the answer', () => {
    const { overall, scores } = applyRubric(raw(5, 'invented words'), 'I used a pivot table');
    assert.equal(overall, 2);
    assert.equal(scores[0].quote, '');
    assert.equal(scores[0].verified, false);
  });

  it('gives the lowest score to a missing criterion', () => {
    const { scores } = applyRubric(raw(5).slice(1), 'used a pivot table');
    assert.equal(scores[0].criterion, 'relevance');
    assert.equal(scores[0].score, 1);
  });
});

describe('computeInsights', () => {
  const apps = (roleType, count, responses) =>
    Array.from({ length: count }, (_, index) => ({
      roleType,
      seniority: 'entry',
      industry: 'Retail',
      source: 'Board',
      resumeVersion: 'Main',
      status: index < responses ? 'interview' : 'no_response',
    }));

  it('smooths the response rate', () => {
    assert.equal(responseRate(1, 1), 2 / 3);
    assert.equal(responseRate(0, 0), 0.5);
  });

  it('does not recommend from a small sample', () => {
    const insights = computeInsights([...apps('Lucky', 2, 2), ...apps('Other', 20, 2)]);
    assert.ok(!insights.recommendations.some((item) => item.text.includes('Lucky')));
  });

  it('recommends the strong group and warns about the weak one', () => {
    const insights = computeInsights([...apps('Strong', 8, 6), ...apps('Weak', 12, 0), ...apps('Mid', 10, 3)]);
    assert.equal(insights.recommendations[0].type, 'focus');
    assert.match(insights.recommendations[0].text, /Strong/);
    assert.ok(insights.recommendations.some((item) => item.type === 'avoid' && item.text.includes('Weak')));
  });

  it('counts a rejection as no response', () => {
    const insights = computeInsights([{ ...apps('A', 1, 0)[0], status: 'rejected' }]);
    assert.equal(insights.responses, 0);
  });
});

describe('skills', () => {
  it('merges common aliases', () => {
    assert.equal(skillKey('JS'), skillKey('JavaScript'));
    assert.equal(skillKey(' MS  Excel '), 'excel');
  });

  it('matches quotes despite case, spacing and curly punctuation', () => {
    assert.ok(quoteExists('it’s STRONG   sql', "It's strong\nSQL skills"));
    assert.ok(!quoteExists('Rust', 'Strong SQL skills'));
    assert.ok(!quoteExists('   ', 'Strong SQL skills'));
  });

  it('accepts shortened quotes only when every part is there, in order', () => {
    const answer = 'First I cleaned the data. Then I compared cohorts. Finally I presented it.';
    assert.ok(quoteExists('"First I cleaned ... Finally I presented"', answer));
    assert.ok(quoteExists('Then I compared…presented it', answer));
    assert.ok(!quoteExists('Finally I presented ... First I cleaned', answer));
    assert.ok(!quoteExists('First I cleaned ... invented words', answer));
    assert.ok(!quoteExists('...', answer));
  });

  it('drops invented quotes and merges duplicates', () => {
    const { skills, dropped } = verifyEvidence(
      [
        { name: 'JS', importance: 'required', quote: 'JavaScript required' },
        { name: 'JavaScript', importance: 'nice', quote: 'JavaScript required' },
        { name: 'Rust', importance: 'required', quote: 'Rust required' },
      ],
      'JavaScript required for this role',
    );
    assert.deepEqual(skills.map((skill) => skill.key), ['javascript']);
    assert.equal(dropped, 1);
  });
});

describe('computeGaps', () => {
  const skill = (key, importance) => ({ key, name: key, importance, quote: 'q' });
  const jobs = [
    { _id: 1, title: 'A', skills: [skill('sql', 'required'), skill('python', 'preferred')] },
    { _id: 2, title: 'B', skills: [skill('sql', 'required')] },
  ];

  it('applies the gap formula', () => {
    const gaps = computeGaps(jobs, [{ key: 'sql', proficiency: 0.5 }]);
    const sql = gaps.find((gap) => gap.key === 'sql');
    const python = gaps.find((gap) => gap.key === 'python');
    assert.equal(sql.gap, 0.5);
    assert.equal(python.gap, 0.35);
  });

  it('groups gaps into high, medium and low priority', () => {
    const job = (id, keys) => ({ _id: id, title: 't', skills: keys.map((key) => skill(key, 'required')) });
    const gaps = computeGaps(
      [job(1, ['a', 'b', 'c', 'd']), job(2, ['a', 'c']), job(3, ['a']), job(4, ['a']), job(5, ['a'])],
      [{ key: 'c', proficiency: 0.5 }],
    );
    const priority = (key) => gaps.find((gap) => gap.key === key).priority;

    assert.equal(priority('a'), 'high');
    assert.equal(priority('b'), 'medium');
    assert.equal(priority('c'), 'medium');
    assert.equal(computeGaps([job(1, ['a'])], [{ key: 'a', proficiency: 0.9 }])[0].priority, 'low');
  });

  it('sorts the biggest gap first and keeps every quote', () => {
    const [first] = computeGaps(jobs, []);
    assert.equal(first.key, 'sql');
    assert.equal(first.evidence.length, 2);
  });
});

describe('plan rules', () => {
  const gaps = [
    { key: 'tableau', name: 'Tableau', gap: 0.6 },
    { key: 'sql', name: 'SQL', gap: 0.5 },
    { key: 'python', name: 'Python', gap: 0.2 },
    { key: 'excel', name: 'Excel', gap: 0 },
  ];

  it('defers skills that do not fit and ignores closed gaps', () => {
    const { selected, deferred } = selectSkills(gaps, 8);
    assert.deepEqual(selected.map((gap) => gap.key), ['tableau', 'sql']);
    assert.deepEqual(deferred.map((gap) => gap.key), ['python']);
  });

  it('puts prerequisites first', () => {
    const ordered = orderByPrerequisites(gaps.slice(0, 3), [{ skill: 'Tableau', requires: ['SQL'] }]);
    assert.deepEqual(ordered.map((gap) => gap.key), ['sql', 'tableau', 'python']);
  });

  it('survives circular prerequisites and unknown skills', () => {
    const ordered = orderByPrerequisites(gaps.slice(0, 2), [
      { skill: 'Tableau', requires: ['SQL', 'Cobol'] },
      { skill: 'SQL', requires: ['Tableau'] },
    ]);
    assert.equal(ordered.length, 2);
  });

  it('fills every week with exactly the available hours', () => {
    for (const [hoursPerWeek, timelineWeeks] of [[8, 12], [3, 5], [1, 4], [40, 1], [7, 9]]) {
      const { selected } = selectSkills(gaps, hoursPerWeek * timelineWeeks);
      const schedule = buildSchedule(selected, hoursPerWeek, timelineWeeks);
      assert.equal(schedule.length, timelineWeeks);
      for (const { blocks } of schedule) {
        assert.equal(blocks.reduce((sum, block) => sum + block.hours, 0), hoursPerWeek);
      }
    }
  });

  it('keeps scheduled hours and fills in anything Gemini left out', () => {
    const schedule = [{ week: 1, blocks: [{ skill: 'SQL', hours: 5 }, { skill: 'Python', hours: 3 }] }];
    const planText = {
      weeks: [
        {
          week: 1,
          theme: 'Foundations',
          blocks: [{ skill: 'sql', tasks: [{ title: 'Joins', description: 'd' }, { title: 'Grouping', description: 'd' }] }],
        },
      ],
    };
    const [week] = mergePlanText(schedule, planText);
    assert.equal(week.theme, 'Foundations');
    assert.deepEqual(week.tasks.map((task) => task.hours), [3, 2, 3]);
    assert.equal(week.tasks[2].title, 'Study Python');
  });
});
