import Project from '../models/Project.js';
import { document, projectsPrompt } from '../prompts/index.js';
import { generateJson, SMART_MODEL } from '../services/gemini.js';
import { skillKey } from '../services/skills.js';
import { HttpError } from '../utils/httpError.js';
import { loadGaps } from './gaps.js';

const MAX_GAPS = 8;

export async function listProjects(req, res) {
  res.json(await Project.find({ user: req.user._id }).sort({ createdAt: 1 }).lean());
}

export async function suggestProjects(req, res) {
  const { targetRole, resume } = req.user;
  const gaps = (await loadGaps(req.user)).filter((gap) => gap.gap > 0).slice(0, MAX_GAPS);
  if (gaps.length === 0) throw new HttpError(400, 'Add job descriptions first, so there are gaps to work on.');

  const { projects } = await generateJson({
    model: SMART_MODEL,
    system: projectsPrompt.system,
    schema: projectsPrompt.schema,
    parts: [
      {
        text: [
          `Target role: ${targetRole || 'Not set'}`,
          `Background: ${document(resume?.summary || 'Not provided')}`,
          `Skills to cover: ${JSON.stringify(gaps.map((gap) => gap.name))}`,
        ].join('\n'),
      },
    ],
  });

  // Keeps only skills that are real gaps, and drops projects that cover none.
  const namesByKey = new Map(gaps.map((gap) => [gap.key, gap.name]));
  const matched = projects
    .map((project) => ({
      ...project,
      skills: [...new Set(project.skills.map((skill) => namesByKey.get(skillKey(skill))).filter(Boolean))],
    }))
    .filter((project) => project.skills.length > 0);

  if (matched.length === 0) throw new HttpError(502, 'No suggested project matched your gaps. Please try again.');

  await Project.deleteMany({ user: req.user._id });
  res.status(201).json(await Project.insertMany(matched.map((project) => ({ ...project, user: req.user._id }))));
}
