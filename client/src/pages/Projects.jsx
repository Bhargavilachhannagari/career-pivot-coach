import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getProjects, suggestProjects } from '../api/client.js';

export default function Projects() {
  const [projects, setProjects] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getProjects().then(setProjects).catch((err) => setError(err.message));
  }, []);

  async function handleSuggest() {
    setError('');
    setLoading(true);
    try {
      setProjects(await suggestProjects());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!projects) return error ? <p className="alert">{error}</p> : <p className="muted">Loading projects…</p>;

  return (
    <>
      <h1>Prove it with a portfolio</h1>
      <p className="lead">
        Projects matched to your biggest <Link to="/skill-gaps">skill gaps</Link>, so each one shows an employer exactly
        what they are asking for.
      </p>

      {error && <p className="alert">{error}</p>}

      <div className="actions page-actions">
        <button className="button" disabled={loading} onClick={handleSuggest}>
          {loading ? 'Finding project ideas…' : projects.length ? 'Suggest new projects' : 'Suggest projects'}
        </button>
      </div>

      <div className="card-grid">
        {projects.map((project) => (
          <section className="card" key={project._id}>
            <h2>{project.title}</h2>
            <p>{project.summary}</p>
            <p className="muted">
              {project.difficulty} · about {project.estimatedHours} hours
            </p>
            <h3>What you will show</h3>
            <ul>
              {project.deliverables.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <h3>Gaps it covers</h3>
            <div className="tags">
              {project.skills.map((skill) => (
                <span className="tag" key={skill}>
                  {skill}
                </span>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
