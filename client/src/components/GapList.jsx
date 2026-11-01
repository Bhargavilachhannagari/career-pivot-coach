import { Link } from 'react-router-dom';

const GROUPS = [
  { priority: 'high', title: 'Learn first', hint: 'Jobs ask for these often, and you have the most to gain.' },
  { priority: 'medium', title: 'Learn next', hint: 'These are useful, but less urgent.' },
  { priority: 'low', title: 'Keep in mind', hint: 'You are close already, or few jobs ask for these.' },
];

function levelName(proficiency) {
  if (proficiency === 0) return 'Not on your profile';
  if (proficiency < 0.5) return 'Basic';
  if (proficiency < 0.8) return 'Working';
  return 'Strong';
}

function Measure({ label, value, percent, type }) {
  return (
    <div className="gap-measure">
      <div className="gap-measure-label">
        <span className="muted">{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="gap-track" aria-hidden="true">
        <div className={`gap-bar ${type}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function importanceName(importance) {
  if (importance >= 1) return 'Essential';
  return importance >= 0.7 ? 'Preferred' : 'Useful';
}

function GapCard({ gap, estimated }) {
  return (
    <li className="gap-card">
      <h4>{gap.name}</h4>
      {estimated ? (
        <Measure
          label="How important"
          value={importanceName(gap.importance)}
          percent={Math.round(gap.importance * 100)}
          type="jobs"
        />
      ) : (
        <Measure
          label="Jobs asking"
          value={`${gap.jobCount} of ${gap.totalJobs}`}
          percent={Math.round((gap.jobCount / gap.totalJobs) * 100)}
          type="jobs"
        />
      )}
      <Measure
        label="Your level"
        value={levelName(gap.proficiency)}
        percent={Math.round(gap.proficiency * 100)}
        type="level"
      />
      {!estimated && (
        <details className="gap-evidence">
          <summary>What the jobs said</summary>
          <ul className="evidence">
            {gap.evidence.map((item) => (
              <li key={`${item.jobId}-${item.quote}`}>
                <q>{item.quote}</q> <span className="muted">{item.jobTitle}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <Link className="button secondary gap-plan-link" to={`/plan?skill=${encodeURIComponent(gap.name)}`}>
        See in my plan
      </Link>
    </li>
  );
}

export default function GapList({ gaps, estimated }) {
  const top = gaps[0];
  const topLevel =
    top.proficiency === 0 ? "it isn't on your profile yet" : `your level is ${levelName(top.proficiency)}`;

  return (
    <>
      <section className="card highlight">
        <h2>Start with {top.name}</h2>
        <p className="gap-summary">
          {estimated ? 'It is usually asked for in this role' : `${top.jobCount} of ${top.totalJobs} jobs ask for it`}, and{' '}
          {topLevel}.
        </p>
      </section>

      {estimated && (
        <p className="notice">
          This is an AI estimate of what this role usually asks for, not real job adverts. Add real job descriptions for
          a more accurate result.
        </p>
      )}

      <section className="card">
        <h2>What to learn, in order</h2>
        <p className="muted">
          Skills are ranked by how many jobs ask for them, how essential they are, and how far you are from them.
        </p>
        <div className="gap-key">
          <span>
            <i className="gap-swatch jobs" /> {estimated ? 'How important it is' : 'Jobs asking for the skill'}
          </span>
          <span>
            <i className="gap-swatch level" /> Your level
          </span>
        </div>

        {GROUPS.map(({ priority, title, hint }) => {
          const group = gaps.filter((gap) => gap.priority === priority);
          if (group.length === 0) return null;

          return (
            <div className="gap-group" key={priority}>
              <h3>
                {title} <span className="muted">({group.length})</span>
              </h3>
              <p className="muted gap-hint">{hint}</p>
              <ul className="gap-cards">
                {group.map((gap) => (
                  <GapCard key={gap.key} gap={gap} estimated={estimated} />
                ))}
              </ul>
            </div>
          );
        })}
      </section>
    </>
  );
}
