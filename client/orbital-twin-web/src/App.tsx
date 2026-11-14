import { useEffect, useRef, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, CartesianGrid } from 'recharts';
import { HAZARDS, Hazard, State } from './contract';
import { getState, sendAlert, actionFor } from './api';
import BodyMap, { COLOR, ARROW } from './components/BodyMap';
import Selfie from './components/Selfie';

type Phase = 'idle' | 'sent' | 'acked' | 'escalated';
const PHASE_TEXT: Record<Phase, string> = {
  idle: 'No message sent yet.', sent: 'Sent to Earth. Waiting for acknowledgment\u2026',
  acked: 'Acknowledged. Crew moved to shelter, dose is slowing.', escalated: 'No reply. Escalated to the ground contact; dose keeps climbing.' };

export default function App() {
  const [st, setSt] = useState<State | null>(null);
  const [sel, setSel] = useState('heart');
  const [hz, setHz] = useState<Hazard | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [delay, setDelay] = useState(1200);
  const [face, setFace] = useState([{ day: 0, pct: 0 }, { day: 10, pct: 0.6 }, { day: 20, pct: 1.4 }, { day: 30, pct: 2.1 }]);
  const timer = useRef<any>();
  useEffect(() => { getState().then(setSt); }, []);
  if (!st) return <p className="note">Loading\u2026</p>;

  const s = st.systems.find(x => x.id === sel)!;
  const last = st.dose.series[st.dose.series.length - 1];
  const used = phase === 'acked' ? last.sheltered : last.ignored;
  const pct = Math.round((used / st.dose.limit) * 100);
  const plan = actionFor(delay);

  async function send() {
    setPhase('sent');
    await sendAlert(`${st!.alert.text} Plan: ${plan}`);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setPhase(p => (p === 'sent' ? 'escalated' : p)), 20000);
  }
  const ack = () => { clearTimeout(timer.current); setPhase('acked'); };
  const onFace = (p: number) => setFace(f => [...f, { day: f[f.length - 1].day + 10, pct: p }]);

  return (
    <main>
      <header><h1>Orbital Twin</h1><p>Day {st.day} of the mission. Health status against this astronaut\u2019s own baseline.</p></header>

      <section className="map card">
        <div className="chips" role="group" aria-label="Hazard overlay">
          <button className={hz ? 'ghost' : ''} onClick={() => setHz(null)}>All systems</button>
          {HAZARDS.map(h => <button key={h} className={hz === h ? '' : 'ghost'} onClick={() => setHz(hz === h ? null : h)}>{h}</button>)}
        </div>
        <BodyMap systems={st.systems} sel={sel} onSel={setSel} hz={hz} />
        <ul className="legend">
          {st.systems.map(x => (
            <li key={x.id}><button className={sel === x.id ? 'on' : 'ghost'} onClick={() => setSel(x.id)}>
              <i style={{ background: COLOR[x.status] }} />{x.name}: {x.status} {ARROW[x.trend]}</button></li>))}
        </ul>
      </section>

      <section className="card">
        <h2>{s.name} <small>{s.z.toFixed(1)} SD from baseline</small></h2>
        <h3>How it is measured</h3><p>{s.measure}</p>
        <h3>How spaceflight changes it</h3><p>{s.change}</p>
        <h3>When to escalate</h3><p>{s.escalate}</p>
        <p className="note">Source: {s.source}</p>
      </section>

      <section className="card">
        <h2>Radiation dose <small>{pct}% of career limit</small></h2>
        <div className="bar"><b style={{ width: `${Math.min(pct, 100)}%`, background: pct > 66 ? COLOR.red : pct > 33 ? COLOR.yellow : COLOR.green }} /></div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={st.dose.series}><CartesianGrid stroke="#26334d" />
            <XAxis dataKey="day" stroke="#93a1bd" /><YAxis stroke="#93a1bd" /><Tooltip />
            <ReferenceLine y={st.dose.limit} stroke={COLOR.red} strokeDasharray="4 4" />
            <Line dataKey="ignored" name="No shelter (mSv)" stroke={COLOR.red} dot={false} strokeWidth={phase === 'acked' ? 1 : 3} />
            <Line dataKey="sheltered" name="Sheltered (mSv)" stroke={COLOR.green} dot={false} strokeWidth={phase === 'acked' ? 3 : 1} />
          </LineChart>
        </ResponsiveContainer>
        <p className="note">Illustrative model. Storm rates and shielding are assumptions; verify the limit and background rate in NASA-STD-3001 and MSL RAD papers.</p>
      </section>

      <section className="card">
        <h2>Alert to Earth</h2>
        <p>{st.alert.text}</p>
        <ul>{st.alert.cites.map(c => <li key={c.title}><a href={c.url}>{c.title}</a></li>)}</ul>
        <label>Message delay: {delay < 60 ? `${delay} s` : `${Math.round(delay / 60)} min`}
          <input type="range" min={1} max={1500} value={delay} onChange={e => setDelay(+e.target.value)} /></label>
        <p><b>Recommended action:</b> {plan}</p>
        <div className="row">
          <button onClick={send} disabled={phase !== 'idle'}>Send to Earth</button>
          {phase === 'sent' && <button className="ghost" onClick={ack}>Simulate reply</button>}
          {phase !== 'idle' && <button className="ghost" onClick={() => setPhase('idle')}>Reset</button>}
        </div>
        <p className="note" aria-live="polite">{PHASE_TEXT[phase]}</p>
      </section>

      <section className="card">
        <h2>Daily photo <small>face puffiness vs day one</small></h2>
        <Selfie onMetric={onFace} />
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={face}><XAxis dataKey="day" stroke="#93a1bd" /><YAxis stroke="#93a1bd" unit="%" /><Tooltip />
            <Line dataKey="pct" stroke={COLOR.yellow} strokeWidth={2} /></LineChart>
        </ResponsiveContainer>
      </section>

      <footer className="note">Prototype, not a diagnosis. Data: NOAA GOES, NASA DONKI, NASA MSL RAD, NASA-STD-3001, NASA HRP, WESAD/PhysioNet. Simulated drifts are labeled as simulated.</footer>
    </main>
  );
}
