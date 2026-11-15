import { useEffect, useRef, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer, CartesianGrid, Tooltip } from 'recharts';
import { CATEGORY_META, HAZARDS, Hazard, Session, State, Sys } from './contract';
import type { CategoryScore, ScoreResult } from './contract';
import { actionFor, getSolarFeed, loadState, readSession, saveSession, sendAlert } from './api';
import type { SolarFeed } from './api';
import Auth from './components/Auth';
import ReadingLogger from './components/ReadingLogger';
import BodyMap from './components/BodyMap';
import type { Status as MapStatus, SystemId } from './components/BodyMap';
import Selfie from './components/Selfie';

type Tab = 'status' | 'dose' | 'earth' | 'checkin';
type Phase = 'idle' | 'sent' | 'waiting' | 'acked' | 'escalated';
const WORD = { green: 'Stable', yellow: 'Watch', red: 'Alert', grey: 'No data' };
const GLYPH = { green: '✓', yellow: '⚠', red: '!', grey: '·' };
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
const fmtDemo = (ms: number) => ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
const hm = (d = new Date()) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const STEPS = ['Sent', 'Waiting', 'Acknowledged', 'Escalated'];
const ACTIVE: Record<Phase, number> = { idle: 0, sent: 0, waiting: 1, acked: 2, escalated: 3 };
const SOURCES = [
  { title: 'NASA Twins Study', url: 'https://www.nasa.gov/humans-in-space/twins-study/about/', supports: 'Longitudinal personal-baseline research context; it does not validate this app’s score.' },
  { title: 'NASA cardiovascular monitoring in microgravity', url: 'https://www.nasa.gov/wp-content/uploads/2022/03/iss_technical_publication_030116.pdf', supports: 'Heart-rate and HRV research context.' },
  { title: 'NASA astronaut vision and SANS research', url: 'https://www.nasa.gov/missions/station/iss-research/science-in-space-july-28-2023-astronaut-vision/', supports: 'Ocular health and visual-symptom context for the Eyes indicator.' },
  { title: 'NOAA GOES proton flux', url: 'https://www.swpc.noaa.gov/products/goes-proton-flux', supports: 'Solar proton observations; this prototype does not connect to the live feed.' },
  { title: 'NASA DONKI Solar Energetic Particle reports', url: 'https://ccmc.gsfc.nasa.gov/DONKI/', supports: 'Live event reports shown on the Dose tab; observational catalog, not a shelter-time forecast.' },
  { title: 'NASA MSL Radiation Assessment Detector data', url: 'https://data.nasa.gov/dataset/msl-mars-radiation-assessment-detector-edr-964e9', supports: 'Mars surface radiation measurements; not a crew dosimeter feed.' },
  { title: 'NASA Human Rating Guidance', url: 'https://www.nasa.gov/human-rating-guidance/', supports: 'Standards reference only; the prototype does not use its limits as personal thresholds.' },
  { title: 'UCI WESAD wearable dataset', url: 'https://archive.ics.uci.edu/dataset/465/wesad', supports: 'Wearable-signal research context; not astronaut validation data.' },
];
const STATUS_ORDER = ['brain', 'eyes', 'heart', 'immune', 'bones', 'muscle'];
const DOSE_MODEL_REFERENCE_MSV = 600;
const SIMULATED_DOSE = (() => {
  let ignored = 0;
  let sheltered = 0;
  return Array.from({ length: 241 }, (_, day) => {
    const historicalRate = day === 0 ? 0 : day < 79 ? 1.815 : day === 79 ? 1.81 : day === 80 ? 0.62 : 0;
    ignored += day > 80 ? 2.85 : historicalRate;
    sheltered += day > 80 ? 1.6 : historicalRate;
    return { day, ignored: +ignored.toFixed(2), sheltered: +sheltered.toFixed(2) };
  });
})();
function describe(r: CategoryScore) {
  const { unit } = CATEGORY_META[r.category];
  if (r.status === 'scored') {
    return `Baseline ${r.baseline} ${unit} · recent ${r.recent} ${unit} · ${r.before_days} baseline days, ${r.after_days} after`;
  }
  if (r.status === 'needs_before_data') return `${r.before_days ?? 0} of 2 baseline days logged`;
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
  const [info, setInfo] = useState(false);
  const [hz, setHz] = useState<Hazard | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [stamp, setStamp] = useState('');
  const [delay, setDelay] = useState(1200);
  const [solarFeed, setSolarFeed] = useState<SolarFeed | null>(null);
  const [solarError, setSolarError] = useState('');
  const [doseView, setDoseView] = useState<'no' | 'sheltered'>('no');
  const [online, setOnline] = useState(navigator.onLine);
  const [face, setFace] = useState([{ day: 1, pct: 1 }, { day: 40, pct: 3 }, { day: 78, pct: 6 }, { day: 79, pct: 5 }, { day: 80, pct: 4 }]);
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
    let alive = true;
    const refresh = () => getSolarFeed().then(data => {
      if (alive) { setSolarFeed(data); setSolarError(''); }
    }).catch(error => { if (alive) setSolarError((error as Error).message); });
    refresh();
    const timer = setInterval(refresh, 15 * 60 * 1000);
    return () => { alive = false; clearInterval(timer); };
  }, []);

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    addEventListener('online', on); addEventListener('offline', off);
    return () => { removeEventListener('online', on); removeEventListener('offline', off); clear(); };
  }, []);

  const signOut = () => { saveSession(null); setSession(null); setSt(null); setLoadError(''); };

  if (!session) return <Auth onSession={setSession} />;

  if (loadError) return (
    <div className="app">
      <div className="top"><h1>Status</h1></div>
      <div className="card"><h2>Can’t reach your baseline</h2><p className="mut">{loadError}</p></div>
      <button className="btn" onClick={() => setReload(n => n + 1)}>Try again</button>
      <button className="link" onClick={signOut}>Sign out</button>
    </div>
  );

  if (!st) return (
    <div className="app"><h1>Status</h1><div className="card"><h2>Learning your baseline</h2><p className="mut">Comparing your latest resting readings…</p></div>
      <div className="card skel" /></div>);

  const s = st.systems.find(x => x.id === sel)!;
  const by = (id: string) => st.systems.find(x => x.id === id)!;
  const rows = s.categories.map(c => st.results[c]).filter((r): r is CategoryScore => !!r);
  const watchSystems = st.systems.filter(x => x.status === 'yellow');
  const alertSystems = st.systems.filter(x => x.status === 'red');
  const pendingSystems = st.systems.filter(x => x.status === 'grey');
  const attentionSystems = [...alertSystems, ...watchSystems];
  const openCount = attentionSystems.length + pendingSystems.length;
  const watchNames = attentionSystems.map(x => x.name);
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
    arms: mapStatus(by('muscle').status), legs: mapStatus(by('bones').status),
  };
  const bodySelection: SystemId = sel === 'muscle' ? 'arms' : sel === 'bones' ? 'legs' : sel as SystemId;
  const dim = (x: Sys) => hz && !x.hazards.includes(hz);
  const pick = (id: string) => { setSel(id); setOpen(true); };
  const pickBody = (id: SystemId) => setSel(id === 'arms' ? 'muscle' : id === 'legs' ? 'bones' : id);
  const plan = actionFor(delay);
  const detail = (x: Sys) => x.status === 'grey' ? 'No readings yet' : `${TREND[x.trend]} · ${x.z.toFixed(1)} SD from baseline`;

  async function send() {
    clear(); setPhase('sent'); setStamp(hm());
    const excerpts = st.alert.evidence_results?.map(item => `${item.title}: ${item.snippet}`).join(' ');
    const evidenceText = st.alert.evidence_summary || excerpts;
    const packet = [
      st.alert.text,
      evidenceText && `Retrieved evidence: ${evidenceText}`,
      `Recommended plan: ${plan}`,
      'Evidence sources:',
      ...st.alert.cites.map(cite => `${cite.title}: ${cite.url}`),
    ].filter(Boolean).join('\n');
    const relay = sendAlert(packet);
    timers.current.push(setTimeout(() => { setPhase('waiting'); setStamp(hm()); }, demoOneWayMs));
    timers.current.push(setTimeout(() => { setPhase('escalated'); setStamp(hm()); }, demoRoundTripMs));
    await relay;
  }
  const ack = () => { clear(); setPhase('acked'); setStamp(hm()); };
  const reset = () => { clear(); setPhase('idle'); };
  const currentDose = SIMULATED_DOSE.find(point => point.day === st.day) ?? SIMULATED_DOSE[SIMULATED_DOSE.length - 1];
  const projectedDose = SIMULATED_DOSE[SIMULATED_DOSE.length - 1];
  const currentDosePercent = Math.round(currentDose.ignored / DOSE_MODEL_REFERENCE_MSV * 100);
  const demoOneWayMs = Math.max(250, Math.round(delay * 1000 / 60));
  const demoRoundTripMs = demoOneWayMs * 2;

  const sub = { idle: 'Connected, across the distance', sent: `Sent at ${stamp} · queued for relay`, waiting: `Packet reached Earth · ${stamp}`,
    acked: `Acknowledged at ${stamp}`, escalated: `Escalated onboard at ${stamp}` }[phase];
  const foot = { idle: `${fmt(delay)} one way · ~${fmt(delay * 2)} round trip`, sent: `Compressed demo: ${fmtDemo(demoOneWayMs)} to Earth`, waiting: `Compressed demo: ${fmtDemo(demoOneWayMs)} until escalation`,
    acked: 'Flight clinician received your evidence', escalated: 'No reply yet · follow onboard protocol' }[phase];
  const guide = () => { setSel('heart'); setOpen(true); };
  const [label, action] = ({ idle: [online ? 'Send to Earth' : 'Queue for Earth', send], sent: ['Message sent', null], waiting: ['Waiting for Earth', null],
    acked: ['Review heart guidance', guide], escalated: ['View onboard protocol', guide] } as any)[phase] as [string, (() => void) | null];

  const chip = (id: string) => { const x = by(id); return (
    <button key={id} className={`sys ${sel === id ? 'on' : ''} ${dim(x) ? 'dim' : ''}`} onClick={() => pick(id)}>
      <b>{x.name}</b><span className={x.status}>{GLYPH[x.status]} {WORD[x.status]}</span></button>); };

  return (
    <div className="app">
      {st.demo && <div className="demo-ribbon">SIMULATED DEMO DATA · 7 baseline days · 5 after-change days</div>}
      {tab === 'status' && <>
        <div className="top"><h1>Status</h1><button className="x" aria-label="Sources and safety" onClick={() => setInfo(true)}>ⓘ</button></div>
        <p className="sub">Mission day {st.day} · {st.overall.status === 'scored' ? `Experimental trend score ${st.overall.score}/10` : 'Experimental score pending'}</p>
        <section className="brief card" aria-label="Mission overview">
          <div className="brief-top"><span className="eyebrow">NOW · MISSION BRIEF</span><span className="live-tag"><i /> LIVE</span></div>
          <div className="brief-main"><div><strong>{alertSystems.length ? `${alertSystems.length} active alert${alertSystems.length > 1 ? 's' : ''}` : watchSystems.length ? `${watchSystems.length} systems on watch` : pendingSystems.length ? `${pendingSystems.length} systems need data` : 'All systems stable'}</strong><p>{watchSummary}</p></div><span className={`brief-count ${alertSystems.length ? 'has-alert' : ''}`}>{String(openCount).padStart(2, '0')}<small>{alertSystems.length ? 'ALERT' : watchSystems.length ? 'WATCH' : 'OPEN'}</small></span></div>
          <button className="brief-action" onClick={() => pick(attentionSystems[0]?.id || pendingSystems[0]?.id || 'heart')}>Review priority system <span>↗</span></button>
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
          <div className="body-selection"><span className={`selection-dot ${s.status}`} /><div><b>{s.name}</b><small>{detail(s)}</small></div><button onClick={() => setOpen(true)}>Details <span>›</span></button></div>
        </section>
        <ul className="card list">
          {STATUS_ORDER.map(id => by(id)).map(x => (
            <li key={x.id} className={dim(x) ? 'dim' : ''}><button onClick={() => pick(x.id)}>
              <span className="name"><svg className={`sys-icon ${x.status}`} viewBox="0 0 24 24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{SYS_ICON[x.id]}</svg><span><b>{x.name}</b><small>{detail(x)}</small></span></span>
              <span className="r"><em className={x.status}>{GLYPH[x.status]} {WORD[x.status]}</em><small>{TREND[x.trend]} ›</small></span></button></li>))}
        </ul>
      </>}

      {tab === 'dose' && <>
        <h1>Dose</h1><p className="sub">Your radiation exposure</p>
        <div className="card dose-lifetime">
          <div className="between"><p className="eyebrow">LIFETIME DOSE · SIMULATED</p><span className="model-pill">MODEL DATA</span></div>
          <div className="dose-total"><strong>{Math.round(currentDose.ignored)}</strong><span>mSv<br/>mission day {st.day}</span></div>
          <div className="dose-progress" role="img" aria-label={`${currentDosePercent}% of illustrative model reference`}><i style={{ width: `${Math.min(currentDosePercent, 100)}%` }} /></div>
          <div className="dose-stats"><span><small>MODEL REFERENCE</small><b>{DOSE_MODEL_REFERENCE_MSV} mSv</b></span><span><small>USED IN MODEL</small><b>{currentDosePercent}%</b></span><span><small>DAY 240 · NO SHELTER</small><b>{Math.round(projectedDose.ignored)} mSv</b></span></div>
          <p className="solar-foot">Hardcoded training scenario, not dosimeter readings or a validated personal safety limit.</p>
        </div>
        <div className="card dose-chart-card">
          <div className="between"><div><p className="eyebrow">ILLUSTRATIVE SCENARIO</p><h2>Mission dose projection</h2></div></div>
          <div className="seg dose-mode"><button className={doseView === 'no' ? 'on' : ''} onClick={() => setDoseView('no')}>No shelter</button><button className={doseView === 'sheltered' ? 'on' : ''} onClick={() => setDoseView('sheltered')}>Sheltered after day {st.day}</button></div>
          <ResponsiveContainer width="100%" height={190}>
            <LineChart data={SIMULATED_DOSE} margin={{ top: 8, right: 4, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="var(--sep)" vertical={false} />
              <XAxis dataKey="day" type="number" domain={[0, 240]} ticks={[1, 80, 160, 240]} tick={{ fill: 'var(--mute)', fontSize: 10 }} stroke="var(--sep)" />
              <YAxis domain={[0, 650]} ticks={[0, 300, 600]} tick={{ fill: 'var(--mute)', fontSize: 10 }} stroke="var(--sep)" />
              <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--sep)', borderRadius: 10, fontSize: 12 }} labelFormatter={day => `Mission day ${day}`} formatter={(value, name) => [`${value} mSv`, name === 'ignored' ? 'No shelter' : 'Sheltered']} />
              <ReferenceLine y={DOSE_MODEL_REFERENCE_MSV} stroke="var(--yellow)" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="ignored" name="No shelter" stroke="var(--mute)" dot={false} strokeWidth={doseView === 'no' ? 3 : 1.5} isAnimationActive={false} />
              <Line type="monotone" dataKey="sheltered" name="Sheltered" stroke="var(--blue)" dot={false} strokeWidth={doseView === 'sheltered' ? 3 : 1.5} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
          <div className="dose-legend mut"><span><i className="legend-gray" />No shelter</span><span><i className="legend-blue" />Sheltered after today</span><span><i className="legend-yellow" />Model reference</span></div>
          <p className="solar-foot">At day 240, this fixed scenario projects {Math.round(projectedDose.ignored - projectedDose.sheltered)} mSv less in the sheltered path. Real exposure depends on measured radiation, vehicle shielding, trajectory, and mission procedures.</p>
        </div>
        <section className="card solar-card" aria-label="NASA solar particle event reports">
          <div className="solar-heading"><div><p className="eyebrow">SPACE WEATHER · NASA DONKI</p><h2>Solar particle events</h2></div></div>
          <p className="solar-feed">Observed event reports from the past 7 days · refreshed every 15 minutes</p>
          {solarError && <div className="solar-event"><span className="solar-symbol" aria-hidden="true">!</span><div><b>NASA feed unavailable</b><small>{solarError}</small></div><button className="link" onClick={() => getSolarFeed().then(data => { setSolarFeed(data); setSolarError(''); }).catch(error => setSolarError((error as Error).message))}>Retry</button></div>}
          {!solarError && !solarFeed && <p className="mut">Loading NASA event reports…</p>}
          {!solarError && solarFeed && (solarFeed.events.length ? <div className="solar-events">{solarFeed.events.map((event, index) => <div className="solar-event" key={`${event.eventTime}-${index}`}><span className="solar-symbol" aria-hidden="true">☼</span><div><b>{index === 0 ? 'Latest reported event' : 'Reported event'}</b><small>{event.eventTime ? new Date(event.eventTime).toLocaleString() : 'Time not provided'}{event.instruments?.length ? ` · ${event.instruments.map(instrument => instrument.displayName).filter(Boolean).join(', ')}` : ''}</small></div>{event.link && <a className="solar-severity" href={event.link} target="_blank" rel="noreferrer">NASA ↗</a>}</div>)}</div> : <p className="mut">No solar energetic particle reports in this 7-day catalog window. This does not mean radiation risk is absent.</p>)}
          <p className="solar-foot">NASA DONKI reports observed events; it does not provide crew exposure or a shelter-time forecast. Use onboard dosimeters and mission radiation procedures for decisions. <a href="https://ccmc.gsfc.nasa.gov/DONKI/" target="_blank" rel="noreferrer">Open NASA DONKI ↗</a>{solarFeed?.fetchedAt ? ` · Updated ${new Date(solarFeed.fetchedAt).toLocaleTimeString()}` : ''}</p>
        </section>
      </>}

      {tab === 'earth' && <>
        <h1>Earth</h1><p className="sub">{sub}</p>
        <div className="card">
          <p className="eyebrow warn">⚠ WATCH · HEART</p>
          {st.alert.explanation_source && <p className="explanation-source">{st.alert.explanation_source === 'openrouter' ? `LLM-generated · ${st.alert.explanation_model || 'OpenRouter'}` : 'Template fallback · LLM unavailable'}</p>}
          {st.alert.evidence_provider && st.alert.evidence_provider !== 'none' && <p className="explanation-source">{st.alert.evidence_provider === 'serpapi' ? 'Evidence retrieved with SerpApi' : st.alert.evidence_provider === 'curated' ? 'SERPAPI_API_KEY not set · showing curated sources' : 'SerpApi unavailable · showing curated sources'}</p>}
          <h2>{st.alert.title || 'Alert'}</h2><p className="mut">{st.alert.text}</p>
          {st.alert.evidence_summary && <div className="evidence-summary"><b>Retrieved research context</b><p>{st.alert.evidence_summary}</p></div>}
          {!st.alert.evidence_summary && !!st.alert.evidence_results?.length && <div className="evidence-snippets"><b>Retrieved source excerpts</b>{st.alert.evidence_results.map(item => <p key={item.url}>{item.snippet}</p>)}</div>}
          <ul className="cites">{st.alert.cites.map(c => <li key={c.url}><a href={c.url}>↗ {c.title} ›</a></li>)}</ul>
        </div>
        {!online && <div className="card"><b>Working offline, will sync when the link returns</b><p className="mut">Follow the onboard medical protocol.</p></div>}
        <div className="card">
          <div className="between"><b>Message delay</b><b className="blue">{fmt(delay)}</b></div>
          <input type="range" min={2} max={1200} value={delay} aria-label="Message delay" onChange={e => setDelay(+e.target.value)} />
          <div className="between mut"><small>2 s</small><small>1 min</small><small>20 min</small></div>
          <p className="mut demo-timing">Demo clock: about 1 real second per simulated minute, with a 250 ms minimum per leg.</p>
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
        <ReadingLogger userid={session.userid} onSaved={() => setReload(n => n + 1)} />
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
      {open && <Sheet title={s.name} onClose={() => setOpen(false)}>
        {rows.length > 0 && <>
          <h3>Your readings</h3>
          {rows.map(r => (
            <div key={r.category} className="live">
              <div className="between"><b>{CATEGORY_META[r.category].label}</b><em className={r.color}>{r.status === 'scored' ? `${r.score}/10` : 'Pending'}</em></div>
              <p className="mut">{describe(r)}</p>
              {r.explanation && <><p className="explanation-source">{r.explanation_source === 'openrouter' ? `LLM-generated · ${r.explanation_model || 'OpenRouter'}` : 'Template fallback · LLM unavailable'}</p><p>{r.explanation}</p></>}
              {r.drift_detected && <p className="trend-flag">CUSUM flagged a sustained personal-baseline shift · experimental alert</p>}
              {!!r.explanation_plan?.length && <ul className="srcs">{r.explanation_plan.map(item => <li key={item}>{item}</li>)}</ul>}
              {!!r.explanation_watch_for?.length && <p className="mut">Watch for {r.explanation_watch_for.join(', ')}.</p>}
              {r.explanation_caveat && <p className="mut">{r.explanation_caveat}</p>}
            </div>
          ))}
        </>}
        <h3>How it’s measured</h3><p>{s.measure}</p>
        <h3>How spaceflight changes it</h3><p>{s.change}</p>
        <h3>When to escalate</h3><p>{s.escalate}</p>
        <p className="mut">Source context: {s.source}. Experimental trend indicator only; not a diagnosis or validated astronaut-health threshold.</p></Sheet>}
      {info && <Sheet title="Sources and safety" onClose={() => setInfo(false)}>
        <ul className="source-list">{SOURCES.map(x => <li key={x.title}><a href={x.url} target="_blank" rel="noreferrer">{x.title} ↗</a><p className="mut">{x.supports}</p></li>)}</ul>
        <p className="mut">This prototype uses experimental trend indicators. Its scores and simulated readings are not validated astronaut-health thresholds or a diagnosis.</p>
        <h3>Account</h3>
        <p className="mut">{session.phone}</p>
        <button className="link" onClick={signOut}>Sign out</button>
      </Sheet>}
    </div>
  );
}
