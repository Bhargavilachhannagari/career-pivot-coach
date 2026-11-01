const IMPORTANCE = { required: 1, preferred: 0.7, nice: 0.4 };

const HIGH_PRIORITY_GAP = 0.5;
const MEDIUM_PRIORITY_GAP = 0.2;

function priorityFor(gap) {
  if (gap >= HIGH_PRIORITY_GAP) return 'high';
  if (gap >= MEDIUM_PRIORITY_GAP) return 'medium';
  return 'low';
}

const round = (value) => Math.round(value * 1000) / 1000;

// gap = (share of job descriptions asking for the skill) × importance × (1 − current proficiency)
export function computeGaps(jobs, userSkills) {
  const proficiencyByKey = new Map(userSkills.map((skill) => [skill.key, skill.proficiency]));
  const skills = new Map();

  for (const job of jobs) {
    for (const skill of job.skills) {
      if (!skills.has(skill.key)) skills.set(skill.key, { key: skill.key, name: skill.name, mentions: [] });
      skills.get(skill.key).mentions.push({
        jobId: job._id,
        jobTitle: job.title,
        importance: IMPORTANCE[skill.importance],
        quote: skill.quote,
      });
    }
  }

  return [...skills.values()]
    .map(({ key, name, mentions }) => {
      const share = mentions.length / jobs.length;
      const importance = mentions.reduce((sum, m) => sum + m.importance, 0) / mentions.length;
      const proficiency = proficiencyByKey.get(key) ?? 0;
      const gap = round(share * importance * (1 - proficiency));

      return {
        key,
        name,
        jobCount: mentions.length,
        totalJobs: jobs.length,
        share: round(share),
        importance: round(importance),
        proficiency,
        gap,
        priority: priorityFor(gap),
        evidence: mentions.map(({ jobId, jobTitle, quote }) => ({ jobId, jobTitle, quote })),
      };
    })
    .sort((a, b) => b.gap - a.gap || a.name.localeCompare(b.name));
}
