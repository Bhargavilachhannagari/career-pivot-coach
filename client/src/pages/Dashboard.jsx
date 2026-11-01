import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getGaps, getInsights, getInterviews, getPlan, getProfile } from '../api/client.js';

function nextStep({ profile, gaps, plan, interviews }) {
  if (!profile.targetRole) return { to: '/intake', label: 'Set your target role' };
  if (gaps.length === 0) return { to: '/skill-gaps', label: 'Add job descriptions' };
  if (!plan) return { to: '/plan', label: 'Build your learning plan' };
  if (interviews.length === 0) return { to: '/interview', label: 'Try a mock interview' };
  return { to: '/plan', label: `Continue week ${plan.currentWeek} of your plan` };
}

function Stat({ label, value, detail, to }) {
  return (
    <Link className="stat" to={to}>
      <span className="muted">{label}</span>
      <strong>{value}</strong>
      <span className="muted">{detail}</span>
    </Link>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getProfile(), getGaps(), getPlan(), getInterviews(), getInsights()])
      .then(([profile, gaps, plan, interviews, insights]) => setData({ profile, gaps, plan, interviews, insights }))
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="alert">{error}</p>;
  if (!data) return <p className="muted">Loading your progress…</p>;

  const { profile, gaps, plan, interviews, insights } = data;
  const step = nextStep(data);
  const tasks = plan?.weeks.flatMap((week) => week.tasks) ?? [];
  const totalHours = tasks.reduce((sum, task) => sum + task.hours, 0);
  const doneHours = tasks.reduce((sum, task) => sum + (task.done ? task.hours : 0), 0);
  const scored = interviews.flatMap((item) => item.questions).filter((question) => question.answeredAt);
  const lastScore = scored.sort((a, b) => new Date(b.answeredAt) - new Date(a.answeredAt))[0];
  const topGap = gaps.find((gap) => gap.gap > 0);

  return (
    <>
      <h1>{profile.name ? `Welcome back, ${profile.name}` : 'Welcome'}</h1>
      <p className="lead">{profile.targetRole ? `Your move to ${profile.targetRole}.` : 'Your career move starts here.'}</p>

      <div className="stats">
        <Stat
          label="Plan progress"
          value={totalHours ? `${Math.round((doneHours / totalHours) * 100)}%` : 'No plan'}
          detail={plan ? `${doneHours} of ${totalHours} hours` : 'Not built yet'}
          to="/plan"
        />
        <Stat
          label="Biggest gap"
          value={topGap?.name ?? 'None yet'}
          detail={topGap ? `In ${topGap.jobCount} of ${topGap.totalJobs} jobs` : 'Add job descriptions'}
          to="/skill-gaps"
        />
        <Stat
          label="Last interview score"
          value={lastScore ? `${lastScore.overall} / 5` : 'None yet'}
          detail={lastScore?.skill ?? 'Try a mock interview'}
          to="/interview"
        />
        <Stat
          label="Response rate"
          value={insights.total ? `${Math.round(insights.overallRate * 100)}%` : 'No data'}
          detail={`${insights.responses} from ${insights.total} applications`}
          to="/tracker"
        />
      </div>

      <div className="layout-even">
        <div>
          <section className="card highlight">
            <h2>Your next step</h2>
            <Link className="button" to={step.to}>
              {step.label}
            </Link>
          </section>

          {plan?.changes.length > 0 && (
            <section className="card">
              <h2>Latest plan changes</h2>
              <ul className="change-list">
                {plan.changes.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {insights.recommendations.length > 0 && (
          <section className="card">
            <h2>Where to apply</h2>
            <ul className="change-list">
              {insights.recommendations.map((item) => (
                <li key={item.text}>{item.text}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
