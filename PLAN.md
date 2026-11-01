# Career Pivot Coach: Build Plan

## 1. What we are building

A web app that helps someone move into a new career. It must include:

1. Resume and target-role intake
2. A skill-gap map built from real job descriptions
3. A week-by-week learning plan
4. Portfolio project suggestions matched to the gaps
5. Mock interviews scored against a rubric
6. Progress tracking that adjusts the plan
7. An application tracker that learns which kinds of roles get responses

**Core approach:** Gemini reads documents and writes text. Our own code handles scoring, plan changes and the tracker's learning, so results stay consistent and explainable.

**Assumptions:** a 2–3 day hackathon and a team of about four.

## 2. Tech stack

The project uses plain JavaScript, with no Next.js or TypeScript.

| Part | Choice | Purpose |
|---|---|---|
| Frontend | React JS with Vite | Pages and UI |
| Page navigation | React Router | Moves between pages |
| API calls | Axios | Connects React to the backend |
| Charts | Recharts | Skill-gap and progress views |
| Backend | Node.js with Express | API and all scoring logic |
| Database | MongoDB Atlas with Mongoose | Hosted database and data models |
| Resume upload | Multer | Receives the PDF in the backend |
| AI | Gemini API with `@google/genai` | Called only from the backend |
| Response validation | Zod | Checks Gemini's JSON before saving |

**Gemini models:**

- `gemini-3.5-flash-lite`: resume and job description parsing
- `gemini-3.6-flash` with low thinking: plans, projects and interview scoring, falling back to `gemini-3.5-flash-lite` when it is busy

`gemini-3.8-flash` was tested first, but it took 105 seconds on a simple request and later returned "high demand" errors, which is too unreliable for a live demo.

Have Gemini return JSON that matches a fixed schema, and validate it with Zod before saving.

**Job data:** pasted job descriptions are the main input, because they work for any role. Arbeitnow is an optional extra source that needs no key.

| Source | Limitation |
|---|---|
| Arbeitnow | Mostly focused on Europe |
| Adzuna | Descriptions are truncated, which makes it weak for skill extraction |
| Remotive | Free feed is delayed 24 hours, limited to about 4 calls a day, and restricts redistribution |

The job API details come mostly from third-party guides, so confirm them on each provider's site.

## 3. How each feature works

| # | Feature | Gemini does | Our code does |
|---|---|---|---|
| 1 | Intake | Turns the resume PDF into structured skills and experience | Collects target role, hours per week and timeline, and lets the user correct the results |
| 2 | Skill-gap map | Extracts skills from 5–10 job descriptions, with a supporting quote for each | Merges duplicates such as "JS" and "JavaScript", confirms each quote exists, and ranks the gaps |
| 3 | Learning plan | Writes weekly tasks and explanations | Decides order and workload from gap priority, prerequisites and available hours |
| 4 | Portfolio projects | Suggests projects for the top gaps | Checks that each project covers a real gap, and shows which ones |
| 5 | Mock interviews | Asks questions based on the job descriptions and scores answers | Stores a fixed rubric, requires a quote from the answer for each score, and updates skill levels |
| 6 | Progress tracking | Explains the plan changes | Applies the adjustment rules and shows what changed and why |
| 7 | Application tracker | Tags each role's type, seniority and industry | Calculates which kinds of roles get responses |

### Gap score

```text
gap = (share of job descriptions asking for the skill) × importance × (1 − current proficiency)
```

### Interview rubric

Score each area from 1–5, with a written description of each level:

- Relevance
- Depth
- Structure
- Evidence
- Communication

### Plan adjustment rules

- If the user completes under 70% of the planned hours for two weeks, reduce the workload and extend the timeline.
- If a skill scores below 3 in a mock interview, add practice for it.
- If a skill scores 4 or above twice, mark it as done and remove its remaining tasks.

### Tracker learning

```text
response rate = (responses + 1) / (applications + 2)
```

Calculate this for each role type. The formula stops one lucky response from looking like a 100% success rate. Show the sample size, and only make a recommendation after about 5 applications of that type.

## 4. Folder structure

```text
career-pivot-coach/
├── client/                 # React app
│   └── src/
│       ├── pages/          # Intake, SkillGap, Plan, Projects, Interview, Tracker, Dashboard
│       ├── components/
│       └── api/            # Axios calls
└── server/                 # Node.js and Express app
    ├── routes/             # API endpoints
    ├── controllers/        # Request handling
    ├── models/             # Mongoose schemas
    ├── services/
    │   ├── gemini.js       # All Gemini calls and caching
    │   ├── gapScore.js     # Skill-gap formula
    │   ├── planRules.js    # Plan adjustment rules
    │   └── trackerStats.js # Response-rate learning
    ├── prompts/
    ├── seed/               # Demo persona and sample applications
    └── index.js
```

## 5. MongoDB collections

