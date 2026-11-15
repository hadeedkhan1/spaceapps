import { FormEvent, useState } from 'react';
import { addReading } from '../api';
import { CATEGORY_IDS, CATEGORY_META } from '../contract';
import type { Category, ReadingPhase } from '../contract';

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function ReadingLogger({ userid, onSaved, preset }: { userid: string; onSaved: () => void; preset?: Category }) {
  const [category, setCategory] = useState<Category>(preset ?? 'heart_rate');
  const [phase, setPhase] = useState<ReadingPhase>('after');
  const [date, setDate] = useState(todayLocal);
  const [value, setValue] = useState(String(CATEGORY_META[preset ?? 'heart_rate'].sample));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const meta = CATEGORY_META[category];

  function choose(next: Category) {
    setCategory(next);
    setValue(String(CATEGORY_META[next].sample));
    setStatus(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const reading = Number(value);
    if (!Number.isFinite(reading)) {
      setStatus({ kind: 'error', text: 'Enter a number.' });
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      await addReading({
        userid,
        category,
        value: reading,
        time: phase,
        recorded_at: date,
      });
      setStatus({ kind: 'ok', text: `${meta.label} saved.` });
      onSaved();
    } catch (err) {
      setStatus({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel" onSubmit={submit}>
      <div className="between"><h2>Log a reading</h2></div>
      <div className="metrics" role="group" aria-label="Metric">
        {CATEGORY_IDS.map(id => (
          <button key={id} type="button" className={category === id ? 'on' : ''}
            aria-pressed={category === id} onClick={() => choose(id)}>
            {CATEGORY_META[id].label}
          </button>
        ))}
      </div>
      <div className="seg" role="group" aria-label="Phase">
        <button type="button" className={phase === 'before' ? 'on' : ''} onClick={() => setPhase('before')}>
          Baseline
        </button>
        <button type="button" className={phase === 'after' ? 'on' : ''} onClick={() => setPhase('after')}>
          After change
        </button>
      </div>
      <details className="howto">
        <summary>How to measure {meta.label.toLowerCase()}</summary>
        <ol>{meta.howto.map(step => <li key={step}>{step}</li>)}</ol>
        <p className="mut">{meta.why}</p>
      </details>
      <div className="field">
        <label htmlFor="reading-date">Date measured</label>
        <input id="reading-date" type="date" value={date} max={todayLocal()}
          onChange={e => setDate(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="reading-value">{meta.label} in {meta.unit}</label>
        <input id="reading-value" type="number" step={meta.step} inputMode="decimal"
          value={value} onChange={e => setValue(e.target.value)} required />
      </div>
      {status && <p className={status.kind === 'error' ? 'err-line' : 'mut'}>{status.text}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save reading'}</button>
      <p className="note">Log a few baseline days while you feel well, then log each day after. One baseline reading plus one after reading unlocks a score; you can backdate readings.</p>
    </form>
  );
}
