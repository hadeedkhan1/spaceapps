import { CATEGORY_IDS, CATEGORY_META } from '../contract';
import type { Category, CategoryScore } from '../contract';

type Results = Partial<Record<Category, CategoryScore>>;

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function missionStats(results: Results) {
  const dates = new Set<string>();
  let readings = 0;
  const loggedToday: Category[] = [];
  const today = dayKey(new Date());
  for (const id of CATEGORY_IDS) {
    const r = results[id];
    if (!r) continue;
    readings += (r.before_readings ?? 0) + (r.after_readings ?? 0);
    for (const p of r.series ?? []) dates.add(p.date);
    if ((r.series ?? []).some(p => p.date === today)) loggedToday.push(id);
  }
  const cursor = new Date();
  if (!dates.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (dates.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  const due = CATEGORY_IDS.filter(id => !loggedToday.includes(id));
  const points = readings * 10 + streak * 25;
  const level = Math.floor(points / 250) + 1;
  const badges = [
    { name: 'First reading', earned: readings > 0 },
    { name: 'Baseline set', earned: CATEGORY_IDS.every(id => (results[id]?.before_days ?? 0) > 0) },
    { name: '3-day streak', earned: streak >= 3 },
    { name: '7-day streak', earned: streak >= 7 },
    { name: 'Full check-in today', earned: due.length === 0 },
  ];
  return { streak, due, points, level, badges, into: points % 250 };
}

export default function Mission({ results, onLog }: { results: Results; onLog: (category: Category) => void }) {
  const m = missionStats(results);
  return (
    <section className="panel mission">
      <div className="panel-head">
        <h2>Today’s check-in</h2>
        <span className="hint">{m.due.length ? `${m.due.length} of ${CATEGORY_IDS.length} due` : 'All done'}</span>
      </div>
      <div className="mission-stats">
        <div><b>{m.streak}</b><small>Day streak</small></div>
        <div><b>{m.points}</b><small>Points</small></div>
        <div><b>{m.level}</b><small>Level</small></div>
      </div>
      <div className="meter" role="progressbar" aria-label="Progress to next level" aria-valuemin={0} aria-valuemax={250} aria-valuenow={m.into}>
        <i style={{ width: `${(m.into / 250) * 100}%` }} />
      </div>
      {m.due.length > 0 ? (
        <ul className="due">
          {m.due.map(id => (
            <li key={id}>
              <button onClick={() => onLog(id)}>
                <span>{CATEGORY_META[id].label}</span>
                <small>Log now</small>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="note">Every indicator is logged for today. Nice work.</p>
      )}
      <ul className="badges">
        {m.badges.map(b => <li key={b.name} className={b.earned ? 'earned' : ''}>{b.name}</li>)}
      </ul>
    </section>
  );
}
