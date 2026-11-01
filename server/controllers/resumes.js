import Application from '../models/Application.js';
import Resume from '../models/Resume.js';
import { HttpError } from '../utils/httpError.js';
import { applyResumeDetails, profileResponse } from './profile.js';

const LIST_FIELDS = 'name fileName active createdAt';

export async function listResumes(req, res) {
  res.json(await Resume.find({ user: req.user._id }).select(LIST_FIELDS).sort({ createdAt: 1 }).lean());
}

export async function getResumeFile(req, res) {
  const resume = await Resume.findOne({ _id: req.params.id, user: req.user._id }).select('+data fileName');
  if (!resume) throw new HttpError(404, 'Resume not found.');

  const safeName = resume.fileName.replace(/[^\w.\- ]/g, '_');
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="${safeName}"`,
    'X-Content-Type-Options': 'nosniff',
  });
  res.send(resume.data);
}

// Saved resumes are already read, so switching needs no Gemini call.
export async function activateResume(req, res) {
  const resume = await Resume.findOne({ _id: req.params.id, user: req.user._id });
  if (!resume) throw new HttpError(404, 'Resume not found.');

  await Resume.updateMany({ user: req.user._id }, { active: false });
  resume.active = true;
  await resume.save();

  await applyResumeDetails(req.user, resume.parsed, resume.fileName);
  res.json(await profileResponse(req.user));
}

// Past applications keep the resume's name, so tracker history is not lost.
export async function deleteResume(req, res) {
  const { deletedCount } = await Resume.deleteOne({ _id: req.params.id, user: req.user._id });
  if (!deletedCount) throw new HttpError(404, 'Resume not found.');

  await Application.updateMany({ user: req.user._id, resume: req.params.id }, { $unset: { resume: 1 } });
  res.status(204).end();
}
