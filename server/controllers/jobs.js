import { z } from 'zod';
import JobDescription from '../models/JobDescription.js';
import { document, jobSkillsPrompt, roleSkillsPrompt } from '../prompts/index.js';
import { FAST_MODEL, generateJson } from '../services/gemini.js';
import { roleKey, skillKey, verifyEvidence } from '../services/skills.js';
import { HttpError } from '../utils/httpError.js';

const MAX_JOBS_PER_ROLE = 10;
const ESTIMATE_QUOTE = 'Commonly asked for in this role (AI estimate)';

const jobInput = z.object({
  title: z.string().trim().min(2).max(120),
  company: z.string().trim().max(120).optional(),
  text: z.string().trim().min(100, 'Paste the full job description').max(20000),
});

const roleFields = ({ targetRole }) => ({ targetRole, roleKey: roleKey(targetRole) });

function realJobsForRole(user) {
  return JobDescription.countDocuments({ user: user._id, roleKey: roleKey(user.targetRole), isEstimate: { $ne: true } });
}

function deleteEstimate(user) {
  return JobDescription.deleteMany({ user: user._id, roleKey: roleKey(user.targetRole), isEstimate: true });
}

async function checkJobLimit(user) {
  if ((await realJobsForRole(user)) >= MAX_JOBS_PER_ROLE) {
    throw new HttpError(400, `You can add up to ${MAX_JOBS_PER_ROLE} job descriptions for each role.`);
  }
}

export async function listJobs(req, res) {
  res.json(await JobDescription.find({ user: req.user._id }).sort({ createdAt: 1 }).lean());
}

export async function createJob(req, res) {
  const input = jobInput.parse(req.body);
  await checkJobLimit(req.user);

  const { skills: extracted } = await generateJson({
    model: FAST_MODEL,
    system: jobSkillsPrompt.system,
    schema: jobSkillsPrompt.schema,
    parts: [{ text: document(input.text) }],
  });

  const { skills, dropped } = verifyEvidence(extracted, input.text);
  if (skills.length === 0) throw new HttpError(422, 'No verifiable skills were found in that job description.');

  await deleteEstimate(req.user);
  const job = await JobDescription.create({
    ...input,
    ...roleFields(req.user),
    user: req.user._id,
    skills,
    droppedSkills: dropped,
  });
  res.status(201).json(job);
}

// Gives a new role a starting point until real job descriptions are added.
export async function estimateJob(req, res) {
  const { targetRole } = req.user;
  if (!targetRole) throw new HttpError(400, 'Set your target role first.');
  if ((await realJobsForRole(req.user)) > 0) {
    throw new HttpError(400, 'This role already has job descriptions.');
  }

  const { skills } = await generateJson({
    model: FAST_MODEL,
    system: roleSkillsPrompt.system,
    schema: roleSkillsPrompt.schema,
    parts: [{ text: document(`Role: ${targetRole}`) }],
  });

  const byKey = new Map(
    skills.map(({ name, importance }) => [skillKey(name), { name, importance, quote: ESTIMATE_QUOTE }]),
  );

  await deleteEstimate(req.user);
  const job = await JobDescription.create({
    ...roleFields(req.user),
    user: req.user._id,
    title: `Typical ${targetRole} role`,
    text: `AI estimate of what ${targetRole} jobs usually ask for.`,
    isEstimate: true,
    skills: [...byKey].map(([key, skill]) => ({ ...skill, key })),
  });
  res.status(201).json(job);
}

export async function moveJobToRole(req, res) {
  await checkJobLimit(req.user);

  const job = await JobDescription.findOne({ _id: req.params.id, user: req.user._id });
  if (!job) throw new HttpError(404, 'Job description not found.');

  await deleteEstimate(req.user);
  job.set(roleFields(req.user));
  await job.save();
  res.json(job);
}

export async function deleteJob(req, res) {
  const { deletedCount } = await JobDescription.deleteOne({ _id: req.params.id, user: req.user._id });
  if (!deletedCount) throw new HttpError(404, 'Job description not found.');
  res.status(204).end();
}
