export const MIN_SAMPLE = 5;

const POSITIVE = new Set(['response', 'interview', 'offer']);

const DIMENSIONS = [
  { key: 'roleType', label: 'Role type' },
  { key: 'seniority', label: 'Seniority' },
  { key: 'industry', label: 'Industry' },
  { key: 'source', label: 'Source' },
  { key: 'resumeVersion', label: 'Resume version' },
];

const STRONG_RATIO = 1.25;
const WEAK_RATIO = 0.6;
const MAX_RECOMMENDATIONS = 3;

// response rate = (responses + 1) / (applications + 2)
export const responseRate = (responses, applications) => (responses + 1) / (applications + 2);

const round = (value) => Math.round(value * 1000) / 1000;

function groupBy(applications, key) {
  const groups = new Map();
  for (const application of applications) {
    const value = application[key];
    const group = groups.get(value) ?? { value, applications: 0, responses: 0 };
    group.applications++;
    if (POSITIVE.has(application.status)) group.responses++;
    groups.set(value, group);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      rate: round(responseRate(group.responses, group.applications)),
      enoughData: group.applications >= MIN_SAMPLE,
    }))
    .sort((a, b) => b.rate - a.rate || b.applications - a.applications);
}

const describe = (label, group) =>
  `${label}: ${group.value} (${group.responses} responses from ${group.applications} applications)`;

export function computeInsights(applications) {
  const responses = applications.filter((item) => POSITIVE.has(item.status)).length;
  const overallRate = round(responseRate(responses, applications.length));
  const dimensions = DIMENSIONS.map(({ key, label }) => ({ key, label, groups: groupBy(applications, key) }));

  const findings = dimensions.flatMap(({ label, groups }) =>
    groups
      .filter((group) => group.enoughData)
      .map((group) => ({ label, group, lift: group.rate / overallRate })),
  );

  const strong = findings
    .filter(({ lift }) => lift >= STRONG_RATIO)
    .sort((a, b) => b.lift - a.lift)
    .map(({ label, group }) => ({ type: 'focus', text: `Focus on ${describe(label, group)}.` }));

  const weak = findings
    .filter(({ lift }) => lift <= WEAK_RATIO)
    .sort((a, b) => a.lift - b.lift)
    .map(({ label, group }) => ({ type: 'avoid', text: `Rethink ${describe(label, group)}.` }));

  return {
    total: applications.length,
    responses,
    overallRate,
    minSample: MIN_SAMPLE,
    dimensions,
    recommendations: [...strong.slice(0, 2), ...weak.slice(0, 1)].slice(0, MAX_RECOMMENDATIONS),
  };
}
