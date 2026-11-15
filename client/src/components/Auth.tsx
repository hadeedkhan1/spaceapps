import { FormEvent, useState } from 'react';
import { createAccount, logIn, saveSession } from '../api';
import type { Session } from '../contract';

export default function Auth({ onSession }: { onSession: (session: Session) => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [phone, setPhone] = useState('+1');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { userid } = mode === 'login'
        ? await logIn(phone, password)
        : await createAccount(phone, password);
      const session = { userid, phone: phone.trim() };
      saveSession(session);
      onSession(session);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function switchMode() {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError('');
  }

  return (
    <div className="app">
      <div className="top"><h1>Orbital Twin</h1><span className="eyebrow blue">BASELINE</span></div>
      <p className="sub">Your own normal, scored before and after a change.</p>
      <form className="card" onSubmit={submit}>
        <p className="eyebrow">{mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}</p>
        <div className="field">
          <label htmlFor="auth-phone">Phone with country code</label>
          <input id="auth-phone" value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="+15551234567" autoComplete="tel" inputMode="tel" required />
        </div>
        <div className="field">
          <label htmlFor="auth-password">Password</label>
          <input id="auth-password" type="password" value={password} minLength={8} maxLength={128}
            onChange={e => setPassword(e.target.value)} required
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        </div>
        {error && <p className="err-line">{error}</p>}
        <button className="btn" disabled={busy}>
          {busy ? 'Connecting…' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>
        <button type="button" className="link" onClick={switchMode}>
          {mode === 'login' ? 'Create an account' : 'Use an existing account'}
        </button>
      </form>
      <p className="mut pad">Scores summarize patterns in your own readings. They are not a diagnosis.</p>
    </div>
  );
}
