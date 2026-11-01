import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { getCurrentUser, logout, SESSION_EXPIRED } from './api/client.js';
import Dashboard from './pages/Dashboard.jsx';
import Intake from './pages/Intake.jsx';
import Interview from './pages/Interview.jsx';
import Login from './pages/Login.jsx';
import Plan from './pages/Plan.jsx';
import Projects from './pages/Projects.jsx';
import SkillGap from './pages/SkillGap.jsx';
import Tracker from './pages/Tracker.jsx';

const LINKS = [
  { to: '/dashboard', label: 'Home' },
  { to: '/intake', label: 'Profile' },
  { to: '/skill-gaps', label: 'Skill gaps' },
  { to: '/plan', label: 'Plan' },
  { to: '/projects', label: 'Projects' },
  { to: '/interview', label: 'Interview' },
  { to: '/tracker', label: 'Tracker' },
];

export default function App() {
  const [user, setUser] = useState(undefined);
  const [menuOpen, setMenuOpen] = useState(false);
  const [startupError, setStartupError] = useState('');

  useEffect(() => {
    getCurrentUser()
      .then((result) => setUser(result.user))
      .catch((err) => setStartupError(err.message));

    const handleExpired = () => setUser(null);
    window.addEventListener(SESSION_EXPIRED, handleExpired);
    return () => window.removeEventListener(SESSION_EXPIRED, handleExpired);
  }, []);

  async function handleLogout() {
    setMenuOpen(false);
    try {
      await logout();
    } finally {
      setUser(null);
    }
  }

  if (startupError) {
    return (
      <main className="login-page">
        <p className="alert">{startupError}</p>
      </main>
    );
  }
  if (user === undefined) return null;
  if (!user) return <Login onLogin={setUser} />;

  return (
    <>
      <header className="topbar">
        <span className="brand">Career Pivot Coach</span>
        <button
          type="button"
          className="menu-button"
          aria-expanded={menuOpen}
          aria-controls="main-menu"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? 'Close' : 'Menu'}
        </button>
        <nav id="main-menu" className={menuOpen ? 'steps open' : 'steps'}>
          {LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} className="step" onClick={() => setMenuOpen(false)}>
              {link.label}
            </NavLink>
          ))}
          <div className="account">
            <span className="account-email" title={user.email}>
              {user.email}
            </span>
            <button type="button" className="button secondary logout" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </nav>
      </header>
      <main className="page">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/intake" element={<Intake />} />
          <Route path="/skill-gaps" element={<SkillGap />} />
          <Route path="/plan" element={<Plan />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/interview" element={<Interview />} />
          <Route path="/tracker" element={<Tracker />} />
        </Routes>
      </main>
    </>
  );
}
