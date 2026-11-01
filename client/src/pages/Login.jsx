import { useState } from 'react';
import { login, register } from '../api/client.js';

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isLogin = mode === 'login';

  function switchMode() {
    setMode(isLogin ? 'register' : 'login');
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { user } = await (isLogin ? login : register)({ email, password });
      onLogin(user);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="card login-card">
        <span className="brand">Career Pivot Coach</span>
        <h1>{isLogin ? 'Log in' : 'Create your account'}</h1>
        <p className="muted">
          {isLogin ? 'Pick up your career move where you left it.' : 'Start planning your career move.'}
        </p>

        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              minLength={isLogin ? undefined : 8}
              maxLength={128}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {!isLogin && <p className="muted field-hint">Use at least 8 characters.</p>}
          <button className="button login-submit" disabled={submitting}>
            {submitting ? 'Please wait…' : isLogin ? 'Log in' : 'Create account'}
          </button>
        </form>

        <p className="login-switch">
          {isLogin ? 'New here?' : 'Already have an account?'}{' '}
          <button type="button" className="text-button" onClick={switchMode}>
            {isLogin ? 'Create an account' : 'Log in'}
          </button>
        </p>
      </section>
    </main>
  );
}
