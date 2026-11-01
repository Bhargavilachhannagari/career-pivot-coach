import { z } from 'zod';
import Interview from '../models/Interview.js';
import JobDescription from '../models/JobDescription.js';
import { answerScoringPrompt, document, questionsPrompt } from '../prompts/index.js';
import { generateJson, SMART_MODEL } from '../services/gemini.js';
import { adjustPlan, latestPlan, recordInterviewScore } from '../services/planAdjust.js';
import { applyRubric, RUBRIC, rubricText } from '../services/rubric.js';
import { roleKey, skillKey } from '../services/skills.js';
import { HttpError } from '../utils/httpError.js';
import { loadGaps } from './gaps.js';

const QUESTIONS_PER_INTERVIEW = 4;
const QUESTIONS_PER_FOCUSED_INTERVIEW = 3;
const JOBS_FOR_CONTEXT = 3;
const JOB_EXCERPT_LENGTH = 1500;

const startInput = z.object({
  skill: z.string().trim().min(1).max(100).optional(),
  week: z.number().int().min(1).optional(),
});

const answerInput = z.object({
  questionId: z.string(),
  answer: z.string().trim().min(1, 'Write an answer first').max(5000),
  spoken: z.boolean().optional(),
});

// Finds what the person studied for a skill, so the questions can follow on from it.
async function loadFocus(userId, skill, week) {
  const plan = await latestPlan(userId);
  const tasks = (plan?.weeks ?? [])
    .filter((item) => !week || item.week === week)
    .flatMap((item) => item.tasks)
    .filter((task) => skillKey(task.skill) === skillKey(skill));
  if (tasks.length === 0) throw new HttpError(400, 'That skill is not in your plan.');
  return { name: tasks[0].skill, topics: tasks.map((task) => task.title) };
}

export function getRubric(req, res) {
  res.json(RUBRIC);
}

export async function listInterviews(req, res) {
  res.json(await Interview.find({ user: req.user._id }).sort({ createdAt: -1 }).lean());
}

export async function getInterview(req, res) {
  const interview = await Interview.findOne({ _id: req.params.id, user: req.user._id }).lean();
  if (!interview) throw new HttpError(404, 'Interview not found.');
  res.json(interview);
}

export async function startInterview(req, res) {
  const { skill: focusSkill, week: focusWeek } = startInput.parse(req.body ?? {});
  const { targetRole } = req.user;
  const focus = focusSkill ? await loadFocus(req.user._id, focusSkill, focusWeek) : null;
  const [gaps, jobs, past] = await Promise.all([
    loadGaps(req.user),
    JobDescription.find({ user: req.user._id, roleKey: roleKey(targetRole), isEstimate: { $ne: true } })
      .limit(JOBS_FOR_CONTEXT)
      .lean(),
    Interview.find({ user: req.user._id }).select('questions.text').lean(),
  ]);

  const limit = focus ? QUESTIONS_PER_FOCUSED_INTERVIEW : QUESTIONS_PER_INTERVIEW;
  const skills = focus
    ? Array(limit).fill({ key: skillKey(focus.name), name: focus.name })
    : gaps.slice(0, limit);
  if (skills.length === 0) throw new HttpError(400, 'Add job descriptions first, so questions can match them.');

  const { questions } = await generateJson({
    model: SMART_MODEL,
    system: questionsPrompt.system,
    schema: questionsPrompt.schema,
    parts: [
      {
        text: [
          `Target role: ${targetRole || 'Not set'}`,
          `Skills, one question each: ${JSON.stringify(skills.map((skill) => skill.name))}`,
          ...(focus ? [`Base the questions on what they just studied: ${JSON.stringify(focus.topics)}`] : []),
          `Job descriptions: ${document(jobs.map((job) => job.text.slice(0, JOB_EXCERPT_LENGTH)).join('\n---\n'))}`,
          `Previous questions: ${JSON.stringify(past.flatMap((item) => item.questions.map((q) => q.text)))}`,
        ].join('\n'),
      },
    ],
  });

  const namesByKey = new Map(skills.map((skill) => [skill.key, skill.name]));
  const matched = questions
    .map(({ skill, text }) => ({ skill: namesByKey.get(skillKey(skill)), text }))
    .filter((question) => question.skill)
    .slice(0, limit);

  if (matched.length === 0) throw new HttpError(502, 'Gemini returned no usable questions. Please try again.');

  const interview = await Interview.create({
    user: req.user._id,
    targetRole,
    focusSkill: focus?.name,
    focusWeek,
    questions: matched,
  });
  res.status(201).json(interview);
}

export async function answerQuestion(req, res) {
  const { questionId, answer, spoken } = answerInput.parse(req.body);
  const interview = await Interview.findOne({ _id: req.params.id, user: req.user._id });
  const question = interview?.questions.id(questionId);
  if (!question) throw new HttpError(404, 'Question not found.');
  if (question.answeredAt) throw new HttpError(400, 'That question has already been answered.');

  const scored = await generateJson({
    model: SMART_MODEL,
    system: answerScoringPrompt.system,
    schema: answerScoringPrompt.schema,
    parts: [
      {
        text: [
          `Role: ${interview.targetRole || 'Not set'}`,
          `Skill: ${question.skill}`,
          `Question: ${question.text}`,
          `Rubric:\n${rubricText()}`,
          ...(spoken ? ['This answer was spoken and transcribed, so do not mark down punctuation.'] : []),
          `Answer: ${document(answer)}`,
        ].join('\n'),
      },
    ],
  });

  const { scores, overall } = applyRubric(scored.scores, answer);
  question.set({
    answer,
    scores,
    overall,
    summary: scored.summary,
    improvement: scored.improvement,
    answeredAt: new Date(),
  });

  const answered = interview.questions.filter((item) => item.answeredAt);
  if (answered.length === interview.questions.length) {
    const total = answered.reduce((sum, item) => sum + item.overall, 0);
    interview.overall = Math.round((total / answered.length) * 10) / 10;
  }
  await interview.save();

  await recordInterviewScore(req.user._id, question.skill, overall);
  const plan = await latestPlan(req.user._id);
  const adjusted = plan ? await adjustPlan(plan) : null;

  res.json({ interview, planChanges: adjusted?.changes ?? [] });
}
