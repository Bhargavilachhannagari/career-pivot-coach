import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { checkInWeek, generatePlan, getPlan, getProfile, restoreWeek, updateTask } from '../api/client.js';
import { useToast } from '../components/Toast.jsx';

const sameSkill = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
const sameRole = (a = '', b = '') => a.trim().toLowerCase().replace(/\s+/g, ' ') === b.trim().toLowerCase().replace(/\s+/g, ' ');

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

function FocusBanner({ skill, tasks, weeks, deferred, onClear }) {
  if (tasks.length === 0) {
    return (
      <div className="plan-focus empty" role="status">
        <p>
          <strong>{skill}</strong> is not in your plan.{' '}
          {deferred
            ? 'It was left out because of the hours you have. Add more hours in your profile, then rebuild the plan.'
            : 'Rebuild the plan to include your latest skill gaps.'}
        </p>
        <button type="button" className="text-button" onClick={onClear}>
          Show all
        </button>
      </div>
    );
  }

  const hours = tasks.reduce((sum, task) => sum + task.hours, 0);
  const done = tasks.filter((task) => task.done).length;

  return (
    <div className="plan-focus" role="status">
      <p>
        <strong>{tasks[0].skill}</strong>: {plural(tasks.length, 'task')}, {plural(hours, 'hour')}
        {done > 0 && `, ${done} done`}, {weeks.length === 1 ? 'week' : 'weeks'} {weeks.join(', ')}
      </p>
      <button type="button" className="text-button" onClick={onClear}>
        Show all
      </button>
    </div>
  );
}

