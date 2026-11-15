import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { CATEGORY_META, DATA_SOURCES, ENVIRONMENTS, HAZARDS, Hazard, Session, State, Sys } from './contract';
import type { Category, CategoryScore } from './contract';
import { actionFor, getSolarFeed, loadState, readSession, saveSession, sendAlert } from './api';
import type { SolarFeed } from './api';
import Auth from './components/Auth';
import ReadingLogger from './components/ReadingLogger';
import BodyMap from './components/BodyMap';
import Mission from './components/Mission';
import TrendChart from './components/TrendChart';
import type { Status as MapStatus, SystemId } from './components/BodyMap';

const Selfie = lazy(() => import('./components/Selfie'));

type Tab = 'status' | 'earth' | 'checkin';
type Phase = 'idle' | 'sent' | 'waiting' | 'acked' | 'escalated';

const WORD = { green: 'Stable', yellow: 'Watch', red: 'Alert', grey: 'No data' };
const TREND = { up: 'Rising', flat: 'Steady', down: 'Falling' };
const TABS: [Tab, string][] = [['status', 'Status'], ['earth', 'Earth'], ['checkin', 'Check-in']];
const ICON: Record<Tab, any> = {
  status: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  earth: <><circle cx="12" cy="12" r="8" /><path d="M4 12h16M12 4c3 3 3 13 0 16M12 4c-3 3-3 13 0 16" /></>,
  checkin: <><rect x="3" y="7" width="18" height="12" rx="3" /><circle cx="12" cy="13" r="3.5" /></>,
};
const fmt = (s: number) => (s < 60 ? `${s} s` : `${Math.round(s / 60)} min`);
const hm = (d = new Date()) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const STEPS = ['Sent', 'Waiting', 'Acknowledged', 'Escalated'];
const ACTIVE: Record<Phase, number> = { idle: 0, sent: 0, waiting: 1, acked: 2, escalated: 3 };
const STATUS_ORDER = ['brain', 'eyes', 'heart', 'immune', 'metabolism', 'bones', 'muscle'];

