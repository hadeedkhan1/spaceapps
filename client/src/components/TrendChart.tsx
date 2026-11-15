import type { SeriesPoint, Status } from '../contract';

const W = 320;
const H = 132;
const PAD = { l: 34, r: 10, t: 10, b: 22 };

const fmtDay = (date: string) => {
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export default function TrendChart({
  series,
  baseline,
  spread,
  unit,
  label,
  status,
}: {
  series: SeriesPoint[];
  baseline?: number;
  spread?: number;
  unit: string;
  label: string;
  status: Status;
}) {
  if (!series.length) return <p className="note">No readings to chart yet.</p>;

  const values = series.map(p => p.value);
  const band = baseline != null && spread != null ? [baseline - spread, baseline + spread] : [];
  const lo = Math.min(...values, ...band);
  const hi = Math.max(...values, ...band);
  const pad = (hi - lo || 1) * 0.15;
  const yMin = lo - pad;
  const yMax = hi + pad;
  const x = (i: number) => PAD.l + (series.length === 1 ? (W - PAD.l - PAD.r) / 2 : (i / (series.length - 1)) * (W - PAD.l - PAD.r));
  const y = (v: number) => PAD.t + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);
  const firstAfter = series.findIndex(p => p.phase === 'after');
  const path = series.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const fmt = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1));
  const summary = `${label} trend over ${series.length} days, from ${fmt(values[0])} to ${fmt(values[values.length - 1])} ${unit}.`;

  return (
    <figure className={`trend ${status}`}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary}>
        {band.length === 2 && (
          <rect className="trend-band" x={PAD.l} width={W - PAD.l - PAD.r} y={y(band[1])} height={Math.max(2, y(band[0]) - y(band[1]))} />
        )}
        {baseline != null && (
          <line className="trend-base" x1={PAD.l} x2={W - PAD.r} y1={y(baseline)} y2={y(baseline)} />
        )}
        {firstAfter > 0 && (
          <line className="trend-split" x1={x(firstAfter) - (x(1) - x(0)) / 2} x2={x(firstAfter) - (x(1) - x(0)) / 2} y1={PAD.t} y2={H - PAD.b} />
        )}
        <text className="trend-axis" x={PAD.l - 6} y={y(yMax - pad * 0.6) + 3} textAnchor="end">{fmt(yMax - pad * 0.6)}</text>
        <text className="trend-axis" x={PAD.l - 6} y={y(yMin + pad * 0.6) + 3} textAnchor="end">{fmt(yMin + pad * 0.6)}</text>
        <path className="trend-line" d={path} />
        {series.map((p, i) => (
          <circle key={p.date} className={`trend-dot ${p.phase}`} cx={x(i)} cy={y(p.value)} r={3.2}>
            <title>{`${fmtDay(p.date)}: ${fmt(p.value)} ${unit}`}</title>
          </circle>
        ))}
        <text className="trend-axis" x={PAD.l} y={H - 6}>{fmtDay(series[0].date)}</text>
        <text className="trend-axis" x={W - PAD.r} y={H - 6} textAnchor="end">{fmtDay(series[series.length - 1].date)}</text>
      </svg>
      <figcaption>
        <span><i className="key base" />Baseline</span>
        <span><i className="key after" />After change</span>
        {band.length === 2 && <span><i className="key band" />Normal range for you</span>}
      </figcaption>
    </figure>
  );
}
