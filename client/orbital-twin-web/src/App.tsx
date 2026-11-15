import { useEffect, useRef, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer, CartesianGrid } from 'recharts';
import { HAZARDS, Hazard, State, Sys } from './contract';
import { getState, sendAlert, actionFor } from './api';
import BodyMap from './components/BodyMap';
import type { Status as MapStatus, SystemId } from './components/BodyMap';
import Selfie from './components/Selfie';

type Tab = 'status' | 'dose' | 'earth' | 'checkin';
type Phase = 'idle' | 'sent' | 'waiting' | 'acked' | 'escalated';
type SolarScenario = 'quiet' | 'watch' | 'storm';
const WORD = { green: 'Stable', yellow: 'Watch', red: 'Alert' };
const GLYPH = { green: '✓', yellow: '⚠', red: '!' };
const TREND = { up: '↗ Rising', flat: '→ Steady', down: '↘ Falling' };
const TABS: [Tab, string][] = [['status', 'Status'], ['dose', 'Dose'], ['earth', 'Earth'], ['checkin', 'Check-in']];
const ICON: Record<Tab, any> = {
  status: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  dose: <><circle cx="12" cy="12" r="8" /><path d="M12 12l4-3" /></>,
  earth: <><circle cx="12" cy="12" r="8" /><path d="M4 12h16M12 4c3 3 3 13 0 16M12 4c-3 3-3 13 0 16" /></>,
  checkin: <><rect x="3" y="7" width="18" height="12" rx="3" /><circle cx="12" cy="13" r="3.5" /></> };