export default function Plan() {
  const [plan, setPlan] = useState(undefined);
  const [targetRole, setTargetRole] = useState('');
  const [generating, setGenerating] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [askingFinish, setAskingFinish] = useState(false);
  const [error, setError] = useState('');
  const showToast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const scrolledTo = useRef(null);
  const focusSkill = searchParams.get('skill');

  useEffect(() => {
    Promise.all([getPlan(), getProfile()])
      .then(([loaded, profile]) => {
        setPlan(loaded);
        setTargetRole(profile.targetRole);
      })
      .catch((err) => setError(err.message));
  }, []);

  // Scrolls once per skill, so ticking a task does not move the page.
  useEffect(() => {
    if (!focusSkill) {
      scrolledTo.current = null;
      return;
    }
    if (!plan || scrolledTo.current === focusSkill) return;
    scrolledTo.current = focusSkill;
    const target = document.querySelector('.task-highlight:not(.done)') ?? document.querySelector('.task-highlight');
    target?.scrollIntoView({ block: 'center' });
  }, [focusSkill, plan]);

  async function handleGenerate() {
    setError('');
    setGenerating(true);
    try {
      setPlan(await generatePlan());
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function finishWeek(completeAll) {
    setError('');
    setAskingFinish(false);
    setCheckingIn(true);
    try {
      const finishedWeek = plan.currentWeek;
      setPlan(await checkInWeek(completeAll));
      showToast(`Week ${finishedWeek} finished.`);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setCheckingIn(false);
    }
  }

  async function handleRestore() {
    setError('');
    setRestoring(true);
    try {
      const restored = await restoreWeek();
      setPlan(restored);
      showToast(`Week ${restored.currentWeek} restored.`);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setRestoring(false);
    }
  }

  async function handleToggle(task) {
    setError('');
    try {
      const done = !task.done;
      await updateTask(task._id, done);
      // Only this task changes, so quick ticks in a row cannot undo each other on screen.
      setPlan((current) => ({
        ...current,
        weeks: current.weeks.map((week) => ({
          ...week,
          tasks: week.tasks.map((item) => (item._id === task._id ? { ...item, done } : item)),
        })),
      }));
    } catch (err) {
      setError(err.message);
    }
  }

  if (plan === undefined) return error ? <p className="alert">{error}</p> : <p className="muted">Loading your plan…</p>;

  if (!plan) {
    return (
      <>
        <h1>Your week-by-week plan</h1>
        <p className="lead">
          Built from your biggest gaps and the hours you have. Add job descriptions in{' '}
          <Link to="/skill-gaps">Skill gaps</Link> first.
        </p>
        {error && <p className="alert">{error}</p>}
        {focusSkill && <p className="notice">Build your plan to see the tasks for {focusSkill}.</p>}
        <button className="button" disabled={generating} onClick={handleGenerate}>
          {generating ? 'Building your plan…' : 'Build my plan'}
        </button>
      </>
    );
  }

  const tasks = plan.weeks.flatMap((week) => week.tasks);
  const totalHours = tasks.reduce((sum, task) => sum + task.hours, 0);
  const doneHours = tasks.reduce((sum, task) => sum + (task.done ? task.hours : 0), 0);
  const percent = totalHours ? Math.round((doneHours / totalHours) * 100) : 0;
  const matches = (task) => Boolean(focusSkill) && sameSkill(task.skill, focusSkill);
  const focusWeeks = plan.weeks.filter((week) => week.tasks.some(matches));
  const lastFinished = plan.weekLog.at(-1)?.week;
  const unticked = plan.weeks.find((week) => week.week === plan.currentWeek)?.tasks.filter((task) => !task.done) ?? [];
  const completed = plan.weeks.flatMap((week) =>
    week.tasks.filter((task) => task.done).map((task) => ({ ...task, week: week.week })),
  );

  return (
    <>
      <h1>Your week-by-week plan</h1>
      <p className="lead">
        Version {plan.version}: {plan.reason}. {plan.weeks.length} weeks at {plan.hoursPerWeek} hours a week.
      </p>

      {error && <p className="alert">{error}</p>}

      {targetRole && !sameRole(plan.targetRole, targetRole) && (
        <section className="card highlight">
          <h2>Your target role is now {targetRole}</h2>
          <p>
            This plan was built for {plan.targetRole || 'an earlier role'}. Rebuild it to match your new role and skill
            gaps. Your current plan stays saved as an earlier version.
          </p>
          <div className="actions">
            <button className="button" disabled={generating} onClick={handleGenerate}>
              {generating ? 'Rebuilding…' : `Rebuild plan for ${targetRole}`}
            </button>
            <Link to="/skill-gaps">Check skill gaps first</Link>
          </div>
        </section>
      )}

      {focusSkill && (
        <FocusBanner
          skill={focusSkill}
          tasks={tasks.filter(matches)}
          weeks={focusWeeks.map((week) => week.week)}
          deferred={plan.deferredSkills.some((skill) => sameSkill(skill, focusSkill))}
          onClear={() => setSearchParams({}, { replace: true })}
        />
      )}

      <div className={focusSkill ? 'layout-split side-left has-focus' : 'layout-split side-left'}>
        <aside className="layout-side sticky">
          {plan.changes.length > 0 && (
            <section className="card highlight">
              <h2>What changed in version {plan.version}, and why</h2>
              <ul className="change-list">
                {plan.changes.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="card">
            <div className="progress-label">
              <strong>{percent}% complete</strong>
              <span className="muted">
                {doneHours} of {totalHours} hours
              </span>
            </div>
            <div
              className="progress"
              role="progressbar"
              aria-label="Plan progress"
              aria-valuenow={percent}
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <div style={{ width: `${percent}%` }} />
            </div>
            {plan.deferredSkills.length > 0 && (
              <p className="muted">
                Left out for now, because of the hours available: {plan.deferredSkills.join(', ')}.
              </p>
            )}
            <div className="actions">
              <button
                className="button"
                disabled={checkingIn}
                onClick={() => (unticked.length > 0 ? setAskingFinish(true) : finishWeek(false))}
              >
                {checkingIn ? 'Checking your progress…' : `Finish week ${plan.currentWeek}`}
              </button>
              {lastFinished && (
                <button className="button secondary" disabled={restoring} onClick={handleRestore}>
                  {restoring ? 'Restoring…' : `Restore week ${lastFinished}`}
                </button>
              )}
              <button className="button secondary" disabled={generating} onClick={handleGenerate}>
                {generating ? 'Rebuilding…' : 'Rebuild plan'}
              </button>
              <span className="muted">Rebuilding creates a new version and clears the ticks.</span>
            </div>
            {askingFinish && (
              <div className="finish-check" role="group" aria-label={`Finish week ${plan.currentWeek}`}>
                <p>
                  <strong>
                    Did you complete the {plural(unticked.length, 'unticked task')} in week {plan.currentWeek}?
                  </strong>
                </p>
                <div className="actions">
                  <button className="button" onClick={() => finishWeek(true)}>
                    Yes, mark complete
                  </button>
                  <button className="button secondary" onClick={() => finishWeek(false)}>
                    No, move them later
                  </button>
                  <button type="button" className="text-button" onClick={() => setAskingFinish(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>

          {completed.length > 0 && (
            <section className="card">
              <details>
                <summary>Completed so far ({completed.length})</summary>
                <ul className="completed-list">
                  {completed.map((task) => (
                    <li key={task._id}>
                      <strong>{task.title}</strong>
                      <span className="muted">
                        Week {task.week} · {task.skill} · {task.hours} h
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            </section>
          )}
        </aside>

        <div className="layout-main week-grid">
          {plan.weeks.map((week) => {
            const log = plan.weekLog.find((item) => item.week === week.week);
            const weekSkills = [...new Set(week.tasks.map((task) => task.skill))];

            return (
              <section
                key={week.week}
                className={[
                  'card',
                  week.week < plan.currentWeek && 'past',
                  focusWeeks.includes(week) && 'week-focus',
                  focusWeeks.length > 0 && !focusWeeks.includes(week) && 'week-dimmed',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <h2>
                  <span className="week-number">Week {week.week}</span> {week.theme}
                  {week.week === plan.currentWeek && <span className="tag current">This week</span>}
                </h2>
                {log && (
                  <p className="muted week-log">
                    Completed {log.doneHours} of {log.plannedHours} hours.
                    {log.doneHours < log.plannedHours &&
                      log.moved.length === 0 &&
                      ' Unfinished work moved to later weeks.'}
                  </p>
                )}
                {log?.moved.length > 0 && (
                  <div className="moved-tasks">
                    <strong>Moved to later weeks</strong>
                    <ul>
                      {log.moved.map((task) => (
                        <li key={task.title}>
                          {task.title}{' '}
                          <span className="muted">
                            ({task.skill}, {task.hours} h)
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <ul className="task-list">
                  {week.tasks.map((task) => (
                    <li
                      key={task._id}
                      className={[task.done && 'done', matches(task) && 'task-highlight'].filter(Boolean).join(' ')}
                    >
                      <label>
                        <input type="checkbox" checked={task.done} onChange={() => handleToggle(task)} />
                        <span>
                          <strong>{task.title}</strong>
                          <span className="task-description">{task.description}</span>
                        </span>
                      </label>
                      <span className="task-meta">
                        <span className="tag">{task.skill}</span>
                        {task.isPractice && <span className="tag practice">Added after interview</span>}
                        <span className="muted">{task.hours} h</span>
                        <a href={task.resourceUrl} target="_blank" rel="noreferrer">
                          Find resources
                        </a>
                      </span>
                    </li>
                  ))}
                </ul>
                {weekSkills.length > 0 && (
                  <div className="week-interview">
                    <strong>Practise for interviews</strong>
                    <span className="muted">Questions based on this week's tasks.</span>
                    <div className="week-interview-links">
                      {weekSkills.map((skill) => {
                        const ready = week.tasks.filter((task) => task.skill === skill).every((task) => task.done);
                        const query = new URLSearchParams({ skill, week: week.week });

                        return (
                          <Link
                            key={skill}
                            className={ready ? 'button interview-link' : 'button secondary interview-link'}
                            to={`/interview?${query}`}
                          >
                            {ready ? `${skill}: ready to practise` : `${skill} interview`}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
