import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { addJob, deleteJob, estimateJobs, getGaps, getJobs, getProfile, moveJobToRole } from '../api/client.js';
import GapList from '../components/GapList.jsx';
import { useToast } from '../components/Toast.jsx';

const EMPTY_FORM = { title: '', company: '', text: '' };

const roleKey = (role = '') => role.trim().toLowerCase().replace(/\s+/g, ' ');

export default function SkillGap() {
  const [jobs, setJobs] = useState(null);
  const [gaps, setGaps] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [estimating, setEstimating] = useState(false);
  const showToast = useToast();

  async function refresh() {
    const [nextJobs, nextGaps, profile] = await Promise.all([getJobs(), getGaps(), getProfile()]);
    setJobs(nextJobs);
    setGaps(nextGaps);
    setTargetRole(profile.targetRole);
  }

  useEffect(() => {
    refresh().catch((err) => setError(err.message));
  }, []);

  async function handleAdd(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setAdding(true);
    try {
      const job = await addJob(form);
      setForm(EMPTY_FORM);
      if (job.droppedSkills > 0) {
        setNotice(`${job.droppedSkills} skill(s) were left out because their quote was not found in the job text.`);
      }
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id) {
    setError('');
    try {
      await deleteJob(id);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleEstimate() {
    setError('');
    setEstimating(true);
    try {
      await estimateJobs();
      await refresh();
      showToast(`Starter skill list ready for ${targetRole}.`);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setEstimating(false);
    }
  }

  async function handleMove(job) {
    setError('');
    try {
      await moveJobToRole(job._id);
      await refresh();
      showToast(`${job.title} now counts for ${targetRole}.`);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  if (error && !jobs) return <p className="alert">{error}</p>;
  if (!jobs) return <p className="muted">Loading job descriptions…</p>;

  const roleJobs = jobs.filter((job) => (job.roleKey ?? '') === roleKey(targetRole));
  const otherJobs = jobs.filter((job) => (job.roleKey ?? '') !== roleKey(targetRole));
  const estimated = roleJobs.some((job) => job.isEstimate);

  return (
    <>
      <h1>What the market is asking for</h1>
      <p className="lead">
        {targetRole ? `Showing skills for ${targetRole}. ` : ''}Add 5 to 10 real job descriptions. Every gap below links
        back to the words that prove it.
      </p>

      {error && <p className="alert">{error}</p>}
      {notice && <p className="notice">{notice}</p>}

      {roleJobs.length === 0 && (
        <section className="card highlight">
          {targetRole ? (
            <>
              <h2>No job descriptions for {targetRole} yet</h2>
              <p>
                Add real job descriptions below for the best result, or start now with a list of skills this role
                usually needs.
              </p>
              <button className="button" disabled={estimating} onClick={handleEstimate}>
                {estimating ? 'Building your list…' : 'Get a starter skill list'}
              </button>
            </>
          ) : (
            <>
              <h2>Set your target role first</h2>
              <p>
                Skill gaps are worked out for the role you want. <Link to="/intake">Go to your profile</Link>
              </p>
            </>
          )}
        </section>
      )}

      <div className={gaps.length > 0 ? 'layout-split' : undefined}>
        {gaps.length > 0 && (
          <div className="layout-main">
            <GapList gaps={gaps} estimated={estimated} />
            <div className="actions">
              <Link className="button" to="/plan">
                Next: build my plan
              </Link>
            </div>
          </div>
        )}

        <aside className="layout-side">
          <section className="card">
            <h2>Add a job description</h2>
            <form onSubmit={handleAdd}>
              <div className="field-grid">
                <label>
                  Job title
                  <input
                    required
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </label>
                <label>
                  Company
                  <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
                </label>
              </div>
              <label>
                Full job description
                <textarea
                  required
                  rows="7"
                  value={form.text}
                  onChange={(e) => setForm({ ...form, text: e.target.value })}
                />
              </label>
              <button className="button" disabled={adding}>
                {adding ? 'Reading the job description…' : 'Add job description'}
              </button>
            </form>
          </section>

          {roleJobs.length > 0 && (
            <section className="card">
              <h2>Job descriptions added ({roleJobs.length})</h2>
              <ul className="job-cards">
                {roleJobs.map((job) => (
                  <li key={job._id}>
                    <div className="job-card-text">
                      <strong>{job.title}</strong>
                      <span className="muted">
                        {job.company && `${job.company} · `}
                        {job.skills.length} {job.skills.length === 1 ? 'skill' : 'skills'}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Remove ${job.title}`}
                      title={`Remove ${job.title}`}
                      onClick={() => handleDelete(job._id)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {otherJobs.length > 0 && (
            <section className="card">
              <details>
                <summary>Saved for other roles ({otherJobs.length})</summary>
                <ul className="job-cards other-jobs">
                  {otherJobs.map((job) => (
                    <li key={job._id}>
                      <div className="job-card-text">
                        <strong>{job.title}</strong>
                        <span className="muted">
                          {job.targetRole ? `For ${job.targetRole}` : 'Added before role tracking'}
                          {job.company && ` · ${job.company}`}
                        </span>
                        {targetRole && !job.isEstimate && (
                          <button type="button" className="text-button use-job" onClick={() => handleMove(job)}>
                            Use for {targetRole}
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Remove ${job.title}`}
                        title={`Remove ${job.title}`}
                        onClick={() => handleDelete(job._id)}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