const SYS_ICON: Record<string, any> = {
  brain: <path d="M12 3a3 3 0 0 0-5.7 1.3A3.5 3.5 0 0 0 4 10a3.5 3.5 0 0 0 2 6.2A3.5 3.5 0 0 0 12 18m0-15a3 3 0 0 1 5.7 1.3A3.5 3.5 0 0 1 20 10a3.5 3.5 0 0 1-2 6.2A3.5 3.5 0 0 1 12 18M12 3v16" />,
  eyes: <><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6z" /><circle cx="12" cy="12" r="2.5" /></>,
  heart: <path d="M20.5 8.8c0 4.8-8.5 10-8.5 10s-8.5-5.2-8.5-10a4.2 4.2 0 0 1 8.5-1.1 4.2 4.2 0 0 1 8.5 1.1z" />,
  immune: <path d="M12 3 20 6v5c0 5-3.4 8.3-8 10-4.6-1.7-8-5-8-10V6l8-3zm-3 9 2 2 4-4" />,
  bones: <path d="M7 8a2.5 2.5 0 1 1 3-3l5 5a2.5 2.5 0 1 1-3 3l-5-5zm10 8a2.5 2.5 0 1 1-3 3l-5-5a2.5 2.5 0 1 1 3-3l5 5z" />,
  muscle: <path d="M5 13c1-2 2-4 4-5l2 3 2-1 1-4 2 1 1 5 3 1v4c-4 3-12 2-15-1-2-2-1-4 0-6z" />
};
const fmt = (s: number) => (s < 60 ? `${s} s` : `${Math.round(s / 60)} min`);
const hm = (d = new Date()) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const STEPS = ['Sent', 'Waiting', 'Acknowledged', 'Escalated'];
const ACTIVE: Record<Phase, number> = { idle: 0, sent: 0, waiting: 1, acked: 2, escalated: 3 };
const SOURCES = ['NOAA GOES proton flux', 'NASA DONKI', 'NASA MSL RAD', 'NASA-STD-3001', 'NASA Human Research Program', 'WESAD / PhysioNet'];
const STATUS_ORDER = ['brain', 'eyes', 'heart', 'immune', 'bones', 'muscle'];
const SOLAR_OUTLOOK: Record<SolarScenario, { title: string; severity: string; onset: string; prepare: string; duration: string; clear: string }> = {
  quiet: { title: 'Quiet activity scenario', severity: 'LOW', onset: 'No event', prepare: '—', duration: 'No window', clear: '—' },
  watch: { title: 'Elevated activity scenario', severity: 'WATCH', onset: '12–18 h', prepare: '12–18 h', duration: '~6 h', clear: '18–24 h' },
  storm: { title: 'Solar event scenario', severity: 'HIGH', onset: '~4 h', prepare: 'Within ~4 h', duration: '~12 h', clear: '~16 h' },
};

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
  const [st, setSt] = useState<State | null>(null);
  const [tab, setTab] = useState<Tab>('status');
  const [sel, setSel] = useState('heart');
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState(false);
  const [hz, setHz] = useState<Hazard | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [stamp, setStamp] = useState('');
  const [delay, setDelay] = useState(1200);
  const [view, setView] = useState<'no' | 'sh'>('no');
  const [solarScenario, setSolarScenario] = useState<SolarScenario>('watch');
  const [online, setOnline] = useState(navigator.onLine);
  const [face, setFace] = useState([{ day: 1, pct: 1 }, { day: 40, pct: 3 }, { day: 78, pct: 6 }, { day: 79, pct: 5 }, { day: 80, pct: 4 }]);
  const timers = useRef<any[]>([]);
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => {
    getState().then(setSt);
    const on = () => setOnline(true), off = () => setOnline(false);
    addEventListener('online', on); addEventListener('offline', off);
    return () => { removeEventListener('online', on); removeEventListener('offline', off); clear(); };
  }, []);

  if (!st) return (
    <div className="app"><h1>Status</h1><div className="card"><h2>Learning your baseline</h2><p className="mut">Comparing your latest resting readings…</p></div>
      <div className="card skel" /></div>);

  const s = st.systems.find(x => x.id === sel)!;
  const by = (id: string) => st.systems.find(x => x.id === id)!;
  const watchSystems = st.systems.filter(x => x.status === 'yellow');
  const alertSystems = st.systems.filter(x => x.status === 'red');
  const attentionSystems = [...alertSystems, ...watchSystems];
  const watchNames = attentionSystems.map(x => x.name);
  const watchSummary = watchNames.length === 1
    ? `${watchNames[0]} is trending outside baseline.`
    : watchNames.length > 1
      ? `${watchNames.slice(0, -1).join(', ')} and ${watchNames[watchNames.length - 1]} are trending outside baseline.`
      : 'All systems are within baseline.';
  const mapStatus = (value: Sys['status']): MapStatus => ({ green: 'ok', yellow: 'watch', red: 'alert' } as Record<Sys['status'], MapStatus>)[value];
  const bodyStatus: Record<SystemId, MapStatus> = {
    brain: mapStatus(by('brain').status), eyes: mapStatus(by('eyes').status),
    heart: mapStatus(by('heart').status), immune: mapStatus(by('immune').status),
    arms: mapStatus(by('muscle').status), legs: mapStatus(by('bones').status),
  };
  const bodySelection: SystemId = sel === 'muscle' ? 'arms' : sel === 'bones' ? 'legs' : sel as SystemId;
  const dim = (x: Sys) => hz && !x.hazards.includes(hz);
  const pick = (id: string) => { setSel(id); setOpen(true); };
  const pickBody = (id: SystemId) => setSel(id === 'arms' ? 'muscle' : id === 'legs' ? 'bones' : id);
  const plan = actionFor(delay);

  async function send() {
    clear(); setPhase('sent'); setStamp(hm());
    await sendAlert(`${st!.alert.text} Plan: ${plan}`);
    timers.current.push(setTimeout(() => { setPhase('waiting'); setStamp(hm(new Date(Date.now() + delay * 2000))); }, 1500));
    timers.current.push(setTimeout(() => { setPhase('escalated'); setStamp(hm()); }, 21500));
  }
  const ack = () => { clear(); setPhase('acked'); setStamp(hm()); setView('sh'); };
  const reset = () => { clear(); setPhase('idle'); setView('no'); };

  const cur = st.dose.series.find(p => p.day === st.day) || st.dose.series[st.dose.series.length - 1];
  const prev = st.dose.series.find(p => p.day === st.day - 1) || cur;
  const mSv = view === 'sh' ? cur.sheltered : cur.ignored;
  const pct = Math.round((mSv / st.dose.limit) * 100);
  const C = 2 * Math.PI * 70;
  const solar = SOLAR_OUTLOOK[solarScenario];

  const sub = { idle: 'Connected, across the distance', sent: `Sent at ${stamp} · encrypted`, waiting: `Earliest reply window · ${stamp}`,
    acked: `Acknowledged at ${stamp}`, escalated: `Escalated onboard at ${stamp}` }[phase];
  const foot = { idle: `${fmt(delay)} one way · ~${fmt(delay * 2)} round trip`, sent: 'Queued for relay', waiting: `${fmt(delay)} one way · ~${fmt(delay * 2)} round trip`,
    acked: 'Flight clinician received your evidence', escalated: 'No reply yet · follow onboard protocol' }[phase];
  const guide = () => { setSel('heart'); setOpen(true); };
  const [label, action] = ({ idle: [online ? 'Send to Earth' : 'Queue for Earth', send], sent: ['Message sent', null], waiting: ['Waiting for Earth', null],
    acked: ['Review heart guidance', guide], escalated: ['View onboard protocol', guide] } as any)[phase] as [string, (() => void) | null];

  const chip = (id: string) => { const x = by(id); return (
    <button key={id} className={`sys ${sel === id ? 'on' : ''} ${dim(x) ? 'dim' : ''}`} onClick={() => pick(id)}>
      <b>{x.name}</b><span className={x.status}>{GLYPH[x.status]} {WORD[x.status]}</span></button>); };

  return (
    <div className="app">
      <div className="ios-status" aria-hidden="true"><b>9:41</b><span className="island" /><svg className="status-icons" viewBox="0 0 72 18"><path d="M1 16h4V11H1zm7 0h4V8H8zm7 0h4V5h-4z" fill="currentColor"/><path d="M27 7a13 13 0 0 1 17 0M30 10a9 9 0 0 1 11 0m-8 3a4 4 0 0 1 5 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><rect x="52" y="4" width="17" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5"/><rect x="69.5" y="7" width="2" height="4" rx="1" fill="currentColor"/><path d="M54.5 6.5h11v5h-11z" fill="currentColor"/></svg></div>
      {tab === 'status' && <>
        <div className="top"><h1>Status</h1><button className="x" aria-label="Sources and safety" onClick={() => setInfo(true)}>ⓘ</button></div>
        <p className="sub">Mission day {st.day}</p>
        <section className="brief card" aria-label="Mission overview">
          <div className="brief-top"><span className="eyebrow">NOW · MISSION BRIEF</span><span className="live-tag"><i /> LIVE</span></div>
          <div className="brief-main"><div><strong>{alertSystems.length ? `${alertSystems.length} active alert${alertSystems.length > 1 ? 's' : ''}` : watchSystems.length ? `${watchSystems.length} systems on watch` : 'All systems stable'}</strong><p>{watchSummary}</p></div><span className={`brief-count ${alertSystems.length ? 'has-alert' : ''}`}>{String(attentionSystems.length).padStart(2, '0')}<small>{alertSystems.length ? 'ALERT' : 'WATCH'}</small></span></div>
          <button className="brief-action" onClick={() => pick(attentionSystems[0]?.id || 'heart')}>Review priority system <span>↗</span></button>
        </section>
        <div className="chips" role="group" aria-label="Hazard filter">
          {[null, ...HAZARDS].map(h => <button key={h || 'all'} className={`chip ${hz === h ? 'on' : ''}`} onClick={() => setHz(h as Hazard | null)}>{h ? h[0].toUpperCase() + h.slice(1) : 'All'}</button>)}
        </div>
        <section className="body-panel" aria-label="Interactive body systems">
          <div className="section-head"><div><span className="eyebrow">BODY SYSTEMS</span><strong>Daily readout</strong></div><span className="tap-hint">Tap a region</span></div>
          <div className="bodycard">
            <div className="col">{['brain', 'heart', 'bones'].map(chip)}</div>
            <div className="map-stage"><span className="map-orbit" /><BodyMap status={bodyStatus} selected={bodySelection} onSelect={pickBody} height={235} /></div>
            <div className="col">{['eyes', 'immune', 'muscle'].map(chip)}</div>
          </div>
          <div className="body-selection"><span className={`selection-dot ${s.status}`} /><div><b>{s.name}</b><small>{TREND[s.trend]} · {s.z.toFixed(1)} SD from baseline</small></div><button onClick={() => setOpen(true)}>Details <span>›</span></button></div>
        </section>
        <ul className="card list">
          {STATUS_ORDER.map(id => by(id)).map(x => (
            <li key={x.id} className={dim(x) ? 'dim' : ''}><button onClick={() => pick(x.id)}>
              <span className="name"><svg className={`sys-icon ${x.status}`} viewBox="0 0 24 24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{SYS_ICON[x.id]}</svg><span><b>{x.name}</b><small>{x.z.toFixed(1)} SD from baseline</small></span></span>
              <span className="r"><em className={x.status}>{GLYPH[x.status]} {WORD[x.status]}</em><small>{TREND[x.trend]} ›</small></span></button></li>))}
        </ul>
      </>}

      {tab === 'dose' && <>
        <h1>Dose</h1><p className="sub">Your radiation exposure</p>
        <div className="card center dose-card">
          <div className="between dose-kicker"><b>CAREER EXPOSURE</b><b className="green">✓ Within model</b></div>
          <svg viewBox="0 0 160 160" width="155" height="155" role="img" aria-label={`${pct}% of career limit`}>
            <circle cx="80" cy="80" r="70" className="trk" />
            <circle cx="80" cy="80" r="70" className="arc" strokeDasharray={`${(C * Math.min(pct, 100)) / 100} ${C}`} transform="rotate(-90 80 80)" />
            <text x="80" y="88" textAnchor="middle" className="big">{pct}%</text>
            <text x="80" y="106" textAnchor="middle" className="smt">of career limit</text>
          </svg>
          <p className="mut">{Math.round(mSv)} / {st.dose.limit} mSv · Illustrative career model</p>
        </div>
        <section className={`card solar-card ${solarScenario}`} aria-label="Solar storm scenario forecast">
          <div className="solar-heading"><div><p className="eyebrow">SPACE WEATHER</p><h2>Solar outlook</h2></div><span className="simulated-tag">SIMULATED</span></div>
          <p className="solar-feed">No live forecast feed connected</p>
          <div className="solar-event" key={solarScenario}><span className="solar-symbol" aria-hidden="true">☼</span><div><b>{solar.title}</b><small>{solarScenario === 'quiet' ? 'No event in this scenario' : `Possible onset · ${solar.onset}`}</small></div><span className="solar-severity">{solar.severity}</span></div>
          <div className={`solar-track ${solarScenario}`} aria-label={`Scenario timeline: onset ${solar.onset}, estimated shelter duration ${solar.duration}`}>
            <div className="track-line"><i /></div><div className="track-point now"><i /><small>Now</small></div><div className="track-point onset"><i /><small>Onset</small></div><div className="track-point clear"><i /><small>Clear</small></div>
          </div>
          <div className="solar-estimates"><div><small>PREPARE</small><b>{solar.prepare}</b></div><div><small>EST. SHELTER WINDOW</small><b>{solar.duration}</b></div><div><small>EST. CLEAR</small><b>{solar.clear}</b></div></div>
          <div className="seg scenario-picker" role="group" aria-label="Illustrative solar scenario">
            {([['quiet', 'Quiet'], ['watch', 'Elevated'], ['storm', 'Storm']] as [SolarScenario, string][]).map(([value, label]) => <button key={value} className={solarScenario === value ? 'on' : ''} aria-pressed={solarScenario === value} onClick={() => setSolarScenario(value)}>{label}</button>)}
          </div>
          <p className="solar-foot">Training estimate only. Real event timing and shelter decisions depend on onboard radiation measurements and mission rules.</p>
        </section>
        <div className="card">
          <h2>A safer trajectory</h2>
          <div className="seg"><button className={view === 'no' ? 'on' : ''} onClick={() => setView('no')}>No shelter</button>
            <button className={view === 'sh' ? 'on' : ''} onClick={() => setView('sh')}>Sheltered</button></div>
          <ResponsiveContainer width="100%" height={145}>
            <LineChart data={st.dose.series}><CartesianGrid stroke="var(--sep)" vertical={false} />
              <XAxis dataKey="day" domain={[1, 240]} ticks={[1, 80, 160, 240]} tick={{ fill: 'var(--mute)', fontSize: 11 }} stroke="var(--sep)" label={{ value: 'Mission day →', position: 'insideBottom', offset: -9, fill: 'var(--mute)', fontSize: 11 }} />
              <YAxis domain={[0, st.dose.limit]} ticks={[0, 300, 600]} tick={{ fill: 'var(--mute)', fontSize: 11 }} stroke="var(--sep)" />
              <ReferenceLine y={st.dose.limit} stroke="var(--yellow)" strokeDasharray="4 4" />
              <Line dataKey="ignored" stroke="var(--mute)" dot={false} strokeWidth={view === 'no' ? 3 : 1.5} isAnimationActive={false} />
              <Line dataKey="sheltered" stroke="var(--blue)" dot={false} strokeWidth={view === 'sh' ? 3 : 1.5} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
          <div className="dose-legend mut"><span><i className="legend-gray" />No shelter</span><span><i className="legend-blue" />Sheltered</span><span><i className="legend-yellow" />Limit</span></div>
        </div>
        <p className="mut pad">Illustrative model. Verify limits against NASA-STD-3001.</p>
        <p className="row">Today's dose · {(mSv - (view === 'sh' ? prev.sheltered : prev.ignored)).toFixed(2)} mSv</p>
      </>}

      {tab === 'earth' && <>
        <h1>Earth</h1><p className="sub">{sub}</p>
        <div className="card">
          <p className="eyebrow warn">⚠ WATCH · HEART</p>
          <h2>{st.alert.title || 'Alert'}</h2><p className="mut">{st.alert.text}</p>
          <ul className="cites">{st.alert.cites.map(c => <li key={c.title}><a href={c.url}>↗ {c.title} ›</a></li>)}</ul>
        </div>
        {!online && <div className="card"><b>Working offline, will sync when the link returns</b><p className="mut">Follow the onboard medical protocol.</p></div>}
        <div className="card">
          <div className="between"><b>Message delay</b><b className="blue">{fmt(delay)}</b></div>
          <input type="range" min={2} max={1200} value={delay} aria-label="Message delay" onChange={e => setDelay(+e.target.value)} />
          <div className="between mut"><small>2 s</small><small>1 min</small><small>20 min</small></div>
        </div>
        <div className="card"><p className="eyebrow blue">RECOMMENDED ACTION</p><p>{plan}</p></div>
        <ol className="tl">{STEPS.map((n, i) => {
          const a = ACTIVE[phase], done = i < a && !(phase === 'escalated' && i === 2), now = i === a;
          return <li key={n} className={now ? (i === 3 ? 'bad' : 'now') : done ? 'done' : ''}><i>{done ? '✓' : ''}</i>{n}</li>; })}</ol>
        <button className="btn" disabled={!action} onClick={() => action && action()}>{label}</button>
        <p className="mut pad">{foot}</p>
        {phase === 'waiting' && <button className="link" onClick={ack}>Demo: simulate Earth’s reply</button>}
        {phase !== 'idle' && <button className="link" onClick={reset}>Reset demo</button>}
      </>}

      {tab === 'checkin' && <>
        <h1>Check-in</h1><p className="sub">A moment for your baseline</p>
        <Selfie onMetric={p => setFace(f => [...f, { day: f[f.length - 1].day + 1, pct: p }])} />
        <div className="card checkin-chart"><h2>Face puffiness vs day one</h2>
          <ResponsiveContainer width="100%" height={50}><LineChart data={face}><XAxis dataKey="day" ticks={[1, 40, 80]} tickFormatter={d => d === 1 ? 'Day 1' : `${d}`} axisLine={false} tickLine={false} tick={{ fill: 'var(--mute)', fontSize: 10 }} /><Line dataKey="pct" stroke="var(--blue)" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
          <p className="mut">+{face[face.length - 1].pct}% today · Illustrative image estimate</p></div>
        <div className="card trio">{face.slice(-3).map(p => <div key={p.day}><b>+{p.pct}%</b><small>Day {p.day}</small></div>)}</div>
      </>}

      <nav className="tabbar" aria-label="Main">
        {TABS.map(([k, n]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)} aria-current={tab === k}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ICON[k]}</svg>{n}</button>))}
      </nav>
      <div className="ios-home" aria-hidden="true" />

      {open && <Sheet title={s.name} onClose={() => setOpen(false)}>
        <h3>How it’s measured</h3><p>{s.measure}</p>
        <h3>How spaceflight changes it</h3><p>{s.change}</p>
        <h3>When to escalate</h3><p>{s.escalate}</p>
        <p className="mut">Source: {s.source}. Illustrative baseline; clinician-defined thresholds.</p></Sheet>}
      {info && <Sheet title="Sources and safety" onClose={() => setInfo(false)}>
        <ul className="srcs">{SOURCES.map(x => <li key={x}>{x}</li>)}</ul>
        <p className="mut">Prototype, not a diagnosis. Simulated drifts are labeled as simulated. Real astronaut garment data is not public.</p></Sheet>}
    </div>
  );
}
