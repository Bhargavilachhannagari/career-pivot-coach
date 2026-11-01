import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { answerQuestion, getInterviews, getRubric, startInterview } from '../api/client.js';
import { MicButton, ModeTabs } from '../components/VoiceInput.jsx';
import { useDictation } from '../hooks/useDictation.js';

const ANSWER_MODES = [
  { value: 'speak', label: 'Speak my answer' },
  { value: 'type', label: 'Type my answer' },
];

const isUnfinished = (item) => item.overall === undefined || item.overall === null;

function ScoreCard({ question }) {
  return (
    <section className="card">
      <div className="score-header">
        <div>
          <span className="tag">{question.skill}</span>
          <h2>{question.text}</h2>
        </div>
        <div className="score-total">
          <strong>{question.overall}</strong>
          <span className="muted">out of 5</span>
        </div>
      </div>
      <p>{question.summary}</p>
      <p>
        <strong>Try this next:</strong> {question.improvement}
      </p>
      <div className="table-wrap">
        <table className="table-stack">
          <thead>
            <tr>
              <th>Area</th>
              <th>Score</th>
              <th>Feedback and evidence</th>
            </tr>
          </thead>
          <tbody>
            {question.scores.map((item) => (
              <tr key={item.criterion}>
                <td>{item.label}</td>
                <td data-label="Score">{item.score} / 5</td>
                <td className="wrap">
                  {item.feedback}
                  {item.quote ? (
                    <q className="quote">{item.quote}</q>
                  ) : (
                    <span className="quote muted">Nothing in your answer backed this up, so it cannot score above 2.</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function Interview() {
  const [interviews, setInterviews] = useState(null);
  const [rubric, setRubric] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [answer, setAnswer] = useState('');
  const [planChanges, setPlanChanges] = useState([]);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [answerMode, setAnswerMode] = useState('speak');
  const [searchParams, setSearchParams] = useSearchParams();
  const dictation = useDictation(setAnswer);
  const focusSkill = searchParams.get('skill');
  const focusWeek = Number(searchParams.get('week')) || undefined;

  useEffect(() => {
    Promise.all([getInterviews(), getRubric()])
      .then(([list, levels]) => {
        setInterviews(list);
        setRubric(levels);
      })
      .catch((err) => setError(err.message));
  }, []);

  // A practice session from the plan resumes only an interview on that same skill.
  useEffect(() => {
    if (!interviews) return;
    const unfinished = interviews.find(
      (item) => isUnfinished(item) && (!focusSkill || item.focusSkill?.toLowerCase() === focusSkill.toLowerCase()),
    );
    setActiveId((current) => (focusSkill || !current ? (unfinished?._id ?? null) : current));
  }, [interviews === null, focusSkill]);

  if (!interviews) return error ? <p className="alert">{error}</p> : <p className="muted">Loading interviews…</p>;

  const active = interviews.find((item) => item._id === activeId);
  const nextQuestion = active?.questions.find((question) => !question.answeredAt);
  const answered = active?.questions.filter((question) => question.answeredAt) ?? [];
  const finished = interviews.filter((item) => !isUnfinished(item));

  function changeAnswerMode(next) {
    dictation.stop();
    setAnswerMode(next);
  }

  async function handleStart() {
    setError('');
    setPlanChanges([]);
    setStarting(true);
    try {
      const interview = await startInterview(focusSkill ? { skill: focusSkill, week: focusWeek } : undefined);
      setInterviews([interview, ...interviews]);
      setActiveId(interview._id);
    } catch (err) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  }

  async function handleAnswer(event) {
    event.preventDefault();
    dictation.stop();
    setError('');
    setSubmitting(true);
    try {
      const result = await answerQuestion(active._id, nextQuestion._id, answer, answerMode === 'speak');
      setInterviews(interviews.map((item) => (item._id === result.interview._id ? result.interview : item)));
      setPlanChanges(result.planChanges);
      setAnswer('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <h1>Practise the interview</h1>
      <p className="lead">Questions come from your job descriptions, and every score must quote your own words.</p>

      {error && <p className="alert">{error}</p>}

      <div className="layout-split">
        <div className="layout-main">
          {planChanges.length > 0 && (
            <section className="card highlight">
              <h2>Your plan changed</h2>
              <ul className="change-list">
                {planChanges.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
              <Link to="/plan">See your updated plan</Link>
            </section>
          )}

          {!nextQuestion && focusSkill && (
            <section className="card highlight">
              <h2>Practise {focusSkill}</h2>
              <p>
                Answer 3 questions based on your {focusWeek ? `week ${focusWeek} tasks` : 'plan'}, so you can check you
                are ready.
              </p>
              <div className="actions">
                <button className="button" disabled={starting} onClick={handleStart}>
                  {starting ? 'Writing your questions…' : 'Start this interview'}
                </button>
                <button type="button" className="text-button" onClick={() => setSearchParams({})}>
                  Practise all skills instead
                </button>
              </div>
            </section>
          )}

          {!nextQuestion && !focusSkill && (
            <div className="actions page-actions">
              <button className="button" disabled={starting} onClick={handleStart}>
                {starting ? 'Writing your questions…' : 'Start a mock interview'}
              </button>
            </div>
          )}

          {nextQuestion && (
            <section className="card">
              <p className="muted">
                Question {answered.length + 1} of {active.questions.length}
              </p>
              <span className="tag">{nextQuestion.skill}</span>
              <h2 className="question">{nextQuestion.text}</h2>
              <form onSubmit={handleAnswer}>
                <ModeTabs label="How to answer" options={ANSWER_MODES} value={answerMode} onChange={changeAnswerMode} />
                {answerMode === 'speak' && <MicButton dictation={dictation} text={answer} />}
                <label className="story-box">
                  {answerMode === 'speak' ? 'What you said (you can correct it before submitting)' : 'Your answer'}
                  <textarea required rows="7" value={answer} onChange={(e) => setAnswer(e.target.value)} />
                </label>
                <button className="button" disabled={submitting}>
                  {submitting ? 'Scoring your answer…' : 'Submit answer'}
                </button>
              </form>
            </section>
          )}

          {[...answered].reverse().map((question) => (
            <ScoreCard key={question._id} question={question} />
          ))}
        </div>

        <aside className="layout-side">
          {finished.length > 0 && (
            <section className="card">
              <h2>Past interviews</h2>
              <ul className="job-list">
                {finished.map((item) => (
                  <li key={item._id}>
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                    <span>
                      <strong>{item.overall}</strong> out of 5
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card">
            <details>
              <summary>How answers are scored</summary>
              {rubric.map((area) => (
                <div key={area.key}>
                  <h3>{area.label}</h3>
                  <ol className="rubric-levels">
                    {Object.entries(area.levels).map(([score, text]) => (
                      <li key={score}>{text}</li>
                    ))}
                  </ol>
                </div>
              ))}
            </details>
          </section>
        </aside>
      </div>
    </>
  );
}
