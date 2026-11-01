import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import app from '../app.js';
import AiCache from '../models/AiCache.js';
import Session from '../models/Session.js';
import User, { DEMO_EMAIL } from '../models/User.js';
import { seedDemo } from '../seed/seedDemo.js';
import { setGeminiClient } from '../services/gemini.js';

const JOB_TEXT =
  'We are hiring an analyst. Strong SQL skills are essential and you will also build reports for managers every single week.';

let mongo;
let server;
let baseUrl;
let calls;
let replies;
let cookie;

// Answers by the first schema property, the same way each prompt's response is shaped.
const fakeGemini = {
  models: {
    generateContent: async (request) => {
      calls.push(request);
      const field = Object.keys(request.config.responseJsonSchema.properties)[0];
      const reply = replies[field];
      if (typeof reply === 'function') return reply(request);
      return { text: JSON.stringify(reply) };
    },
  },
};

const sessionCookie = (res) => res.headers.getSetCookie()[0]?.split(';')[0];

function api(path, options = {}) {
  const { body, cookie: cookieHeader = cookie, ...rest } = options;
  return fetch(`${baseUrl}/api${path}`, {
    ...rest,
    headers: {
      ...(cookieHeader && { Cookie: cookieHeader }),
      ...(body && { 'Content-Type': 'application/json' }),
    },
    ...(body && { body: JSON.stringify(body) }),
  });
}

const signUp = (email, password = 'correct-horse') =>
  api('/auth/register', { method: 'POST', cookie: '', body: { email, password } });

