import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  activateResume,
  deleteResume,
  describeProfile,
  getProfile,
  getResumes,
  resumeFileUrl,
  updateProfile,
  uploadResume,
} from '../api/client.js';
import { useToast } from '../components/Toast.jsx';
import { ModeTabs } from '../components/VoiceInput.jsx';

const WISPR_FLOW_URL = 'https://wisprflow.ai';
const MAX_RESUMES = 5;

const LEVELS = [
  { value: 0, label: 'None' },
  { value: 0.35, label: 'Basic' },
  { value: 0.65, label: 'Working' },
  { value: 0.9, label: 'Strong' },
];

const SOURCES = [
  { value: 'describe', label: 'Describe yourself' },
  { value: 'resume', label: 'Upload resume' },
];

const closestLevel = (proficiency) =>
  LEVELS.reduce((best, level) =>
    Math.abs(level.value - proficiency) < Math.abs(best.value - proficiency) ? level : best,
  ).value;

export default function Intake() {
  const [profile, setProfile] = useState(null);
  const [newSkill, setNewSkill] = useState('');
  const [unsaved, setUnsaved] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [source, setSource] = useState('describe');
  const [story, setStory] = useState('');
  const [describing, setDescribing] = useState(false);
  const [resumes, setResumes] = useState([]);
  const [resumeName, setResumeName] = useState('');
  const [switchingTo, setSwitchingTo] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(null);
  const showToast = useToast();

  useEffect(() => {
    Promise.all([getProfile(), getResumes()])
      .then(([loaded, saved]) => {
        setProfile(loaded);
        setResumes(saved);
        setStory(loaded.resume?.description ?? '');
        if (loaded.resume && !loaded.resume.description) setSource('resume');
      })
      .catch((err) => setError(err.message));
  }, []);

  if (error && !profile) return <p className="alert">{error}</p>;
  if (!profile) return <p className="muted">Loading your profile…</p>;

  const setField = (field, value) => {
    setUnsaved(true);
    setProfile({ ...profile, [field]: value });
  };

  const setSkillLevel = (name, proficiency) =>
    setField('skills', profile.skills.map((skill) => (skill.name === name ? { ...skill, proficiency } : skill)));

  const removeSkill = (name) => setField('skills', profile.skills.filter((skill) => skill.name !== name));

  function addSkill(event) {
    event.preventDefault();
    const name = newSkill.trim();
    if (!name) return;
    if (!profile.skills.some((skill) => skill.name.toLowerCase() === name.toLowerCase())) {
      setField('skills', [...profile.skills, { name, proficiency: 0.35 }]);
    }
    setNewSkill('');
  }

  async function handleUpload(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;

    setError('');
    setUploading(true);
    try {
      const updated = await uploadResume(file, resumeName.trim());
      setResumes(await getResumes());
      setResumeName('');
      // A resume says nothing about hours or timeline, so those stay as they are.
      setProfile((current) => ({
        ...updated,
        hoursPerWeek: current.hoursPerWeek,
        timelineWeeks: current.timelineWeeks,
      }));
      setNewSkill('');
      setUnsaved(true);
      showToast('Resume read. Your name, role and skills were updated. Check them, then save.');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUploading(false);
    }
  }

  async function handleActivate(resume) {
    setSwitchingTo(resume._id);
    try {
      const updated = await activateResume(resume._id);
      setProfile((current) => ({
        ...updated,
        hoursPerWeek: current.hoursPerWeek,
        timelineWeeks: current.timelineWeeks,
      }));
      setResumes(await getResumes());
      setUnsaved(false);
      showToast(`Now using ${resume.name}. Your name, role and skills were updated.`);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSwitchingTo(null);
    }
  }

  async function handleDeleteResume(resume) {
    setConfirmingDelete(null);
    try {
      await deleteResume(resume._id);
      setResumes(await getResumes());
      showToast(`${resume.name} deleted. Your tracker history was kept.`);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleDescribe() {
    setDescribing(true);
    try {
      const updated = await describeProfile(story);
      setProfile(updated);
      setStory(updated.resume.description);
      setResumes(await getResumes());
      setUnsaved(false);
      showToast('Your goal and skills were updated. Check them, then save any changes.');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setDescribing(false);
    }
  }

  async function handleSave(event) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const { name, targetRole, hoursPerWeek, timelineWeeks, skills } = profile;
      setProfile(
        await updateProfile({
          name,
          targetRole,
          hoursPerWeek: Number(hoursPerWeek),
          timelineWeeks: Number(timelineWeeks),
          skills: skills.map(({ name: skillName, proficiency }) => ({ name: skillName, proficiency })),
        }),
      );
      setUnsaved(false);
      showToast('Profile saved.');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <h1>Where are you heading?</h1>
      <p className="lead">Tell us about the move you want to make. Everything else is built from this.</p>

      {error && <p className="alert">{error}</p>}

      <form onSubmit={handleSave}>
        <div className="layout-even row-stretch">
          <section className="card">
            <h2>Tell us about you</h2>
            <ModeTabs label="How to add your background" options={SOURCES} value={source} onChange={setSource} />

            {source === 'describe' ? (
              <>
                <p className="muted field-note">
                  Say what you do now, your skills, the role you want, and how many hours a week you have.
                </p>
                <div className="wispr-tip">
                  <p>
                    <strong>For better results, dictate with Wispr Flow.</strong> Install the desktop app, click in the
                    box below, and speak using your Wispr shortcut. It removes filler words as you talk.
                  </p>
                  <a className="button secondary" href={WISPR_FLOW_URL} target="_blank" rel="noreferrer">
                    Get Wispr Flow
                  </a>
                </div>
                <label className="story-box">
                  Your description
                  <textarea
                    rows="6"
                    placeholder="Dictate here with Wispr Flow, or type"
                    value={story}
                    onChange={(e) => setStory(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="button story-submit"
                  disabled={describing || !story.trim()}
                  onClick={handleDescribe}
                >
                  {describing ? 'Reading your description…' : 'Update my goal and skills'}
                </button>
              </>
            ) : (
              <>
                <p className="muted field-note">
                  Save up to {MAX_RESUMES} resumes, such as one for each kind of job. The active resume fills in your
                  name, target role and skills, and the Tracker shows which resume gets replies.
                </p>

                {resumes.length < MAX_RESUMES ? (
                  <>
                    <label className="resume-name">
                      Resume name (optional)
                      <input
                        maxLength="60"
                        placeholder="e.g. Data Analyst resume"
                        value={resumeName}
                        onChange={(e) => setResumeName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                      />
                    </label>
                    <label className="button secondary upload-button">
                      {uploading ? 'Reading your resume…' : 'Add a resume (PDF)'}
                      <input type="file" accept="application/pdf" hidden disabled={uploading} onChange={handleUpload} />
                    </label>
                  </>
                ) : (
                  <p className="notice">You have {MAX_RESUMES} resumes saved. Delete one to add another.</p>
                )}

                {resumes.length > 0 && (
                  <>
                    <h3>
                      My resumes ({resumes.length} of {MAX_RESUMES})
                    </h3>
                    <ul className="resume-list">
                      {resumes.map((resume) => (
                        <li key={resume._id} className={resume.active ? 'active' : undefined}>
                          <div className="resume-info">
                            <strong>{resume.name}</strong>
                            {resume.active && <span className="tag">Active</span>}
                            <span className="muted">
                              {resume.fileName} · {new Date(resume.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          {confirmingDelete === resume._id ? (
                            <div className="resume-actions">
                              <span>Delete this resume?</span>
                              <button type="button" className="text-button" onClick={() => handleDeleteResume(resume)}>
                                Yes, delete
                              </button>
                              <button type="button" className="text-button" onClick={() => setConfirmingDelete(null)}>
                                Keep it
                              </button>
                            </div>
                          ) : (
                            <div className="resume-actions">
                              <a href={resumeFileUrl(resume._id)} target="_blank" rel="noreferrer">
                                View
                              </a>
                              {!resume.active && (
                                <button
                                  type="button"
                                  className="text-button"
                                  disabled={switchingTo === resume._id}
                                  onClick={() => handleActivate(resume)}
                                >
                                  {switchingTo === resume._id ? 'Switching…' : 'Use this resume'}
                                </button>
                              )}
                              <button
                                type="button"
                                className="icon-button"
                                aria-label={`Delete ${resume.name}`}
                                title={`Delete ${resume.name}`}
                                onClick={() => setConfirmingDelete(resume._id)}
                              >
                                ×
                              </button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}

            {profile.resume?.summary && (
              <p className="profile-summary">
                <strong>{profile.resume.fileName}:</strong> {profile.resume.summary}
              </p>
            )}
          </section>

          <section className="card">
            <h2>Your goal</h2>
            <div className="field-grid">
              <label>
                Your name
                <input value={profile.name} onChange={(e) => setField('name', e.target.value)} />
              </label>
              <label>
                Target role
                <input
                  required
                  minLength={2}
                  placeholder="e.g. Data Analyst"
                  value={profile.targetRole}
                  onChange={(e) => setField('targetRole', e.target.value)}
                />
              </label>
              <label>
                Hours per week
                <input
                  type="number"
                  min="1"
                  max="60"
                  required
                  value={profile.hoursPerWeek}
                  onChange={(e) => setField('hoursPerWeek', e.target.value)}
                />
              </label>
              <label>
                Timeline in weeks
                <input
                  type="number"
                  min="1"
                  max="52"
                  required
                  value={profile.timelineWeeks}
                  onChange={(e) => setField('timelineWeeks', e.target.value)}
                />
              </label>
            </div>
          </section>
        </div>

        <section className="card">
          <h2>Your skills{profile.skills.length > 0 && ` (${profile.skills.length})`}</h2>
          {profile.skills.length === 0 && <p className="muted">Upload a resume or add your skills below.</p>}
          <ul className="skill-list">
            {profile.skills.map((skill) => (
              <li key={skill.name}>
                <span className="skill-name">{skill.name}</span>
                <select
                  aria-label={`${skill.name} level`}
                  value={closestLevel(skill.proficiency)}
                  onChange={(e) => setSkillLevel(skill.name, Number(e.target.value))}
                >
                  {LEVELS.map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Remove ${skill.name}`}
                  title={`Remove ${skill.name}`}
                  onClick={() => removeSkill(skill.name)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <div className="inline-form">
            <input
              aria-label="Add a skill"
              placeholder="Add a skill"
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSkill(e)}
            />
            <button type="button" className="button secondary" onClick={addSkill}>
              Add
            </button>
          </div>
        </section>

        <div className="actions">
          <button className="button" disabled={saving}>
            {saving ? 'Saving…' : 'Save profile'}
          </button>
          {!unsaved && profile.targetRole && (
            <Link className="button secondary" to="/skill-gaps">
              Next: skill gaps
            </Link>
          )}
        </div>
      </form>
    </>
  );
}
