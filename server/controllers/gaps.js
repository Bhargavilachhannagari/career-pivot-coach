import JobDescription from '../models/JobDescription.js';
import UserSkill from '../models/UserSkill.js';
import { computeGaps } from '../services/gapScore.js';
import { roleKey } from '../services/skills.js';

// Gaps compare the person's skills with the jobs saved for their current target role.
export async function loadGaps(user) {
  const [jobs, userSkills] = await Promise.all([
    JobDescription.find({ user: user._id, roleKey: roleKey(user.targetRole) }).lean(),
    UserSkill.find({ user: user._id }).lean(),
  ]);
  return computeGaps(jobs, userSkills);
}

export async function getGaps(req, res) {
  res.json(await loadGaps(req.user));
}