function describe(r: CategoryScore) {
  const { unit } = CATEGORY_META[r.category];
  if (r.status === 'scored') {
    return `Baseline ${r.baseline} ${unit} · recent ${r.recent} ${unit} · ${r.before_days} baseline ${r.before_days === 1 ? 'day' : 'days'}, ${r.after_days} after`;
  }
  if (r.status === 'needs_before_data') return 'No baseline reading logged yet';
  return 'Waiting for a reading after the change';
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: any }) {
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={e => e.stopPropagation()}>
        <i className="grab" />
        <div className="sh"><h2>{title}</h2><button className="x" aria-label="Close" onClick={onClose}>✕</button></div>
        {children}
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(readSession);
  const [st, setSt] = useState<State | null>(null);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState<Tab>('status');
  const [sel, setSel] = useState('heart');
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [hz, setHz] = useState<Hazard | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [sending, setSending] = useState(false);
  const [earthNote, setEarthNote] = useState('');
  const [earthError, setEarthError] = useState('');
  const [stamp, setStamp] = useState('');
  const [envId, setEnvId] = useState('mars');
  const [delay, setDelay] = useState(1200);
  const [logPreset, setLogPreset] = useState<Category | undefined>();
  const [about, setAbout] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [captures, setCaptures] = useState<{ n: number; pct: number }[]>([]);
  const [solarFeed, setSolarFeed] = useState<SolarFeed | null>(null);
  const [solarError, setSolarError] = useState('');
  const timers = useRef<any[]>([]);
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  useEffect(() => {
    if (!session) {
      setSt(null);
      return;
    }
    let alive = true;
    setLoadError('');
    loadState(session.userid, session.demo)
      .then(next => { if (alive) setSt(next); })
      .catch(err => { if (alive) setLoadError((err as Error).message); });
    return () => { alive = false; };
  }, [session, reload]);

  useEffect(() => {
    if (!session) return;
    let alive = true;
    getSolarFeed()
      .then(data => { if (alive) { setSolarFeed(data); setSolarError(''); } })
      .catch(err => { if (alive) setSolarError((err as Error).message); });
    return () => { alive = false; };
  }, [session, reload]);

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    addEventListener('online', on); addEventListener('offline', off);
    return () => { removeEventListener('online', on); removeEventListener('offline', off); clear(); };
  }, []);

  const signOut = () => {
    saveSession(null);
    setSession(null);
    setSt(null);
    setLoadError('');
    setMenu(false);
  };

  if (!session) return <Auth onSession={setSession} />;

  if (loadError) {
    return (
      <div className="site">
        <header className="masthead">
          <div className="masthead-in">
            <span className="wordmark"><span className="wordmark-mark" aria-hidden="true" />Orbital Twin</span>
          </div>
        </header>
        <main className="page-wrap narrow">
          <div className="panel">
            <h2>Can’t reach your baseline</h2>
            <p className="mut">{loadError}</p>
            <div className="row-actions">
              <button className="btn" onClick={() => setReload(n => n + 1)}>Try again</button>
              <button className="link" onClick={signOut}>Sign out</button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!st) {
    return (
      <div className="site">
        <header className="masthead">
          <div className="masthead-in">
            <span className="wordmark"><span className="wordmark-mark" aria-hidden="true" />Orbital Twin</span>
          </div>
        </header>
        <main className="page-wrap narrow">
          <div className="panel"><h2>Loading your baseline</h2><p className="mut">Comparing your latest resting readings…</p></div>
        </main>
      </div>
    );
  }

  const s = st.systems.find(x => x.id === sel)!;
  const by = (id: string) => st.systems.find(x => x.id === id)!;
  const rows = s.categories.map(c => st.results[c]).filter((r): r is CategoryScore => !!r);
  const watchSystems = st.systems.filter(x => x.status === 'yellow');
  const alertSystems = st.systems.filter(x => x.status === 'red');
  const pendingSystems = st.systems.filter(x => x.status === 'grey');
  const watchNames = [...alertSystems, ...watchSystems].map(x => x.name);
  const watchSummary = watchNames.length === 1
    ? `${watchNames[0]} is trending outside baseline.`
    : watchNames.length > 1
      ? `${watchNames.slice(0, -1).join(', ')} and ${watchNames[watchNames.length - 1]} are trending outside baseline.`
      : pendingSystems.length
        ? 'Log baseline readings to score every system.'
        : 'All systems are within baseline.';
  const mapStatus = (value: Sys['status']): MapStatus => ({ green: 'ok', yellow: 'watch', red: 'alert', grey: 'idle' } as Record<Sys['status'], MapStatus>)[value];
  const bodyStatus: Record<SystemId, MapStatus> = {
    brain: mapStatus(by('brain').status), eyes: mapStatus(by('eyes').status),
    heart: mapStatus(by('heart').status), immune: mapStatus(by('immune').status),
    metabolism: mapStatus(by('metabolism').status),
    arms: mapStatus(by('muscle').status), legs: mapStatus(by('bones').status),
  };
  const bodySelection: SystemId = sel === 'muscle' ? 'arms' : sel === 'bones' ? 'legs' : sel as SystemId;
  const dim = (x: Sys) => hz && !x.hazards.includes(hz);
  const pick = (id: string) => { setSel(id); setOpen(true); };
  const pickBody = (id: SystemId) => setSel(id === 'arms' ? 'muscle' : id === 'legs' ? 'bones' : id);
  const plan = actionFor(delay);
  const env = ENVIRONMENTS.find(x => x.id === envId)!;
  const chooseEnv = (id: string) => { const next = ENVIRONMENTS.find(x => x.id === id)!; setEnvId(id); setDelay(next.delay); };
  const logFor = (category: Category) => { setLogPreset(category); setTab('checkin'); };
  const baselineDaysOf = (x: Sys) => x.categories.reduce(
    (n, c) => Math.max(n, st.results[c]?.before_days ?? 0), 0);
  const statusWord = (x: Sys) => x.status !== 'grey'
    ? WORD[x.status]
    : baselineDaysOf(x) ? 'Pending' : 'No data';
  const detail = (x: Sys) => x.status !== 'grey'
    ? `${TREND[x.trend]} · ${x.z.toFixed(1)} SD from baseline`
    : baselineDaysOf(x) ? 'Baseline set · log a reading after the change' : 'No readings yet';
  const masked = session.demo ? 'Simulated demo' : `•••• ${session.phone.slice(-4)}`;

  async function send() {
    clear(); setSending(true); setEarthNote(''); setEarthError('');
    try {
      const delivery = await sendAlert(session.userid, delay);
      setPhase('sent'); setStamp(hm());
      setEarthNote(delivery.mock
        ? 'Demo mode: LOOP_API_KEY or LOOP_TO is not set, so no message left this device.'
        : `Health report sent to ${delivery.contact ?? 'Earth'}.`);
      timers.current.push(setTimeout(() => { setPhase('waiting'); setStamp(hm(new Date(Date.now() + delay * 2000))); }, 1500));
      timers.current.push(setTimeout(() => { setPhase('escalated'); setStamp(hm()); }, 21500));
    } catch (err) {
      setEarthError((err as Error).message);
    } finally {
      setSending(false);
    }
  }
  const ack = () => { clear(); setPhase('acked'); setStamp(hm()); };
  const reset = () => { clear(); setPhase('idle'); setEarthNote(''); setEarthError(''); };

  const sub = {
    idle: 'Connected, across the distance',
    sent: `Sent at ${stamp} · encrypted`,
    waiting: `Earliest reply window · ${stamp}`,
    acked: `Acknowledged at ${stamp}`,
    escalated: `Escalated onboard at ${stamp}`,
  }[phase];
  const foot = {
    idle: `${fmt(delay)} one way · ~${fmt(delay * 2)} round trip`,
    sent: 'Queued for relay',
    waiting: `${fmt(delay)} one way · ~${fmt(delay * 2)} round trip`,
    acked: 'Flight clinician received your evidence',
    escalated: 'No reply yet · follow onboard protocol',
  }[phase];
  const guide = () => { setSel('heart'); setOpen(true); };
  const [label, action] = ({
    idle: [online ? 'Send to Earth' : 'Queue for Earth', send],
    sent: ['Message sent', null],
    waiting: ['Waiting for Earth', null],
    acked: ['Review heart guidance', guide],
    escalated: ['View onboard protocol', guide],
  } as any)[phase] as [string, (() => void) | null];

  const chip = (id: string) => {
    const x = by(id);
    return (
      <button key={id} className={`sys ${sel === id ? 'on' : ''} ${dim(x) ? 'dim' : ''}`} onClick={() => pick(id)}>
        <b>{x.name}</b>
        <span className={`${x.status}`}>{statusWord(x)}</span>
      </button>
    );
  };

  return (
    <div className="site" onClick={() => menu && setMenu(false)}>
      <header className="masthead">
        <div className="masthead-in">
          <button className="wordmark" onClick={() => setTab('status')}>
            <span className="wordmark-mark" aria-hidden="true" />
            Orbital Twin
          </button>
          <nav className="nav" aria-label="Sections">
            {TABS.map(([k, n]) => (
              <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)} aria-current={tab === k}>{n}</button>
            ))}
          </nav>
          <div className="account">
            <button
              className="account-btn"
              aria-haspopup="menu"
              aria-expanded={menu}
              onClick={e => { e.stopPropagation(); setMenu(v => !v); }}
            >
              <span className="avatar" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="12" cy="8" r="3.4" /><path d="M5 20c1.4-3.4 3.8-5 7-5s5.6 1.6 7 5" />
                </svg>
              </span>
              <span className="account-text"><small>Account</small><b>{masked}</b></span>
            </button>
            {menu && (
              <div className="menu" role="menu" onClick={e => e.stopPropagation()}>
                <div className="menu-head">
                  <span className="kicker">Signed in</span>
                  <b>{session.phone}</b>
                </div>
                <button className="menu-item" role="menuitem" onClick={signOut}>Sign out</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="page-wrap">
        {st.demo && <div className="demo-ribbon">Simulated demo data · 9 indicators · 7 baseline days and 5 after-change days each</div>}
        {tab === 'status' && (
          <section className="page">
            <header className="page-head">
              <div>
                <p className="kicker">Personal baseline</p>
                <h1>Status</h1>
                <p className="lede">{watchSummary}</p>
                <p className="env-line">{env.name} · key hazards: {env.hazards.join(', ')}</p>
              </div>
              <div className="score">
                <span className="kicker">Overall</span>
                <strong>{st.overall.status === 'scored' ? st.overall.score : '—'}<small>/10</small></strong>
              </div>
            </header>

            <dl className="kpis">
              <div><dt>Active alerts</dt><dd>{alertSystems.length}</dd></div>
              <div><dt>On watch</dt><dd>{watchSystems.length}</dd></div>
              <div><dt>Awaiting data</dt><dd>{pendingSystems.length}</dd></div>
            </dl>

            <div className="columns">
              <section className="panel">
                <div className="panel-head">
                  <h2>Body systems</h2>
                  <span className="hint">Select a region</span>
                </div>
                <div className="chips" role="group" aria-label="Hazard filter">
                  {[null, ...HAZARDS].map(h => (
                    <button key={h || 'all'} className={`chip ${hz === h ? 'on' : ''}`} onClick={() => setHz(h as Hazard | null)}>
                      {h ? h[0].toUpperCase() + h.slice(1) : 'All'}
                    </button>
                  ))}
                </div>
                <div className="bodycard">
                  <div className="col">{['brain', 'heart', 'bones'].map(chip)}</div>
                  <div className="map-stage">
                    <BodyMap status={bodyStatus} selected={bodySelection} onSelect={pickBody} height={210} />
                  </div>
                  <div className="col">{['eyes', 'immune', 'metabolism', 'muscle'].map(chip)}</div>
                </div>
                <div className="selection">
                  <span className={`dot ${s.status}`} />
                  <div><b>{s.name}</b><small>{detail(s)}</small></div>
                  <button className="link" onClick={() => setOpen(true)}>Details</button>
                </div>
              </section>

              <section className="panel">
                <div className="panel-head">
                  <h2>Systems</h2>
                  <span className="hint">Baseline vs recent</span>
                </div>
                <ul className="systems">
                  {STATUS_ORDER.map(id => by(id)).map(x => (
                    <li key={x.id} className={dim(x) ? 'dim' : ''}>
                      <button onClick={() => pick(x.id)}>
                        <span className="sys-name"><span className={`dot ${x.status}`} /><b>{x.name}</b></span>
                        <span className={`sys-state ${x.status}`}>{statusWord(x)}</span>
                        <span className="sys-trend">{TREND[x.trend]}</span>
                        <span className="sys-detail">{detail(x)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <Mission results={st.results} onLog={logFor} />
          </section>
        )}

        {tab === 'earth' && (
          <section className="page">
            <header className="page-head">
              <div>
                <p className="kicker">Report to Earth</p>
                <h1>Earth</h1>
                <p className="lede">{sub}</p>
              </div>
            </header>

            <div className="columns even">
              <div className="stack">
                <section className="panel">
                  <div className="panel-head"><h2>Current assessment</h2><span className="hint">From your readings</span></div>
                  <h3 className="alert-title">{st.alert.title || 'Alert'}</h3>
                  <p className="mut">{st.alert.text}</p>
                  {st.alert.evidence_provider && st.alert.evidence_provider !== 'none' && (
                    <p className="provider">{st.alert.evidence_provider === 'serpapi' ? 'Evidence retrieved with SerpApi' : 'Curated sources'}</p>
                  )}
                  {st.alert.evidence_summary && (
                    <div className="evidence"><b>Research context</b><p>{st.alert.evidence_summary}</p></div>
                  )}
                  {!st.alert.evidence_summary && !!st.alert.evidence_results?.length && (
                    <div className="evidence">
                      <b>Source excerpts</b>
                      {st.alert.evidence_results.map(item => <p key={item.url}>{item.snippet}</p>)}
                    </div>
                  )}
                  <ul className="cites">
                    {st.alert.cites.map(c => <li key={c.title}><a href={c.url} rel="noreferrer">{c.title}</a></li>)}
                  </ul>
                </section>
                {!online && (
                  <section className="panel">
                    <h2>Working offline</h2>
                    <p className="mut">Will sync when the link returns. Follow the onboard medical protocol.</p>
                  </section>
                )}
                <section className="panel">
                  <div className="panel-head"><h2>Mission environment</h2><span className="hint">Sets the delay</span></div>
                  <div className="chips" role="group" aria-label="Mission environment">
                    {ENVIRONMENTS.map(x => (
                      <button key={x.id} className={`chip ${envId === x.id ? 'on' : ''}`} onClick={() => chooseEnv(x.id)}>{x.name}</button>
                    ))}
                  </div>
                  <p className="note">{env.note}</p>
                </section>
                <section className="panel">
                  <div className="panel-head"><h2>Simulated light delay</h2><b className="figures sm">{fmt(delay)}</b></div>
                  <input type="range" min={2} max={1320} value={delay} aria-label="Simulated light delay" onChange={e => setDelay(+e.target.value)} />
                  <div className="range-labels"><span>2 s</span><span>1 min</span><span>20 min</span></div>
                </section>
                <section className="panel">
                  <div className="panel-head"><h2>Recommended action</h2></div>
                  <p>{plan}</p>
                </section>
                <section className="panel">
                  <div className="panel-head"><h2>Solar particle events</h2><span className="hint">NASA DONKI</span></div>
                  <p className="note">Observed reports from the past 7 days. Not a forecast.</p>
                  {solarError && <p className="err-line">NASA feed unavailable · {solarError}</p>}
                  {!solarError && !solarFeed && <p className="note">Loading NASA event reports…</p>}
                  {!solarError && solarFeed && (solarFeed.events.length ? (
                    <ul className="events">
                      {solarFeed.events.map((event, index) => (
                        <li key={`${event.eventTime}-${index}`}>
                          <span className="event-dot" />
                          <div>
                            <b>{event.eventTime ? new Date(event.eventTime).toLocaleString() : 'Time not provided'}</b>
                            <small>{event.instruments?.map(i => i.displayName).filter(Boolean).join(', ') || 'Instruments not listed'}</small>
                          </div>
                          {event.link && <a href={event.link} target="_blank" rel="noreferrer">NASA</a>}
                        </li>
                      ))}
                    </ul>
                  ) : <p className="note">No reports in this 7-day window.</p>)}
                  {solarFeed?.fetchedAt && <p className="note">Updated {new Date(solarFeed.fetchedAt).toLocaleTimeString()} · observational catalog</p>}
                </section>
              </div>

              <div className="stack">
                <section className="panel">
                  <div className="panel-head"><h2>Relay</h2><span className="hint">{online ? 'Linked' : 'Offline'}</span></div>
                  <ol className="tl">
                    {STEPS.map((n, i) => {
                      const a = ACTIVE[phase];
                      const done = i < a && !(phase === 'escalated' && i === 2);
                      const now = i === a;
                      return <li key={n} className={now ? (i === 3 ? 'bad' : 'now') : done ? 'done' : ''}><i /><span>{n}</span></li>;
                    })}
                  </ol>
                </section>
                <button className="btn" disabled={!action || sending} onClick={() => action && action()}>{sending ? 'Sending…' : label}</button>
                {earthError && <p className="err-line">Couldn’t reach Earth · {earthError}</p>}
                {earthNote && <p className="note">{earthNote}</p>}
                <p className="note">{foot}</p>
                {phase === 'waiting' && <button className="link" onClick={ack}>Demo: simulate Earth’s reply</button>}
                {phase !== 'idle' && <button className="link" onClick={reset}>Reset demo</button>}
              </div>
            </div>
          </section>
        )}

        {tab === 'checkin' && (
          <section className="page">
            <header className="page-head">
              <div>
                <p className="kicker">Readings</p>
                <h1>Check-in</h1>
                <p className="lede">Log what you measured, then see how it compares with your own baseline.</p>
              </div>
            </header>
            <div className="columns even">
              <ReadingLogger key={logPreset ?? 'default'} userid={session.userid} preset={logPreset} onSaved={() => setReload(n => n + 1)} />
              <div className="stack">
                <section className="panel">
                  <div className="panel-head"><h2>Selfie check</h2><span className="hint">On device</span></div>
                  <Suspense fallback={<div className="view" />}>
                    <Selfie onMetric={p => setCaptures(c => [...c, { n: c.length + 1, pct: p }])} />
                  </Suspense>
                </section>
                <section className="panel">
                  <div className="panel-head"><h2>Captures</h2><span className="hint">Change vs first</span></div>
                  {captures.length === 0
                    ? <p className="note">No captures yet. Start the camera to take one.</p>
                    : (
                      <ul className="captures">
                        {captures.map(c => (
                          <li key={c.n}><b>Capture {c.n}</b><span>{c.n === 1 ? 'Baseline' : `+${c.pct}%`}</span></li>
                        ))}
                      </ul>
                    )}
                  <p className="note">Only the ratio is kept; the image stays on the device.</p>
                </section>
              </div>
            </div>
          </section>
        )}

        <footer className="page-foot">
          <p>Prototype for crew self-assessment. Not a diagnosis or a medical device.</p>
          <button className="link" onClick={() => setAbout(true)}>Sources and safety</button>
        </footer>
      </main>

      <nav className="tabbar" aria-label="Main">
        {TABS.map(([k, n]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)} aria-current={tab === k}>
            <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICON[k]}</svg>
            {n}
          </button>
        ))}
      </nav>

      {about && (
        <Sheet title="Sources and safety" onClose={() => setAbout(false)}>
          <h3>Data sources</h3>
          <ul className="srcs">{DATA_SOURCES.map(x => <li key={x.name}><b>{x.name}.</b> {x.feeds}</li>)}</ul>
          <h3>How scores work</h3>
          <p>Your first readings form a personal baseline. Each later reading is compared with that baseline, and a sustained drift lowers the score. Scores are statistical trends, not clinical thresholds.</p>
          <h3>Limits</h3>
          <p className="mut">This is a prototype for self-assessment. It does not diagnose, and the demo account uses simulated data. Real thresholds and treatment decisions belong to the mission flight surgeon. In an emergency, follow the onboard medical protocol.</p>
        </Sheet>
      )}

      {open && (
        <Sheet title={s.name} onClose={() => setOpen(false)}>
          {rows.length > 0 && (
            <>
              <h3>Your readings</h3>
              {rows.map(r => (
                <div key={r.category} className="reading">
                  <div className="between"><b>{CATEGORY_META[r.category].label}</b><em className={r.color}>{r.status === 'scored' ? `${r.score}/10` : 'Pending'}</em></div>
                  <p className="mut">{describe(r)}</p>
                  <TrendChart series={r.series ?? []} baseline={r.baseline} spread={r.spread} unit={CATEGORY_META[r.category].unit} label={CATEGORY_META[r.category].label} status={r.color} />
                  {r.explanation && <p>{r.explanation}</p>}
                  {!!r.explanation_plan?.length && <ul className="srcs">{r.explanation_plan.map(item => <li key={item}>{item}</li>)}</ul>}
                  {!!r.explanation_watch_for?.length && <p className="mut">Watch for {r.explanation_watch_for.join(', ')}.</p>}
                  {r.explanation_caveat && <p className="mut">{r.explanation_caveat}</p>}
                  <h4>What you can do</h4>
                  <ul className="srcs">{CATEGORY_META[r.category].actions.map(item => <li key={item}>{item}</li>)}</ul>
                  <details className="howto">
                    <summary>How to measure it</summary>
                    <ol>{CATEGORY_META[r.category].howto.map(step => <li key={step}>{step}</li>)}</ol>
                    <p className="mut">{CATEGORY_META[r.category].why}</p>
                  </details>
                  <button className="link" onClick={() => { setOpen(false); logFor(r.category); }}>Log {CATEGORY_META[r.category].label.toLowerCase()}</button>
                </div>
              ))}
            </>
          )}
          <h3>How it’s measured</h3><p>{s.measure}</p>
          <h3>How spaceflight changes it</h3><p>{s.change}</p>
          <h3>When to escalate</h3><p>{s.escalate}</p>
          <p className="mut">Source: {s.source}. Compared with your own baseline, not a clinical threshold.</p>
        </Sheet>
      )}
    </div>
  );
}
