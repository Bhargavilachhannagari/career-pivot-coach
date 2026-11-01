# Career Pivot Coach

A web app that helps people change careers. Built with React, Node.js, Express and MongoDB, using the Gemini API. The full plan is in [PLAN.md](PLAN.md).                     

## Getting started

You need Node.js 22 or newer.

Run every command below from this `career-pivot-coach` folder, not from `server` or `client`.

```powershell
npm install
copy server\.env.example server\.env
```

These commands work in both Command Prompt and PowerShell.

`npm install` downloads a MongoDB copy of about 780 MB for local use, so the first run can take several minutes.

Open `server/.env` and add your `GEMINI_API_KEY` from Google AI Studio. Never commit this file.

### Option 1: temporary database

No MongoDB account is needed. The demo data loads automatically, and all data is lost when the server stops.

```powershell
npm run dev:demo
```

### Option 2: a permanent database

Add `MONGODB_URI` to `server/.env`, using your MongoDB Atlas connection string or `mongodb://127.0.0.1:27017/career-pivot-coach` for a local MongoDB. Then run:

```powershell
npm run seed
npm run dev
```

`npm run seed` replaces the demo user's data with the sample persona. Skip it to start empty.

Both options open the app at http://localhost:5173. The API runs on http://localhost:5000.

## Commands

| Command | What it does |
|---|---|
| `npm run dev:demo` | Runs the app with a temporary database and demo data |
| `npm run dev` | Runs the app with the database in `MONGODB_URI` |
| `npm run seed` | Loads the demo data into the database in `MONGODB_URI` |
| `npm test` | Runs the backend tests, which do not need a Gemini key |
| `npm run build` | Builds the frontend into `client/dist` |

## Project layout

```text
client/src/
  pages/        Dashboard, Intake, SkillGap, Plan, Projects, Interview, Tracker
  components/   GapList, RateChart, Toast
  api/          Axios calls
server/
  routes/       API endpoints
  controllers/  Request handling
  models/       Mongoose schemas
  services/     gemini.js, gapScore.js, planRules.js, planAdjust.js, rubric.js, skills.js, trackerStats.js
  prompts/      Gemini prompts and response schemas
  seed/         Demo persona
  test/         Backend tests
```

## Rules for adding features

- Call Gemini only through `generateJson` in `server/services/gemini.js`. It handles caching, validation and retries.
- Add each new prompt and its Zod schema to `server/prompts/index.js`.
- Wrap user-supplied text with `document()` so Gemini treats it as data.
- Keep scoring and plan decisions in `server/services`, not in prompts.

## Progress

| # | Feature | Status |
|---|---|---|
| 1 | Resume and target-role intake | Done |
| 2 | Skill-gap map | Done |
| 3 | Week-by-week learning plan | Done |
| 4 | Portfolio project suggestions | Done |
| 5 | Mock interviews scored against a rubric | Done |
| 6 | Progress tracking that adjusts the plan | Done |
| 7 | Application tracker that learns | Done |

Email and password login is also done. Not done yet: deployment, and a backup demo video.

## Logging in

After `npm run seed`, or with `npm run dev:demo`, log in with the demo account:

- **Email:** demo@example.com
- **Password:** demo1234

Anyone can select **Create an account**, and each person only sees their own data. Sessions last 7 days.

Before deploying, serve the API and the frontend from one domain, for example with a Vercel rewrite from `/api` to the backend. The session cookie is set to `SameSite=Lax`, so it is not sent if the two run on different sites. Also set `NODE_ENV=production`, and do not rely on the public demo password for anything except sample data.

Test cases and results are in [TEST_CASES.md](TEST_CASES.md).

## Voice

- **Profile:** users dictate with the Wispr Flow desktop app, which types into the description box. The page links to the download. The app itself has no Wispr API connection, because that API needs approved access.
- **Interview:** Speak my answer uses the browser's speech recognition. It works in Chrome and Edge, needs microphone permission, and needs HTTPS once deployed. These browsers may send audio to their speech service.

## Running the demo

Run `npm run seed` before each run-through. It resets the demo user, and saved Gemini responses make repeat runs faster.

1. **Skill gaps:** show what to learn first, then open **What the jobs said** on a skill to show the quotes behind it.
2. **Plan:** select **Build my plan**, then use **See in my plan** on a skill to show its highlighted tasks.
3. **Projects:** select **Suggest projects**.
4. **Interview:** start an interview and give a weak answer. The plan gains practice hours straight away.
5. **Plan:** show **What changed, and why**. Select **Finish week** twice without ticking tasks to see the workload drop.
6. **Tracker:** change some BI Analyst applications to **Interview**, and watch the advice change.

The 30 sample applications are labelled in the app. Say that they are sample data when you present.
