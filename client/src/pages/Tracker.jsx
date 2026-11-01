import { useEffect, useState } from 'react';
import {
  addApplication,
  deleteApplication,
  getApplications,
  getInsights,
  getResumes,
  updateApplication,
} from '../api/client.js';
import RateChart from '../components/RateChart.jsx';

const STATUSES = [
  { value: 'applied', label: 'Applied' },
  { value: 'no_response', label: 'No response' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'response', label: 'Got a reply' },
  { value: 'interview', label: 'Interview' },
  { value: 'offer', label: 'Offer' },
];

const EMPTY_FORM = { company: '', title: '', source: 'Job board', resumeVersion: 'Main', description: '' };

const percent = (rate) => `${Math.round(rate * 100)}%`;

export default function Tracker() {
  const [applications, setApplications] = useState(null);
  const [insights, setInsights] = useState(null);
  const [resumes, setResumes] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  async function refresh() {
    const [list, nextInsights, saved] = await Promise.all([getApplications(), getInsights(), getResumes()]);
    setApplications(list);
    setInsights(nextInsights);
    setResumes(saved);
  }

  useEffect(() => {
    refresh().catch((err) => setError(err.message));
  }, []);

  if (!applications) return error ? <p className="alert">{error}</p> : <p className="muted">Loading applications…</p>;

  async function run(action) {
    setError('');
    try {
      await action();
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAdd(event) {
    event.preventDefault();
    setAdding(true);
    await run(async () => {
      const { resumeId, ...details } = form;
      const chosen = resumeId ?? activeResumeId;
      await addApplication(
        resumes.length > 0 ? { ...details, resumeVersion: 'Other', ...(chosen && { resumeId: chosen }) } : details,
      );
      setForm(EMPTY_FORM);
    });
    setAdding(false);
  }

  const activeResumeId = resumes.find((resume) => resume.active)?._id ?? resumes[0]?._id ?? '';
  const setField = (field) => (event) => setForm({ ...form, [field]: event.target.value });
  const hasSamples = applications.some((item) => item.isSample);
  const roleTypes = insights.dimensions
    .find((dimension) => dimension.key === 'roleType')
    .groups.filter((group) => group.enoughData);

  return (
    <>
      <h1>What is getting responses</h1>
      <p className="lead">Log every application and this page learns which kinds of roles reply to you.</p>

      {error && <p className="alert">{error}</p>}
      {hasSamples && (
        <p className="notice">
          This includes {applications.filter((item) => item.isSample).length} sample applications for the demo. They are
          not real results.
        </p>
      )}

      {applications.length > 0 && (
        <div className="layout-split side-left">
          <aside className="layout-side">
            <section className="card highlight">
              <h2>What to do next</h2>
              {insights.recommendations.length === 0 ? (
                <p className="muted">
                  Keep logging applications. Advice starts once a group has {insights.minSample} applications.
                </p>
              ) : (
                <ul className="change-list">
                  {insights.recommendations.map((item) => (
                    <li key={item.text}>{item.text}</li>
                  ))}
                </ul>
              )}
            </section>
          </aside>

          <section className="card layout-main">
            <h2>Response rate by role type</h2>
            <p className="muted">
              {insights.responses} responses from {insights.total} applications. Rates are smoothed, so one lucky reply
              does not look like 100%. The chart shows role types with at least {insights.minSample} applications.
            </p>
            {roleTypes.length > 0 ? (
              <RateChart groups={roleTypes} />
            ) : (
              <p className="muted">No role type has enough applications to chart yet.</p>
            )}

            {insights.dimensions.map((dimension) => (
              <details key={dimension.key} className="dimension">
                <summary>{dimension.label}</summary>
                <div className="table-wrap">
                  <table className="table-stack">
                    <thead>
                      <tr>
                        <th>{dimension.label}</th>
                        <th>Applications</th>
                        <th>Responses</th>
                        <th>Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dimension.groups.map((group) => (
                        <tr key={group.value}>
                          <td>{group.value}</td>
                          <td data-label="Applications">{group.applications}</td>
                          <td data-label="Responses">{group.responses}</td>
                          <td data-label="Rate">{group.enoughData ? percent(group.rate) : 'Too few to judge'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </section>
        </div>
      )}

      <div className="layout-split side-left">
        <aside className="layout-side">
          <section className="card">
            <h2>Add an application</h2>
            <form onSubmit={handleAdd}>
              <div className="field-grid">
                <label>
                  Company
                  <input required value={form.company} onChange={setField('company')} />
                </label>
                <label>
                  Job title
                  <input required value={form.title} onChange={setField('title')} />
                </label>
                <label>
                  Where you found it
                  <input required value={form.source} onChange={setField('source')} />
                </label>
                <label>
                  Resume used
                  {resumes.length > 0 ? (
                    <select value={form.resumeId ?? activeResumeId} onChange={setField('resumeId')}>
                      {resumes.map((resume) => (
                        <option key={resume._id} value={resume._id}>
                          {resume.name}
                        </option>
                      ))}
                      <option value="">Other resume</option>
                    </select>
                  ) : (
                    <input required value={form.resumeVersion} onChange={setField('resumeVersion')} />
                  )}
                </label>
              </div>
              <label>
                Job description (optional)
                <textarea rows="3" value={form.description} onChange={setField('description')} />
              </label>
              <button className="button" disabled={adding}>
                {adding ? 'Adding…' : 'Add application'}
              </button>
            </form>
          </section>
        </aside>

        {applications.length > 0 && (
          <section className="card layout-main">
            <h2>Your applications ({applications.length})</h2>
            <ul className="application-list">
              {applications.map((item) => (
                <li key={item._id}>
                  <span>
                    <strong>{item.title}</strong>
                    <span className="task-description">
                      {item.company} · {item.seniority} · {item.industry} · {item.source} · {item.resumeVersion}
                    </span>
                  </span>
                  <select
                    aria-label={`Status for ${item.title} at ${item.company}`}
                    value={item.status}
                    onChange={(e) => run(() => updateApplication(item._id, e.target.value))}
                  >
                    {STATUSES.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                  <button className="link" onClick={() => run(() => deleteApplication(item._id))}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
