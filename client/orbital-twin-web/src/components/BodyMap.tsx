import { Sys, Hazard } from '../contract';
export default function BodyMap({ systems, sel, onSel, hz }: { systems: Sys[]; sel: string; onSel: (id: string) => void; hz: Hazard | null }) {
  const p = (id: string): any => {
    const s = systems.find(x => x.id === id)!;
    const dim = hz && !s.hazards.includes(hz);
    return { fill: `var(--${s.status})`, opacity: dim ? 0.2 : 1, stroke: sel === id ? 'var(--ink)' : 'none', strokeWidth: 2,
      onClick: () => onSel(id), onKeyDown: (e: any) => e.key === 'Enter' && onSel(id),
      style: { cursor: 'pointer' }, tabIndex: 0, role: 'button', 'aria-label': `${s.name}: ${s.status}` };
  };
  return (
    <svg viewBox="0 0 200 380" className="body" role="group" aria-label="Body map">
      <g fill="var(--body)">
        <circle cx="100" cy="45" r="28" /><rect x="65" y="80" width="70" height="125" rx="26" />
        <rect x="40" y="85" width="18" height="110" rx="9" /><rect x="142" y="85" width="18" height="110" rx="9" />
        <rect x="70" y="200" width="28" height="170" rx="12" /><rect x="102" y="200" width="28" height="170" rx="12" />
      </g>
      <ellipse cx="100" cy="34" rx="18" ry="10" {...p('brain')} />
      <g {...p('eyes')}><circle cx="90" cy="52" r="5" /><circle cx="110" cy="52" r="5" /></g>
      <circle cx="108" cy="120" r="13" {...p('heart')} />
      <ellipse cx="100" cy="168" rx="22" ry="15" {...p('immune')} />
      <g {...p('bones')}><rect x="97" y="88" width="6" height="105" /><rect x="80" y="215" width="8" height="140" /><rect x="112" y="215" width="8" height="140" /></g>
      <g {...p('muscle')}><rect x="43" y="90" width="12" height="100" rx="6" /><rect x="145" y="90" width="12" height="100" rx="6" /></g>
    </svg>
  );
}
