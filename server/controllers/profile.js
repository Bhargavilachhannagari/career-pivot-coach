import { z } from 'zod';
import Resume, { MAX_RESUMES } from '../models/Resume.js';
import UserSkill from '../models/UserSkill.js';
import { document, LEVEL_PROFICIENCY, resumePrompt, storyPrompt } from '../prompts/index.js';
import { FAST_MODEL, generateJson } from '../services/gemini.js';
import { skillKey } from '../services/skills.js';
import { HttpError } from '../utils/httpError.js';

const MAX_PROFILE_TEXT = 100;

const profileInput = z.object({
  name: z.string().trim().max(MAX_PROFILE_TEXT).optional(),
  targetRole: z.string().trim().min(2).max(MAX_PROFILE_TEXT),
  hoursPerWeek: z.number().int().min(1).max(60),
  timelineWeeks: z.number().int().min(1).max(52),
  skills: z
    .array(z.object({ name: z.string().trim().min(1).max(60), proficiency: z.number().min(0).max(1) }))
    .max(100)
    .optional(),
});

const MAX_RESUME_NAME = 60;

const uploadInput = z.object({ name: z.string().trim().max(MAX_RESUME_NAME).optional() });

const describeInput = z.object({
  text: z.string().trim().min(30, 'Tell us a little more about your background and goal.').max(6000),
});

export async function profileResponse(user) {
  const skills = await UserSkill.find({ user: user._id }).sort({ proficiency: -1, name: 1 }).lean();
  const { name, targetRole, hoursPerWeek, timelineWeeks, resume } = user;
  return { name, targetRole, hoursPerWeek, timelineWeeks, resume, skills };
}

async function replaceSkills(user, skills) {
  await UserSkill.deleteMany({ user: user._id });
  const byKey = new Map(skills.map((skill) => [skillKey(skill.name), skill]));
  await UserSkill.insertMany(
    [...byKey].map(([key, { name, level }]) => ({
      user: user._id,
      key,
      name,
      proficiency: LEVEL_PROFICIENCY[level],
      source: 'resume',
    })),
  );
}

const profileText = (text) => text.trim().slice(0, MAX_PROFILE_TEXT);

// A resume replaces the previous name, role and skills completely.
export async function applyResumeDetails(user, { name, role, skills, ...resume }, fileName) {
  user.resume = { ...resume, fileName };
  user.name = profileText(name);
  user.targetRole = profileText(role);
  await user.save();
  await replaceSkills(user, skills);
}

// A name the user typed must be free. A name taken from the file gets a number instead.
async function chooseResumeName(userId, typedName, fileName) {
  const taken = new Set(await Resume.find({ user: userId }).distinct('nameKey'));
  if (typedName) {
    if (taken.has(typedName.toLowerCase())) throw new HttpError(409, 'You already have a resume with that name.');
    return typedName;
  }

  const base = fileName.replace(/\.pdf$/i, '').slice(0, MAX_RESUME_NAME - 4) || 'Resume';
  let name = base;
  for (let copy = 2; taken.has(name.toLowerCase()); copy++) name = `${base} (${copy})`;
  return name;
}

export async function getProfile(req, res) {
  res.json(await profileResponse(req.user));
}

export async function updateProfile(req, res) {
  const { skills, ...fields } = profileInput.parse(req.body);
  req.user.set(fields);
  await req.user.save();

  if (skills) {
    const byKey = new Map(skills.map((skill) => [skillKey(skill.name), skill]));
    await UserSkill.deleteMany({ user: req.user._id, key: { $nin: [...byKey.keys()] } });
    await UserSkill.bulkWrite(
      [...byKey].map(([key, { name, proficiency }]) => ({
        updateOne: {
          filter: { user: req.user._id, key },
          update: { $set: { name, proficiency, source: 'self' } },
          upsert: true,
        },
      })),
    );
  }

  res.json(await profileResponse(req.user));
}

export async function uploadResume(req, res) {
  if (!req.file) throw new HttpError(400, 'Please choose a PDF resume to upload.');
  if (req.file.buffer.subarray(0, 5).toString() !== '%PDF-') {
    throw new HttpError(400, 'That file is not a valid PDF.');
  }

  const { name: typedName } = uploadInput.parse(req.body ?? {});
  const saved = await Resume.countDocuments({ user: req.user._id });
  if (saved >= MAX_RESUMES) {
    throw new HttpError(400, `You can save up to ${MAX_RESUMES} resumes. Delete one to add another.`);
  }
  const resumeName = await chooseResumeName(req.user._id, typedName, req.file.originalname);

  const parsed = await generateJson({
    model: FAST_MODEL,
    system: resumePrompt.system,
    schema: resumePrompt.schema,
    parts: [
      { text: resumePrompt.instruction },
      { inlineData: { mimeType: 'application/pdf', data: req.file.buffer.toString('base64') } },
    ],
  });

  await Resume.updateMany({ user: req.user._id }, { active: false });
  await Resume.create({
    user: req.user._id,
    name: resumeName,
    nameKey: resumeName.toLowerCase(),
    fileName: req.file.originalname,
    data: req.file.buffer,
    parsed,
    active: true,
  });

  await applyResumeDetails(req.user, parsed, req.file.originalname);
  res.json(await profileResponse(req.user));
}

// The role always follows the latest description. Name, hours and timeline are kept if left out.
export async function describeProfile(req, res) {
  const { text } = describeInput.parse(req.body);

  const { cleaned, name, role, hoursPerWeek, timelineWeeks, skills, ...resume } = await generateJson({
    model: FAST_MODEL,
    system: storyPrompt.system,
    schema: storyPrompt.schema,
    parts: [{ text: document(text) }],
  });

  await Resume.updateMany({ user: req.user._id }, { active: false });
  req.user.resume = { ...resume, fileName: 'Your description', description: cleaned };
  if (name.trim()) req.user.name = profileText(name);
  req.user.targetRole = profileText(role);
  if (hoursPerWeek > 0) req.user.hoursPerWeek = hoursPerWeek;
  if (timelineWeeks > 0) req.user.timelineWeeks = timelineWeeks;
  await req.user.save();
  if (skills.length > 0) await replaceSkills(req.user, skills);

  res.json(await profileResponse(req.user));
}