before(async () => {
  mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
  await mongoose.connect(mongo.getUri('test'));
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  baseUrl = `http://localhost:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
  calls = [];
  replies = {
    name: {
      name: 'Alex Morgan',
      role: 'Head of Mathematics',
      summary: 'A teacher.',
      experience: [],
      education: [],
      skills: [
        { name: 'MS Excel', level: 'working' },
        { name: 'SQL', level: 'basic' },
      ],
    },
    skills: {
      skills: [
        { name: 'SQL', importance: 'required', quote: 'Strong SQL skills' },
        { name: 'Rust', importance: 'required', quote: 'Rust is mandatory' },
      ],
    },
    dependencies: { dependencies: [{ skill: 'Tableau', requires: ['SQL'] }] },
    weeks: {
      weeks: [
        {
          week: 1,
          theme: 'SQL basics',
          blocks: [{ skill: 'SQL', tasks: [{ title: 'Learn joins', description: 'Practise joins.' }] }],
        },
      ],
    },
    projects: {
      projects: [
        {
          title: 'School results dashboard',
          summary: 'Dashboard of results.',
          deliverables: ['A public dashboard'],
          skills: ['SQL', 'Tableau', 'Cooking'],
          difficulty: 'beginner',
          estimatedHours: 20,
        },
        {
          title: 'Off-topic project',
          summary: 'Not a gap.',
          deliverables: ['Something'],
          skills: ['Cooking'],
          difficulty: 'beginner',
          estimatedHours: 5,
        },
      ],
    },
    questions: {
      questions: [
        { skill: 'SQL', text: 'How do you find duplicates?' },
        { skill: 'Python', text: 'How do you clean data?' },
        { skill: 'Cooking', text: 'What is your best recipe?' },
      ],
    },
    scores: {
      scores: ['relevance', 'depth', 'structure', 'evidence', 'communication'].map((criterion) => ({
        criterion,
        score: 2,
        quote: 'I would group rows',
        feedback: 'Add detail.',
      })),
      summary: 'A short answer.',
      improvement: 'Give an example.',
    },
    roleType: { roleType: 'Data Analyst', seniority: 'entry', industry: 'Retail' },
    cleaned: {
      cleaned: 'I am a head of maths moving into data analysis.',
      name: 'Priya Sharma',
      role: 'Data Analyst',
      hoursPerWeek: 10,
      timelineWeeks: 16,
      summary: 'A maths teacher moving into data.',
      experience: [],
      education: [],
      skills: [{ name: 'MS Excel', level: 'working' }],
    },
  };
  setGeminiClient(fakeGemini);
  cookie = sessionCookie(await signUp(DEMO_EMAIL));
});

describe('login and logout', () => {
  const login = (email, password) => api('/auth/login', { method: 'POST', cookie: '', body: { email, password } });

  it('creates an account, stores only a hash, and keeps the password out of responses', async () => {
    const res = await signUp('New.Person@Example.com');
    assert.equal(res.status, 201);
    const body = await res.text();
    assert.ok(!body.includes('password') && !body.includes('Hash'));
    assert.equal(JSON.parse(body).user.email, 'new.person@example.com');
    assert.match(res.headers.getSetCookie()[0], /HttpOnly/);
    assert.match(res.headers.getSetCookie()[0], /SameSite=Lax/);

    const stored = await User.findOne({ email: 'new.person@example.com' }).select('+passwordHash').lean();
    assert.ok(!stored.passwordHash.includes('correct-horse'));

    const profile = await (await api('/profile', { cookie: sessionCookie(res) })).text();
    assert.ok(!profile.includes('passwordHash'));
  });

  it('rejects a duplicate email, a bad email and a short password', async () => {
    await signUp('taken@example.com');
    assert.equal((await signUp('TAKEN@example.com')).status, 409);
    assert.equal((await signUp('not-an-email')).status, 400);
    assert.equal((await signUp('short@example.com', 'short')).status, 400);
  });

  it('logs in, and gives the same error for a wrong password and an unknown email', async () => {
    await signUp('person@example.com');
    const good = await login('PERSON@example.com', 'correct-horse');
    assert.equal(good.status, 200);

    const wrong = await login('person@example.com', 'wrong-password');
    const unknown = await login('nobody@example.com', 'wrong-password');
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.deepEqual(await wrong.json(), await unknown.json());
  });

  it('cannot log in to an account that has no password', async () => {
    await User.create({ email: 'nopassword@example.com' });
    assert.equal((await login('nopassword@example.com', 'correct-horse')).status, 401);
  });

  it('protects every feature route', async () => {
    const routes = ['/profile', '/jobs', '/gaps', '/plan', '/projects', '/interviews', '/interviews/rubric', '/applications', '/applications/insights'];
    for (const route of routes) {
      assert.equal((await api(route, { cookie: '' })).status, 401, route);
    }
    assert.equal((await api('/profile', { cookie: 'session=forged' })).status, 401);
    assert.equal((await api('/plan/generate', { method: 'POST', cookie: '' })).status, 401);
  });

  it('reports who is logged in', async () => {
    assert.equal((await (await api('/auth/me')).json()).user.email, DEMO_EMAIL);
    assert.equal((await (await api('/auth/me', { cookie: '' })).json()).user, null);
  });

  it('logout cancels the session on the server', async () => {
    const res = await api('/auth/logout', { method: 'POST' });
    assert.equal(res.status, 204);
    assert.match(res.headers.getSetCookie()[0], /session=;/);
    assert.equal((await api('/profile')).status, 401);
    assert.equal((await (await api('/auth/me')).json()).user, null);
  });

  it('logging out one device leaves the other logged in', async () => {
    const phone = sessionCookie(await login(DEMO_EMAIL, 'correct-horse'));
    await api('/auth/logout', { method: 'POST' });
    assert.equal((await api('/profile', { cookie: phone })).status, 200);
  });

  it('rejects an expired session', async () => {
    await Session.updateMany({}, { expiresAt: new Date(Date.now() - 1000) });
    assert.equal((await api('/profile')).status, 401);
  });

  it('keeps each person\'s data separate', async () => {
    await seedDemo();
    await api('/plan/generate', { method: 'POST' });
    const demoJobs = await (await api('/jobs')).json();
    const demoPlan = await (await api('/plan')).json();

    const other = sessionCookie(await signUp('other@example.com'));
    const as = (path, options = {}) => api(path, { ...options, cookie: other });

    assert.deepEqual(await (await as('/jobs')).json(), []);
    assert.deepEqual(await (await as('/gaps')).json(), []);
    assert.deepEqual(await (await as('/applications')).json(), []);
    assert.equal(await (await as('/plan')).json(), null);

    assert.equal((await as(`/jobs/${demoJobs[0]._id}`, { method: 'DELETE' })).status, 404);
    const taskId = demoPlan.weeks[0].tasks[0]._id;
    assert.equal((await as(`/plan/tasks/${taskId}`, { method: 'PATCH', body: { done: true } })).status, 404);
    assert.equal((await (await api('/jobs')).json()).length, demoJobs.length);
  });
});

describe('profile and resume', () => {
  it('saves the profile and the corrected skills', async () => {
    const res = await api('/profile', {
      method: 'PUT',
      body: {
        targetRole: 'Data Analyst',
        hoursPerWeek: 10,
        timelineWeeks: 8,
        skills: [{ name: 'JS', proficiency: 0.5 }],
      },
    });
    assert.equal(res.status, 200);
    const profile = await res.json();
    assert.equal(profile.hoursPerWeek, 10);
    assert.equal(profile.skills[0].key, 'javascript');
  });

  it('accepts an empty skill list', async () => {
    const res = await api('/profile', {
      method: 'PUT',
      body: { targetRole: 'Data Analyst', hoursPerWeek: 10, timelineWeeks: 8, skills: [] },
    });
    assert.equal(res.status, 200);
  });

  it('rejects invalid input', async () => {
    const res = await api('/profile', { method: 'PUT', body: { targetRole: 'X', hoursPerWeek: 0, timelineWeeks: 8 } });
    assert.equal(res.status, 400);
  });

  const uploadResume = () => {
    const form = new FormData();
    form.append('resume', new Blob(['%PDF-1.4 sample'], { type: 'application/pdf' }), 'resume.pdf');
    return fetch(`${baseUrl}/api/resume/upload`, { method: 'POST', body: form, headers: { Cookie: cookie } });
  };

  it('fills in the name, role and skills from an uploaded PDF', async () => {
    const res = await uploadResume();
    assert.equal(res.status, 200);

    const profile = await res.json();
    assert.equal(profile.resume.fileName, 'resume.pdf');
    assert.equal(profile.name, 'Alex Morgan');
    assert.equal(profile.targetRole, 'Head of Mathematics');
    assert.equal(profile.skills.find((skill) => skill.key === 'excel').proficiency, 0.65);
    assert.equal(calls[0].contents[0].parts[1].inlineData.mimeType, 'application/pdf');

    const saved = await (await api('/profile')).json();
    assert.equal(saved.name, 'Alex Morgan');
    assert.equal(saved.targetRole, 'Head of Mathematics');
  });

  it('a new resume clears the previous name, role and skills', async () => {
    await api('/profile', {
      method: 'PUT',
      body: {
        name: 'Old Name',
        targetRole: 'Old Role',
        hoursPerWeek: 10,
        timelineWeeks: 8,
        skills: [
          { name: 'Cobol', proficiency: 0.9 },
          { name: 'SQL', proficiency: 0.9 },
        ],
      },
    });

    const profile = await (await uploadResume()).json();
    assert.equal(profile.name, 'Alex Morgan');
    assert.equal(profile.targetRole, 'Head of Mathematics');
    assert.deepEqual(profile.skills.map((skill) => skill.key).sort(), ['excel', 'sql']);
    assert.equal(profile.skills.find((skill) => skill.key === 'sql').proficiency, 0.35);
    assert.equal(profile.hoursPerWeek, 10);
    assert.equal(profile.timelineWeeks, 8);
  });

  it('clears the name and role when the new resume has neither', async () => {
    await api('/profile', {
      method: 'PUT',
      body: { name: 'Old Name', targetRole: 'Old Role', hoursPerWeek: 10, timelineWeeks: 8 },
    });
    replies.name = { ...replies.name, name: '  ', role: '' };
    const profile = await (await uploadResume()).json();
    assert.equal(profile.name, '');
    assert.equal(profile.targetRole, '');
  });

  it('keeps the existing profile when a new resume cannot be read', async () => {
    await api('/profile', {
      method: 'PUT',
      body: { name: 'Sam Lee', targetRole: 'Data Analyst', hoursPerWeek: 10, timelineWeeks: 8, skills: [{ name: 'SQL', proficiency: 0.9 }] },
    });
    replies.name = () => ({ text: 'not json' });
    assert.equal((await uploadResume()).status, 502);

    const profile = await (await api('/profile')).json();
    assert.equal(profile.name, 'Sam Lee');
    assert.equal(profile.targetRole, 'Data Analyst');
    assert.equal(profile.skills.length, 1);
  });

  it('rejects a file that only claims to be a PDF', async () => {
    const form = new FormData();
    form.append('resume', new Blob(['not a pdf'], { type: 'application/pdf' }), 'resume.pdf');
    const res = await fetch(`${baseUrl}/api/resume/upload`, { method: 'POST', body: form, headers: { Cookie: cookie } });
    assert.equal(res.status, 400);
    assert.equal(calls.length, 0);
  });
});

describe('changing the target role', () => {
  const setRole = (targetRole) =>
    api('/profile', { method: 'PUT', body: { targetRole, hoursPerWeek: 8, timelineWeeks: 12 } });
  const gapKeys = async () => (await (await api('/gaps')).json()).map((gap) => gap.key);

  it('shows only the gaps for the current role, and brings them back on return', async () => {
    await seedDemo();
    assert.ok((await gapKeys()).includes('tableau'));

    await setRole('Backend Developer');
    assert.deepEqual(await gapKeys(), []);

    await setRole('  data   ANALYST ');
    assert.ok((await gapKeys()).includes('tableau'));
  });

  it('saves new jobs against the current role', async () => {
    await setRole('Backend Developer');
    const job = await (await api('/jobs', { method: 'POST', body: { title: 'Analyst', text: JOB_TEXT } })).json();
    assert.equal(job.targetRole, 'Backend Developer');
    assert.equal(job.roleKey, 'backend developer');
    assert.deepEqual(await gapKeys(), ['sql']);
  });

  it('counts the limit of ten jobs for each role', async () => {
    await seedDemo();
    await setRole('Backend Developer');
    for (let index = 0; index < 10; index++) {
      const res = await api('/jobs', { method: 'POST', body: { title: `Job ${index}`, text: JOB_TEXT } });
      assert.equal(res.status, 201);
    }
    assert.equal((await api('/jobs', { method: 'POST', body: { title: 'Eleven', text: JOB_TEXT } })).status, 400);
  });

  it('can move a saved job to the current role', async () => {
    await seedDemo();
    await setRole('Backend Developer');
    const [job] = await (await api('/jobs')).json();

    const res = await api(`/jobs/${job._id}/use-for-role`, { method: 'POST' });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).targetRole, 'Backend Developer');
    assert.ok((await gapKeys()).includes('sql'));
    assert.equal((await api('/jobs/not-an-id/use-for-role', { method: 'POST' })).status, 400);
  });

  it('builds a labelled estimate when a role has no job descriptions', async () => {
    await setRole('Backend Developer');
    const res = await api('/jobs/estimate', { method: 'POST' });
    assert.equal(res.status, 201);
    const job = await res.json();
    assert.equal(job.isEstimate, true);
    assert.deepEqual(job.skills.map((skill) => skill.key), ['sql', 'rust']);
    assert.deepEqual(await gapKeys(), ['rust', 'sql']);
    assert.match(calls[0].contents[0].parts[0].text, /Backend Developer/);
  });

  it('a real job replaces the estimate, and an estimate cannot follow a real job', async () => {
    await setRole('Backend Developer');
    await api('/jobs/estimate', { method: 'POST' });
    await api('/jobs', { method: 'POST', body: { title: 'Analyst', text: JOB_TEXT } });

    const jobs = await (await api('/jobs')).json();
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].isEstimate, false);
    assert.equal((await api('/jobs/estimate', { method: 'POST' })).status, 400);
  });

  it('an estimate needs a target role', async () => {
    assert.equal((await api('/jobs/estimate', { method: 'POST' })).status, 400);
  });

  it('records which role a plan was built for, through every change', async () => {
    await seedDemo();
    const plan = await (await api('/plan/generate', { method: 'POST' })).json();
    assert.equal(plan.targetRole, 'Data Analyst');

    const finished = await (await api('/plan/check-in', { method: 'POST' })).json();
    assert.equal(finished.targetRole, 'Data Analyst');
    const restored = await (await api('/plan/restore-week', { method: 'POST' })).json();
    assert.equal(restored.targetRole, 'Data Analyst');
  });

  it('a new plan uses the new role, and projects follow it too', async () => {
    await seedDemo();
    await api('/plan/generate', { method: 'POST' });
    await setRole('Backend Developer');

    assert.equal((await api('/plan/generate', { method: 'POST' })).status, 400);
    assert.equal((await api('/projects/suggest', { method: 'POST' })).status, 400);

    await api('/jobs/estimate', { method: 'POST' });
    const rebuilt = await (await api('/plan/generate', { method: 'POST' })).json();
    assert.equal(rebuilt.targetRole, 'Backend Developer');
    assert.ok(rebuilt.weeks.flatMap((week) => week.tasks).every((task) => ['SQL', 'Rust'].includes(task.skill)));
  });

  it('keeps each person\'s jobs private when moving them', async () => {
    await seedDemo();
    const [job] = await (await api('/jobs')).json();
    const other = sessionCookie(await signUp('other@example.com'));
    assert.equal((await api(`/jobs/${job._id}/use-for-role`, { method: 'POST', cookie: other })).status, 404);
  });
});

describe('resume library', () => {
  const upload = (name, fileName = 'resume.pdf', content = '%PDF-1.4 sample') => {
    const form = new FormData();
    if (name) form.append('name', name);
    form.append('resume', new Blob([content], { type: 'application/pdf' }), fileName);
    return fetch(`${baseUrl}/api/resume/upload`, { method: 'POST', body: form, headers: { Cookie: cookie } });
  };
  const list = async () => (await api('/resumes')).json();

  it('saves up to five resumes, and refuses a sixth without calling Gemini', async () => {
    for (const name of ['One', 'Two', 'Three', 'Four', 'Five']) {
      assert.equal((await upload(name)).status, 200);
    }
    const callsSoFar = calls.length;

    const res = await upload('Six');
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /up to 5/);
    assert.equal(calls.length, callsSoFar);
    assert.equal((await list()).length, 5);
  });

  it('makes the newest upload active, and never sends the file in the list', async () => {
    await upload('One');
    await upload('Two');
    const body = await (await api('/resumes')).text();
    assert.ok(!body.includes('"data"'));
    assert.ok(!body.includes('parsed'));
    assert.deepEqual(JSON.parse(body).map((item) => [item.name, item.active]), [['One', false], ['Two', true]]);
  });

  it('switching resumes replaces the name, role and skills without calling Gemini', async () => {
    await upload('Analyst');
    replies.name = { ...replies.name, name: 'Second Person', role: 'Designer', skills: [{ name: 'Figma', level: 'strong' }] };
    await upload('Designer', 'second.pdf', '%PDF-1.4 different');
    const [first] = await list();
    const callsSoFar = calls.length;

    const res = await api(`/resumes/${first._id}/activate`, { method: 'POST' });
    assert.equal(res.status, 200);
    const profile = await res.json();

    assert.equal(profile.name, 'Alex Morgan');
    assert.equal(profile.targetRole, 'Head of Mathematics');
    assert.deepEqual(profile.skills.map((skill) => skill.key).sort(), ['excel', 'sql']);
    assert.equal(profile.resume.fileName, 'resume.pdf');
    assert.equal(calls.length, callsSoFar);
    assert.deepEqual((await list()).map((item) => item.active), [true, false]);
  });

  it('refuses a repeated name, and numbers repeated file names', async () => {
    await upload('Main resume');
    assert.equal((await upload('MAIN RESUME')).status, 409);

    await upload(undefined, 'cv.pdf');
    await upload(undefined, 'cv.pdf');
    assert.deepEqual((await list()).map((item) => item.name), ['Main resume', 'cv', 'cv (2)']);
  });

  it('returns the original file', async () => {
    await upload('One');
    const [saved] = await list();
    const res = await api(`/resumes/${saved._id}/file`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'application/pdf');
    assert.equal(await res.text(), '%PDF-1.4 sample');
  });

  it('keeps tracker history when a resume is deleted', async () => {
    await upload('Analyst resume');
    const [saved] = await list();
    const created = await api('/applications', {
      method: 'POST',
      body: { company: 'Acme', title: 'Analyst', resumeId: saved._id },
    });
    const application = await created.json();
    assert.equal(application.resumeVersion, 'Analyst resume');
    assert.equal(application.resume, saved._id);

    assert.equal((await api(`/resumes/${saved._id}`, { method: 'DELETE' })).status, 204);
    assert.equal((await list()).length, 0);

    const [kept] = await (await api('/applications')).json();
    assert.equal(kept.resumeVersion, 'Analyst resume');
    assert.equal(kept.resume, undefined);
    const insights = await (await api('/applications/insights')).json();
    const versions = insights.dimensions.find((item) => item.key === 'resumeVersion').groups;
    assert.equal(versions[0].value, 'Analyst resume');
  });

  it('a description makes no resume active', async () => {
    await upload('One');
    await api('/profile/describe', {
      method: 'POST',
      body: { text: 'I am a teacher who wants to move into data analysis as soon as I can.' },
    });
    assert.equal((await list())[0].active, false);
  });

  it('keeps each person\'s resumes private', async () => {
    await upload('Private');
    const [saved] = await list();
    const other = sessionCookie(await signUp('other@example.com'));
    const as = (path, options = {}) => api(path, { ...options, cookie: other });

    assert.deepEqual(await (await as('/resumes')).json(), []);
    assert.equal((await as(`/resumes/${saved._id}/file`)).status, 404);
    assert.equal((await as(`/resumes/${saved._id}/activate`, { method: 'POST' })).status, 404);
    assert.equal((await as(`/resumes/${saved._id}`, { method: 'DELETE' })).status, 404);
    const application = await as('/applications', {
      method: 'POST',
      body: { company: 'Acme', title: 'Analyst', resumeId: saved._id },
    });
    assert.equal(application.status, 404);
    assert.equal((await api('/resumes/not-an-id/file')).status, 400);
    assert.equal((await api('/resumes', { cookie: '' })).status, 401);
  });
});

describe('describing yourself', () => {
  const describe_ = (text) => api('/profile/describe', { method: 'POST', body: { text } });
  const STORY = 'Um so I am a teacher, I mean a head of maths, and I want to move into data analysis soon please.';

  it('fills in the goal and skills from a description', async () => {
    const res = await describe_(STORY);
    assert.equal(res.status, 200);
    const profile = await res.json();

    assert.equal(profile.name, 'Priya Sharma');
    assert.equal(profile.targetRole, 'Data Analyst');
    assert.equal(profile.hoursPerWeek, 10);
    assert.equal(profile.timelineWeeks, 16);
    assert.deepEqual(profile.skills.map((skill) => skill.key), ['excel']);
    assert.equal(profile.resume.description, 'I am a head of maths moving into data analysis.');
    assert.equal(profile.resume.fileName, 'Your description');
    assert.match(calls[0].contents[0].parts[0].text, /<document>/);
  });

  it('replaces old skills but keeps details the person did not mention', async () => {
    await api('/profile', {
      method: 'PUT',
      body: { name: 'Sam Lee', targetRole: 'Old Role', hoursPerWeek: 5, timelineWeeks: 9, skills: [{ name: 'Cobol', proficiency: 0.9 }] },
    });
    replies.cleaned = { ...replies.cleaned, name: '', role: 'Designer', hoursPerWeek: 0, timelineWeeks: 0 };

    const profile = await (await describe_(STORY)).json();
    assert.equal(profile.name, 'Sam Lee');
    assert.equal(profile.targetRole, 'Designer');
    assert.equal(profile.hoursPerWeek, 5);
    assert.equal(profile.timelineWeeks, 9);
    assert.deepEqual(profile.skills.map((skill) => skill.key), ['excel']);
  });

  it('clears the old role when the description gives no role', async () => {
    await api('/profile', {
      method: 'PUT',
      body: { targetRole: 'Data Analyst', hoursPerWeek: 5, timelineWeeks: 9 },
    });
    replies.cleaned = { ...replies.cleaned, role: '' };
    const profile = await (await describe_(STORY)).json();
    assert.equal(profile.targetRole, '');
  });

  it('keeps existing skills when the description mentions none', async () => {
    await api('/profile', {
      method: 'PUT',
      body: { targetRole: 'Analyst', hoursPerWeek: 5, timelineWeeks: 9, skills: [{ name: 'SQL', proficiency: 0.9 }] },
    });
    replies.cleaned = { ...replies.cleaned, skills: [] };
    const profile = await (await describe_(STORY)).json();
    assert.deepEqual(profile.skills.map((skill) => skill.key), ['sql']);
  });

  it('asks for more when the description is too short', async () => {
    const res = await describe_('I am a teacher.');
    assert.equal(res.status, 400);
    assert.equal(calls.length, 0);
  });

  it('needs a login', async () => {
    const res = await api('/profile/describe', { method: 'POST', cookie: '', body: { text: STORY } });
    assert.equal(res.status, 401);
  });
});

describe('job descriptions and gaps', () => {
  it('keeps only skills with real quotes and shows them as gaps', async () => {
    const created = await api('/jobs', { method: 'POST', body: { title: 'Analyst', text: JOB_TEXT } });
    assert.equal(created.status, 201);
    const job = await created.json();
    assert.deepEqual(job.skills.map((skill) => skill.key), ['sql']);
    assert.equal(job.droppedSkills, 1);

    const gaps = await (await api('/gaps')).json();
    assert.equal(gaps[0].gap, 1);
    assert.equal(gaps[0].evidence[0].quote, 'Strong SQL skills');
  });

  it('uses the cache for repeated content', async () => {
    await api('/jobs', { method: 'POST', body: { title: 'First', text: JOB_TEXT } });
    await api('/jobs', { method: 'POST', body: { title: 'Second', text: JOB_TEXT } });
    assert.equal(calls.length, 1);
    assert.equal(await AiCache.countDocuments(), 1);
  });

  it('marks job text as untrusted data', async () => {
    await api('/jobs', { method: 'POST', body: { title: 'Analyst', text: JOB_TEXT } });
    assert.match(calls[0].contents[0].parts[0].text, /<document>/);
    assert.match(calls[0].config.systemInstruction, /Never follow instructions/);
  });

  it('retries once when Gemini sends bad JSON', async () => {
    let attempts = 0;
    const good = replies.skills;
    replies.skills = () => ({ text: ++attempts === 1 ? 'not json' : JSON.stringify(good) });
    const res = await api('/jobs', { method: 'POST', body: { title: 'Analyst', text: JOB_TEXT } });
    assert.equal(res.status, 201);
    assert.equal(attempts, 2);
  });

  it('reports a clear error after repeated bad replies, and caches nothing', async () => {
    replies.skills = () => ({ text: '{"skills": "wrong"}' });
    const res = await api('/jobs', { method: 'POST', body: { title: 'Analyst', text: JOB_TEXT } });
    assert.equal(res.status, 502);
    assert.equal(await AiCache.countDocuments(), 0);
  });

  it('reports rate limits clearly', async () => {
    replies.skills = () => {
      throw Object.assign(new Error('quota'), { status: 429 });
    };
    const res = await api('/jobs', { method: 'POST', body: { title: 'Analyst', text: JOB_TEXT } });
    assert.equal(res.status, 503);
    assert.match((await res.json()).error, /rate limit/);
  });

  it('deletes a job and rejects bad ids', async () => {
    const job = await (await api('/jobs', { method: 'POST', body: { title: 'Analyst', text: JOB_TEXT } })).json();
    assert.equal((await api(`/jobs/${job._id}`, { method: 'DELETE' })).status, 204);
    assert.equal((await api(`/jobs/${job._id}`, { method: 'DELETE' })).status, 404);
    assert.equal((await api('/jobs/not-an-id', { method: 'DELETE' })).status, 400);
  });
});

describe('learning plan', () => {
  it('needs gaps first', async () => {
    await api('/profile', { method: 'PUT', body: { targetRole: 'Analyst', hoursPerWeek: 5, timelineWeeks: 4 } });
    assert.equal((await api('/plan/generate', { method: 'POST' })).status, 400);
  });

  it('builds a plan from the demo data, with hours decided by code', async () => {
    await seedDemo();
    const res = await api('/plan/generate', { method: 'POST' });
    assert.equal(res.status, 201);

    const plan = await res.json();
    assert.equal(plan.version, 1);
    assert.equal(plan.weeks.length, 12);
    for (const week of plan.weeks) {
      assert.equal(week.tasks.reduce((sum, task) => sum + task.hours, 0), 8);
    }
    assert.equal(plan.weeks[0].tasks[0].title, 'Learn joins');
    assert.match(plan.weeks[0].tasks[0].resourceUrl, /^https:\/\/www\.google\.com\/search/);
  });

  it('marks tasks done and adds a version when regenerated', async () => {
    await seedDemo();
    const plan = await (await api('/plan/generate', { method: 'POST' })).json();
    const taskId = plan.weeks[0].tasks[0]._id;

    const updated = await (await api(`/plan/tasks/${taskId}`, { method: 'PATCH', body: { done: true } })).json();
    assert.equal(updated.weeks[0].tasks[0].done, true);

    const next = await (await api('/plan/generate', { method: 'POST' })).json();
    assert.equal(next.version, 2);
    assert.equal((await (await api('/plan')).json()).version, 2);
  });
});

describe('projects', () => {
  it('keeps only skills and projects that match real gaps', async () => {
    await seedDemo();
    const res = await api('/projects/suggest', { method: 'POST' });
    assert.equal(res.status, 201);
    const projects = await res.json();
    assert.equal(projects.length, 1);
    assert.deepEqual(projects[0].skills, ['SQL', 'Tableau']);
    assert.equal((await (await api('/projects')).json()).length, 1);
  });

  it('needs gaps first', async () => {
    assert.equal((await api('/projects/suggest', { method: 'POST' })).status, 400);
  });
});

describe('interviews', () => {
  const start = async () => (await api('/interviews', { method: 'POST' })).json();
  const answer = (interview, question, text) =>
    api(`/interviews/${interview._id}/answer`, { method: 'POST', body: { questionId: question._id, answer: text } });

  it('only asks about skills from the job descriptions', async () => {
    await seedDemo();
    const interview = await start();
    assert.deepEqual(interview.questions.map((question) => question.skill), ['SQL', 'Python']);
  });

  it('scores against the rubric, updates the skill and adds practice to the plan', async () => {
    await seedDemo();
    await api('/plan/generate', { method: 'POST' });
    const interview = await start();

    const res = await answer(interview, interview.questions[0], 'I would group rows and count them.');
    assert.equal(res.status, 200);
    const { interview: updated, planChanges } = await res.json();

    assert.equal(updated.questions[0].overall, 2);
    assert.equal(updated.questions[0].scores.length, 5);
    assert.equal(updated.questions[0].scores[0].quote, 'I would group rows');
    assert.match(planChanges[0], /SQL practice added/);

    const gaps = await (await api('/gaps')).json();
    assert.equal(gaps.find((gap) => gap.key === 'sql').proficiency, 0.2);

    const plan = await (await api('/plan')).json();
    assert.equal(plan.version, 2);
    assert.equal(plan.weeks[0].tasks[0].title, 'Practice: SQL');
    assert.deepEqual(plan.changes, planChanges);
  });

  it('rejects a second answer and sets the overall when finished', async () => {
    await seedDemo();
    const interview = await start();
    await answer(interview, interview.questions[0], 'I would group rows.');
    assert.equal((await answer(interview, interview.questions[0], 'Again.')).status, 400);

    const done = await (await answer(interview, interview.questions[1], 'I would group rows.')).json();
    assert.equal(done.interview.overall, 2);
  });

  describe('practising one skill from the plan', () => {
    const focused = (body) => api('/interviews', { method: 'POST', body });

    beforeEach(() => {
      replies.questions = {
        questions: [
          { skill: 'SQL', text: 'How would you write a join?' },
          { skill: 'SQL', text: 'When would you use a subquery?' },
          { skill: 'SQL', text: 'How do you check a result?' },
          { skill: 'SQL', text: 'A fourth question.' },
        ],
      };
    });

    it('asks about that skill and the tasks from that week', async () => {
      await seedDemo();
      await api('/plan/generate', { method: 'POST' });
      const res = await focused({ skill: 'sql', week: 1 });
      assert.equal(res.status, 201);

      const interview = await res.json();
      assert.equal(interview.focusSkill, 'SQL');
      assert.equal(interview.focusWeek, 1);
      assert.equal(interview.questions.length, 3);
      assert.ok(interview.questions.every((question) => question.skill === 'SQL'));
      assert.match(calls.at(-1).contents[0].parts[0].text, /what they just studied: \["Learn joins"\]/);
    });

    it('refuses a skill that is not in the plan or not in that week', async () => {
      await seedDemo();
      await api('/plan/generate', { method: 'POST' });
      assert.equal((await focused({ skill: 'Cobol' })).status, 400);
      assert.equal((await focused({ skill: 'SQL', week: 12 })).status, 400);
    });
  });

  it('tells the scorer when an answer was spoken', async () => {
    await seedDemo();
    const interview = await start();
    await api(`/interviews/${interview._id}/answer`, {
      method: 'POST',
      body: { questionId: interview.questions[0]._id, answer: 'I would group rows', spoken: true },
    });
    assert.match(calls.at(-1).contents[0].parts[0].text, /spoken and transcribed/);

    await answer(interview, interview.questions[1], 'I would group rows.');
    assert.doesNotMatch(calls.at(-1).contents[0].parts[0].text, /spoken and transcribed/);
  });

  it('exposes the rubric', async () => {
    const rubric = await (await api('/interviews/rubric')).json();
    assert.equal(rubric.length, 5);
    assert.equal(Object.keys(rubric[0].levels).length, 5);
  });
});

describe('progress check-in', () => {
  const generate = async () => (await api('/plan/generate', { method: 'POST' })).json();
  const checkIn = async () => (await api('/plan/check-in', { method: 'POST' })).json();

  it('moves unfinished work and cuts the workload after two weak weeks', async () => {
    await seedDemo();
    await generate();

    const first = await checkIn();
    assert.equal(first.currentWeek, 2);
    assert.equal(first.hoursPerWeek, 8);
    assert.match(first.changes[0], /unfinished hours/);

    const second = await checkIn();
    assert.equal(second.currentWeek, 3);
    assert.equal(second.hoursPerWeek, 6);
    assert.ok(second.changes.some((change) => /Workload reduced from 8 to 6/.test(change)));
    assert.equal(second.weekLog.length, 2);
  });

  it('keeps the same version when the week was completed', async () => {
    await seedDemo();
    const plan = await generate();
    for (const task of plan.weeks[0].tasks) {
      await api(`/plan/tasks/${task._id}`, { method: 'PATCH', body: { done: true } });
    }
    const next = await checkIn();
    assert.equal(next.version, plan.version);
    assert.equal(next.currentWeek, 2);
  });

  it('raises a skill when all of its tasks are done', async () => {
    await seedDemo();
    const plan = await generate();
    const sqlTasks = plan.weeks.flatMap((week) => week.tasks).filter((task) => task.skill === 'SQL');
    for (const task of sqlTasks) {
      await api(`/plan/tasks/${task._id}`, { method: 'PATCH', body: { done: true } });
    }
    const gaps = await (await api('/gaps')).json();
    assert.equal(gaps.find((gap) => gap.key === 'sql').proficiency, 0.65);
  });

  it('needs a plan first', async () => {
    assert.equal((await api('/plan/check-in', { method: 'POST' })).status, 404);
  });
});

describe('restoring a finished week', () => {
  const generate = async () => (await api('/plan/generate', { method: 'POST' })).json();
  const checkIn = async () => (await api('/plan/check-in', { method: 'POST' })).json();
  const restore = () => api('/plan/restore-week', { method: 'POST' });
  const taskIds = (plan, week) => plan.weeks.find((item) => item.week === week).tasks.map((task) => task._id);

  it('puts the tasks back in their week', async () => {
    await seedDemo();
    const plan = await generate();
    const finished = await checkIn();
    assert.equal(taskIds(finished, 1).length, 0);

    const res = await restore();
    assert.equal(res.status, 200);
    const restored = await res.json();

    assert.equal(restored.currentWeek, 1);
    assert.equal(restored.weekLog.length, 0);
    assert.deepEqual(taskIds(restored, 1), taskIds(plan, 1));
    assert.equal(restored.weeks.length, plan.weeks.length);
    assert.equal(restored.reason, 'Week 1 restored');
    assert.match(restored.changes[0], /Week 1 restored/);
    assert.ok(restored.version > finished.version);
    assert.equal((await (await api('/plan')).json()).version, restored.version);
  });

  it('undoes a workload cut, one week at a time', async () => {
    await seedDemo();
    const plan = await generate();
    await checkIn();
    const cut = await checkIn();
    assert.equal(cut.hoursPerWeek, 6);

    const week2 = await (await restore()).json();
    assert.equal(week2.currentWeek, 2);
    assert.equal(week2.hoursPerWeek, 8);
    assert.equal(week2.weekLog.length, 1);

    const week1 = await (await restore()).json();
    assert.equal(week1.currentWeek, 1);
    assert.equal(week1.weekLog.length, 0);
    assert.equal(week1.weeks.length, plan.weeks.length);
    assert.deepEqual(taskIds(week1, 1), taskIds(plan, 1));
    assert.deepEqual(taskIds(week1, 2), taskIds(plan, 2));
    assert.equal((await restore()).status, 400);
  });

  it('stays correct when weeks are finished and restored repeatedly', async () => {
    await seedDemo();
    const plan = await generate();

    await checkIn();
    await checkIn();
    await restore();
    await checkIn();
    await restore();
    await restore();
    await checkIn();
    const week1 = await (await restore()).json();

    assert.equal(week1.currentWeek, 1);
    assert.deepEqual(taskIds(week1, 1), taskIds(plan, 1));
    assert.equal(week1.weeks.length, plan.weeks.length);
    assert.equal(week1.weekLog.length, 0);
  });

  it('keeps ticks made after the week was finished', async () => {
    await seedDemo();
    await generate();
    const finished = await checkIn();
    const later = finished.weeks.find((week) => week.week === 5).tasks[0];
    await api(`/plan/tasks/${later._id}`, { method: 'PATCH', body: { done: true } });

    const restored = await (await restore()).json();
    const task = restored.weeks.flatMap((week) => week.tasks).find((item) => item._id === later._id);
    assert.equal(task.done, true);
  });

  it('works when the finished week was fully completed', async () => {
    await seedDemo();
    const plan = await generate();
    for (const id of taskIds(plan, 1)) {
      await api(`/plan/tasks/${id}`, { method: 'PATCH', body: { done: true } });
    }
    await checkIn();

    const restored = await (await restore()).json();
    assert.equal(restored.currentWeek, 1);
    assert.ok(restored.weeks[0].tasks.every((task) => task.done));
  });

  it('can finish the same week again after restoring it', async () => {
    await seedDemo();
    await generate();
    await checkIn();
    await restore();
    const again = await checkIn();
    assert.equal(again.currentWeek, 2);

    const restored = await (await restore()).json();
    assert.equal(restored.currentWeek, 1);
    assert.ok(restored.weeks[0].tasks.length > 0);
  });

  it('keeps interview practice added after the week was finished', async () => {
    await seedDemo();
    await generate();
    await checkIn();
    const interview = await (await api('/interviews', { method: 'POST' })).json();
    await api(`/interviews/${interview._id}/answer`, {
      method: 'POST',
      body: { questionId: interview.questions[0]._id, answer: 'I would group rows.' },
    });

    const restored = await (await restore()).json();
    const tasks = restored.weeks.flatMap((week) => week.tasks);
    assert.ok(tasks.some((task) => task.isPractice));
    assert.equal(tasks.filter((task) => task.isPractice).length, 1);
  });

  describe('choosing what happens to unticked tasks', () => {
    const finishAsDone = async () =>
      (await api('/plan/check-in', { method: 'POST', body: { completeAll: true } })).json();

    it('marks the tasks complete and keeps them in their week', async () => {
      await seedDemo();
      const plan = await generate();
      const finished = await finishAsDone();

      assert.deepEqual(taskIds(finished, 1), taskIds(plan, 1));
      assert.ok(finished.weeks[0].tasks.every((task) => task.done));
      assert.equal(finished.weekLog[0].doneHours, finished.weekLog[0].plannedHours);
      assert.deepEqual(finished.weekLog[0].moved, []);
      assert.equal(finished.version, plan.version);
      assert.equal(finished.currentWeek, 2);
    });

    it('does not count as a weak week', async () => {
      await seedDemo();
      await generate();
      await finishAsDone();
      assert.equal((await finishAsDone()).hoursPerWeek, 8);
    });

    it('raises a skill once all of its tasks are complete', async () => {
      await seedDemo();
      await generate();
      for (let week = 0; week < 3; week++) await finishAsDone();
      const gaps = await (await api('/gaps')).json();
      assert.equal(gaps.find((gap) => gap.key === 'sql').proficiency, 0.65);
    });

    it('records moved tasks by name when the user did not finish them', async () => {
      await seedDemo();
      const plan = await generate();
      const finished = await checkIn();
      const titles = plan.weeks[0].tasks.map((task) => task.title);
      assert.deepEqual(finished.weekLog[0].moved.map((task) => task.title), titles);
      assert.equal(finished.weekLog[0].doneHours, 0);
    });

    it('restoring removes ticks made by finishing, but keeps the user\'s own', async () => {
      await seedDemo();
      const plan = await generate();
      const marked = plan.weeks[0].tasks[0];
      const own = plan.weeks[4].tasks[0];
      await api(`/plan/tasks/${own._id}`, { method: 'PATCH', body: { done: true } });
      await finishAsDone();

      const restored = await (await restore()).json();
      const task = (id) => restored.weeks.flatMap((week) => week.tasks).find((item) => item._id === id);
      assert.equal(task(own._id).done, true);
      assert.equal(task(marked._id).done, false);
    });
  });

  it('does not reach back past a rebuild', async () => {
    await seedDemo();
    await generate();
    await checkIn();
    await generate();
    assert.equal((await restore()).status, 400);
  });

  it('needs a plan and a finished week', async () => {
    assert.equal((await restore()).status, 400);
    await seedDemo();
    await generate();
    assert.equal((await restore()).status, 400);
  });
});

describe('applications', () => {
  it('tags a new application and updates its status', async () => {
    const res = await api('/applications', { method: 'POST', body: { company: 'Acme', title: 'Analyst' } });
    assert.equal(res.status, 201);
    const application = await res.json();
    assert.equal(application.roleType, 'Data Analyst');
    assert.equal(application.status, 'applied');

    const updated = await api(`/applications/${application._id}`, { method: 'PATCH', body: { status: 'interview' } });
    assert.equal((await updated.json()).status, 'interview');
    assert.equal((await api(`/applications/${application._id}`, { method: 'PATCH', body: { status: 'hired' } })).status, 400);
    assert.equal((await api(`/applications/${application._id}`, { method: 'DELETE' })).status, 204);
  });

  it('learns from the sample applications, and the advice changes with new results', async () => {
    await seedDemo();
    const before = await (await api('/applications/insights')).json();
    assert.equal(before.total, 30);
    assert.match(before.recommendations[0].text, /Focus on/);
    assert.ok(before.recommendations.some((item) => /Referral|Education/.test(item.text)));
    assert.ok(before.recommendations.every((item) => !/BI Analyst/.test(item.text) || item.type === 'avoid'));

    const list = await (await api('/applications')).json();
    const biAnalyst = list.filter((item) => item.roleType === 'BI Analyst');
    for (const item of biAnalyst) {
      await api(`/applications/${item._id}`, { method: 'PATCH', body: { status: 'interview' } });
    }
    const after = await (await api('/applications/insights')).json();
    assert.ok(after.recommendations.some((item) => item.type === 'focus' && /BI Analyst|Healthcare/.test(item.text)));
  });
});

describe('Gemini fallback', () => {
  for (const [reason, status] of [['busy', 503], ['out of quota', 429]]) {
    it(`switches to the fast model when the main model is ${reason}`, async () => {
      await seedDemo();
      const good = replies.projects;
      replies.projects = (request) => {
        if (request.model !== 'gemini-3.5-flash-lite') {
          throw Object.assign(new Error(reason), { status });
        }
        assert.equal(request.config.thinkingConfig, undefined);
        return { text: JSON.stringify(good) };
      };
      assert.equal((await api('/projects/suggest', { method: 'POST' })).status, 201);
      assert.equal(calls.length, 2);
    });
  }

  it('reports the limit clearly when both models are used up', async () => {
    await seedDemo();
    replies.projects = () => {
      throw Object.assign(new Error('quota'), { status: 429 });
    };
    const res = await api('/projects/suggest', { method: 'POST' });
    assert.equal(res.status, 503);
    assert.match((await res.json()).error, /daily limit/);
    assert.equal(calls.length, 2);
  });
});

describe('configuration', () => {
  it('explains a missing API key', async () => {
    setGeminiClient(undefined);
    const key = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    const res = await api('/jobs', { method: 'POST', body: { title: 'Analyst', text: JOB_TEXT } });
    process.env.GEMINI_API_KEY = key ?? '';
    assert.equal(res.status, 503);
    assert.match((await res.json()).error, /GEMINI_API_KEY/);
  });
});

// Must stay last: the block lasts 15 minutes, so it would lock out every test after it.
describe('login protection', () => {
  it('blocks repeated failed logins', async () => {
    let res;
    for (let attempt = 0; attempt < 12; attempt++) {
      res = await api('/auth/login', {
        method: 'POST',
        cookie: '',
        body: { email: 'person@example.com', password: 'wrong-password' },
      });
    }
    assert.equal(res.status, 429);
    assert.match((await res.json()).error, /Too many failed attempts/);
  });
});
