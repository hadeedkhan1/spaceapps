import { FormEvent, useState } from 'react';
import { createAccount, logIn, saveSession, startDemo } from '../api';
import type { Session } from '../contract';

export default function Auth({ onSession }: { onSession: (session: Session) => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [phone, setPhone] = useState('+1');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
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

  async function enterDemo() {
    setDemoBusy(true);
    setError('');
    try {
      const result = await startDemo();
      const session = { userid: result.userid, phone: result.phone, demo: true };
      saveSession(session);
      onSession(session);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDemoBusy(false);
    }
  }

  function switchMode() {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError('');
  }

  return (
    <div className="site">
      <header className="masthead">
        <div className="masthead-in">
          <span className="wordmark"><span className="wordmark-mark" aria-hidden="true" />Orbital Twin</span>
        </div>
      </header>

      <main className="auth-page">
        <div className="auth-copy">
          <p className="kicker">Account</p>
          <h1>{mode === 'login' ? 'Sign in.' : 'Create an account.'}</h1>
          <p className="lede">
            {mode === 'login'
              ? 'Your readings and scores stay tied to this account.'
              : 'One account holds your readings across sessions and devices.'}
          </p>
        </div>

        <div className="panel demo-entry">
          <div>
            <b>Simulated demo</b>
            <p className="note">Nine health indicators with a week of baseline and five days of change, so you can explore every feature.</p>
          </div>
          <button type="button" className="btn" onClick={enterDemo} disabled={demoBusy || busy}>
            {demoBusy ? 'Preparing…' : 'Open demo account'}
          </button>
        </div>

        <form className="panel auth-form" onSubmit={submit}>
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
            {busy ? 'Connecting…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
          <button type="button" className="link center" onClick={switchMode}>
            {mode === 'login' ? 'Create an account' : 'Sign in instead'}
          </button>
        </form>

        <p className="note">Scores summarize patterns in your own readings. They are not a diagnosis.</p>
      </main>
    </div>
  );
}
