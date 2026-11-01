import Application from '../models/Application.js';
import Interview from '../models/Interview.js';
import JobDescription from '../models/JobDescription.js';
import Plan from '../models/Plan.js';
import Project from '../models/Project.js';
import Resume from '../models/Resume.js';
import User, { DEMO_EMAIL } from '../models/User.js';
import UserSkill from '../models/UserSkill.js';
import { roleKey, skillKey, verifyEvidence } from '../services/skills.js';
import { hashPassword } from '../services/auth.js';
import { DEMO_PASSWORD, demoApplications, demoJobs, demoProfile, demoSkills } from './demoData.js';

// Replaces the demo user's data with the sample persona. AI response caches are left alone.
export async function seedDemo() {
  const user = await User.findOneAndUpdate(
    { email: DEMO_EMAIL },
    { $set: { ...demoProfile, passwordHash: await hashPassword(DEMO_PASSWORD) } },
    { upsert: true, returnDocument: 'after' },
  );

  await Promise.all([
    UserSkill.deleteMany({ user: user._id }),
    JobDescription.deleteMany({ user: user._id }),
    Plan.deleteMany({ user: user._id }),
    Project.deleteMany({ user: user._id }),
    Resume.deleteMany({ user: user._id }),
    Interview.deleteMany({ user: user._id }),
    Application.deleteMany({ user: user._id }),
  ]);

  await Application.insertMany(demoApplications.map((application) => ({ ...application, user: user._id })));

  await UserSkill.insertMany(
    demoSkills.map((skill) => ({ ...skill, user: user._id, key: skillKey(skill.name), source: 'resume' })),
  );

  await JobDescription.insertMany(
    demoJobs.map(({ skills: extracted, ...job }) => {
      const { skills, dropped } = verifyEvidence(extracted, job.text);
      if (dropped > 0) throw new Error(`Sample job "${job.title}" has a quote that is not in its text`);
      const { targetRole } = demoProfile;
      return { ...job, user: user._id, skills, targetRole, roleKey: roleKey(targetRole) };
    }),
  );

  return user;
}