| Collection | What it stores |
|---|---|
| `users` | Target role, hours per week, timeline, and parsed resume data |
| `jobdescriptions` | Original text and extracted skills, each with its quote |
| `userskills` | Current proficiency for each skill, which is the center of the app |
| `plans` | A new version for each change, with weekly tasks and the reason for the change |
| `projects` | Portfolio suggestions and the gaps they cover |
| `interviews` | Questions, answers, rubric scores and supporting quotes |
| `applications` | Role details, resume version, status and outcome |
| `aicaches` | Saved Gemini responses, looked up by content hash |

Interviews and completed tasks update `userskills`, and the plan reads from it.

## 6. API routes

| Feature | Routes |
|---|---|
| Intake | `POST /api/resume/upload`, `GET /api/resumes`, `GET /api/resumes/:id/file`, `POST /api/resumes/:id/activate`, `DELETE /api/resumes/:id`, `PUT /api/profile`, `POST /api/profile/describe` |
| Skill gaps | `GET /api/jobs`, `POST /api/jobs`, `POST /api/jobs/estimate`, `POST /api/jobs/:id/use-for-role`, `DELETE /api/jobs/:id`, `GET /api/gaps` |
| Learning plan | `POST /api/plan/generate`, `GET /api/plan`, `PATCH /api/plan/tasks/:id`, `POST /api/plan/check-in`, `POST /api/plan/restore-week` |
| Projects | `POST /api/projects/suggest`, `GET /api/projects` |
| Interviews | `GET /api/interviews`, `GET /api/interviews/rubric`, `POST /api/interviews`, `POST /api/interviews/:id/answer`, `GET /api/interviews/:id` |
| Tracker | `GET /api/applications`, `POST /api/applications`, `PATCH /api/applications/:id`, `DELETE /api/applications/:id`, `GET /api/applications/insights` |

## 7. Build order

1. **Setup:** create the app, database, Gemini wrapper with response caching, and demo persona.
2. **Core flow:** build intake, then the skill-gap map, then the learning plan. This is the first complete demo.
3. **Interviews and projects:** add portfolio suggestions and scored mock interviews.
4. **The feedback loop:** connect scores and progress to plan changes, then build the tracker.
5. **Final polish:** add a dashboard, test the demo end to end, and record a backup video.

If time runs short, simplify in this order: skip login, use text-only interviews, then use fewer chart types. Keep all seven features at least working, since all are required.

## 8. Team split

| Person | Responsibility |
|---|---|
| Person 1 | React pages for intake and the skill-gap map, plus their backend routes |
| Person 2 | `planRules.js`, plan generation and progress tracking |
| Person 3 | Mock interviews and portfolio projects |
| Person 4 | Tracker, dashboard, seed data and deployment |

With fewer people, combine Persons 1 and 2, then Persons 3 and 4.

## 9. Setup and deployment

Create these before the hackathon starts:

- A Gemini API key from Google AI Studio
- A free MongoDB Atlas cluster

Store both in `server/.env` and add that file to `.gitignore`.

For the demo, deploy React on Vercel and the backend on Render. Free Render servers can take a while to wake up, so open the app a few minutes before presenting and keep the backup video ready.

## 10. Risks

| Risk | What to do |
|---|---|
| Rate limits | The free tier allowed only 20 `gemini-3.6-flash` requests a day when tested on 31 October 2026, and check [AI Studio](https://aistudio.google.com/rate-limit) for current limits. Limits apply per project, so extra keys in the same project won't help. Responses are cached by content hash, and the app falls back to `gemini-3.5-flash-lite` when the limit is reached. |
| Invented information | The quote check handles skills. For learning resources, use a hand-picked list or search links, because AI-generated URLs may not exist. |
| Prompt injection | Resumes and job descriptions can contain hidden instructions, so pass them to Gemini as data and validate every response. |
| Privacy | Resumes contain personal data, so never expose the API key to the browser, and don't log resume text. |
| Empty tracker in the demo | A new user has no application history, so preload about 30 sample applications and label them clearly as sample data. |
| Job site scraping | Avoid scraping sites like LinkedIn, which is unreliable and may break their terms. |

## 11. 3-minute demo

Use one persona, such as a teacher moving into data analytics:

1. Upload the resume and job descriptions, then show the gaps with their quotes.
2. Show the week-by-week plan and a matched project.
3. Give a weak interview answer and show the rubric score.
4. Show the plan changing, with the reason displayed.
5. Show the tracker finding which role types get the most responses, and the recommendation changing.

Steps 3–5 are the strongest moment, because they show the whole product responding to what the user does.

## Sources

- [Gemini models](https://ai.google.dev/gemini-api/docs/models)
- [Gemini rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Arbeitnow Job Board API](https://www.arbeitnow.com/blog/job-board-api)
- [Free job APIs in 2026](https://jobspipe.dev/blog/free-job-api)
- [Adzuna API guide](https://jobspipe.dev/blog/adzuna-api)
- [Remotive Jobs API](https://freeapihub.com/apis/remotive-jobs-api)
