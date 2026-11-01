import { z } from 'zod';
import Application, { STATUSES } from '../models/Application.js';
import Resume from '../models/Resume.js';
import { document, roleTagsPrompt } from '../prompts/index.js';
import { FAST_MODEL, generateJson } from '../services/gemini.js';
import { computeInsights } from '../services/trackerStats.js';
import { HttpError } from '../utils/httpError.js';

const applicationInput = z.object({
  company: z.string().trim().min(1).max(120),
  title: z.string().trim().min(2).max(120),
  source: z.string().trim().min(1).max(60).optional(),
  resumeVersion: z.string().trim().min(1).max(60).optional(),
  resumeId: z.string().optional(),
  description: z.string().trim().max(20000).optional(),
});

const statusInput = z.object({ status: z.enum(STATUSES) });

export async function listApplications(req, res) {
  res.json(await Application.find({ user: req.user._id }).sort({ createdAt: -1 }).lean());
}

export async function createApplication(req, res) {
  const { description, resumeId, ...input } = applicationInput.parse(req.body);

  const resume = resumeId ? await Resume.findOne({ _id: resumeId, user: req.user._id }).lean() : null;
  if (resumeId && !resume) throw new HttpError(404, 'Resume not found.');

  const tags = await generateJson({
    model: FAST_MODEL,
    system: roleTagsPrompt.system,
    schema: roleTagsPrompt.schema,
    parts: [{ text: document(`${input.title} at ${input.company}\n${description ?? ''}`) }],
  });

  const application = await Application.create({
    ...input,
    ...tags,
    ...(resume && { resume: resume._id, resumeVersion: resume.name }),
    user: req.user._id,
  });
  res.status(201).json(application);
}

export async function updateApplication(req, res) {
  const { status } = statusInput.parse(req.body);
  const application = await Application.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { status },
    { returnDocument: 'after' },
  );
  if (!application) throw new HttpError(404, 'Application not found.');
  res.json(application);
}

export async function deleteApplication(req, res) {
  const { deletedCount } = await Application.deleteOne({ _id: req.params.id, user: req.user._id });
  if (!deletedCount) throw new HttpError(404, 'Application not found.');
  res.status(204).end();
}

export async function getInsights(req, res) {
  res.json(computeInsights(await Application.find({ user: req.user._id }).lean()));
}
