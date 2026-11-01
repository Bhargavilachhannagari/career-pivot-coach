// Sample data for the demo persona. The person and companies are fictional.

export const DEMO_PASSWORD = 'demo1234';

export const demoProfile = {
  name: 'Sam Rivera',
  targetRole: 'Data Analyst',
  hoursPerWeek: 8,
  timelineWeeks: 12,
  resume: {
    fileName: 'sample-resume.pdf',
    summary:
      'High school maths teacher with 8 years of experience using assessment data to plan lessons, and leading a department of six teachers.',
    experience: [
      {
        title: 'Head of Mathematics',
        organization: 'Lakeside High School',
        period: '2020 to present',
        highlights: [
          'Built Excel trackers for the results of 400 students, used by the department each term.',
          'Presented attainment trends to school leaders and parents.',
        ],
      },
      {
        title: 'Mathematics Teacher',
        organization: 'Lakeside High School',
        period: '2016 to 2020',
        highlights: ['Raised pass rates by 12% by targeting topics that assessment data showed were weak.'],
      },
    ],
    education: ['BSc Mathematics', 'Postgraduate Certificate in Education'],
  },
};

export const demoSkills = [
  { name: 'Excel', proficiency: 0.65 },
  { name: 'Communication', proficiency: 0.9 },
  { name: 'Statistics', proficiency: 0.65 },
  { name: 'Stakeholder management', proficiency: 0.65 },
];

// [role type, seniority, industry, source, applications, positive responses]
const SAMPLE_APPLICATION_GROUPS = [
  ['Data Analyst', 'entry', 'Education', 'Referral', 6, 4],
  ['Data Analyst', 'entry', 'Education', 'Company site', 4, 2],
  ['Data Analyst', 'entry', 'Retail', 'Job board', 6, 1],
  ['BI Analyst', 'mid', 'Healthcare', 'Job board', 6, 1],
  ['Data Analyst', 'mid', 'Finance', 'Job board', 4, 0],
  ['Data Scientist', 'senior', 'Technology', 'Job board', 4, 0],
];

const POSITIVE_STATUSES = ['response', 'interview', 'offer'];
const NEGATIVE_STATUSES = ['no_response', 'rejected'];

export const demoApplications = SAMPLE_APPLICATION_GROUPS.flatMap(
  ([roleType, seniority, industry, source, count, responses], groupIndex) =>
    Array.from({ length: count }, (_, index) => ({
      company: `Sample Company ${groupIndex + 1}-${index + 1}`,
      title: `${roleType} (sample)`,
      roleType,
      seniority,
      industry,
      source,
      resumeVersion: 'Main',
      status:
        index < responses
          ? POSITIVE_STATUSES[index % POSITIVE_STATUSES.length]
          : NEGATIVE_STATUSES[index % NEGATIVE_STATUSES.length],
      isSample: true,
    })),
);

export const demoJobs = [
  {
    title: 'Junior Data Analyst',
    company: 'Northwind Retail (sample)',
    text: `Northwind Retail is growing its analytics team. You will support our merchandising managers with weekly reporting.
Responsibilities: write SQL queries to pull sales data, build dashboards in Tableau, and explain trends to non-technical stakeholders.
Requirements: Strong SQL skills. Advanced Excel including pivot tables. Clear written and verbal communication.
Nice to have: Python experience is a plus.`,
    skills: [
      { name: 'SQL', importance: 'required', quote: 'Strong SQL skills' },
      { name: 'Excel', importance: 'required', quote: 'Advanced Excel including pivot tables' },
      { name: 'Tableau', importance: 'required', quote: 'build dashboards in Tableau' },
      { name: 'Communication', importance: 'required', quote: 'Clear written and verbal communication' },
      { name: 'Python', importance: 'preferred', quote: 'Python experience is a plus' },
    ],
  },
  {
    title: 'Data Analyst, Education Insights',
    company: 'BrightPath Learning (sample)',
    text: `BrightPath Learning helps schools understand student outcomes. Join us to turn classroom data into clear recommendations.
What you will do: analyse product usage with SQL, build Power BI reports for school partners, and run A/B tests on new features.
What we need: Experience with SQL and relational databases. Working knowledge of Power BI. Solid grounding in statistics.
Bonus: classroom teaching experience is valuable to us, and Python for data analysis is preferred.`,
    skills: [
      { name: 'SQL', importance: 'required', quote: 'Experience with SQL and relational databases' },
      { name: 'Power BI', importance: 'required', quote: 'Working knowledge of Power BI' },
      { name: 'Statistics', importance: 'required', quote: 'Solid grounding in statistics' },
      { name: 'A/B testing', importance: 'preferred', quote: 'run A/B tests on new features' },
      { name: 'Python', importance: 'preferred', quote: 'Python for data analysis is preferred' },
    ],
  },
  {
    title: 'Business Intelligence Analyst',
    company: 'Harbor Health (sample)',
    text: `Harbor Health needs an analyst to support hospital operations teams with reliable reporting.
You will maintain data models, design Tableau dashboards, and partner with clinical managers to define metrics.
Required: Proficiency in SQL. Experience with Tableau or a similar BI tool. Data modelling fundamentals. Stakeholder management.
Desirable: exposure to Python scripting for automation.`,
    skills: [
      { name: 'SQL', importance: 'required', quote: 'Proficiency in SQL' },
      { name: 'Tableau', importance: 'required', quote: 'Experience with Tableau or a similar BI tool' },
      { name: 'Data modelling', importance: 'required', quote: 'Data modelling fundamentals' },
      { name: 'Stakeholder management', importance: 'required', quote: 'Stakeholder management' },
      { name: 'Python', importance: 'preferred', quote: 'exposure to Python scripting for automation' },
    ],
  },
  {
    title: 'Marketing Data Analyst',
    company: 'Fernway Travel (sample)',
    text: `Fernway Travel's marketing team wants sharper insight into campaign performance across channels.
You will analyse campaign data, design and read A/B testing results, and share findings in weekly reviews.
Must have: SQL for day-to-day analysis. Python with pandas for data cleaning. Excellent communication with marketing teams.
Good to have: Experience with Tableau dashboards and an understanding of statistics.`,
    skills: [
      { name: 'SQL', importance: 'required', quote: 'SQL for day-to-day analysis' },
      { name: 'Python', importance: 'required', quote: 'Python with pandas for data cleaning' },
      { name: 'Communication', importance: 'required', quote: 'Excellent communication with marketing teams' },
      { name: 'A/B testing', importance: 'required', quote: 'design and read A/B testing results' },
      { name: 'Tableau', importance: 'preferred', quote: 'Experience with Tableau dashboards' },
      { name: 'Statistics', importance: 'preferred', quote: 'an understanding of statistics' },
    ],
  },
  {
    title: 'Operations Analyst',
    company: 'Cobalt Logistics (sample)',
    text: `Cobalt Logistics is hiring an analyst to find savings across our delivery network.
You will investigate delays, automate recurring reports, and present recommendations to regional leads.
Requirements: Advanced Excel. Comfortable writing SQL. Experience building dashboards in Power BI. Confident presenting to senior stakeholders.
Preferred: Basic Python for automating reports.`,
    skills: [
      { name: 'Excel', importance: 'required', quote: 'Advanced Excel' },
      { name: 'SQL', importance: 'required', quote: 'Comfortable writing SQL' },
      { name: 'Power BI', importance: 'required', quote: 'building dashboards in Power BI' },
      { name: 'Communication', importance: 'required', quote: 'Confident presenting to senior stakeholders' },
      { name: 'Python', importance: 'preferred', quote: 'Basic Python for automating reports' },
    ],
  },
];
