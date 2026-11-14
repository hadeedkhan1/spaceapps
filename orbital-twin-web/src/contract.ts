// API CONTRACT with Person A. Change it only by agreeing together.
export type Status = 'green' | 'yellow' | 'red';
export type Hazard = 'radiation' | 'isolation' | 'distance' | 'gravity' | 'environment';
export const HAZARDS: Hazard[] = ['radiation', 'isolation', 'distance', 'gravity', 'environment'];
export interface Sys { id: string; name: string; status: Status; trend: 'up' | 'flat' | 'down'; z: number;
  hazards: Hazard[]; measure: string; change: string; escalate: string; source: string }
export interface DosePt { day: number; ignored: number; sheltered: number }
export interface State { day: number; systems: Sys[];
  dose: { limit: number; series: DosePt[] };
  alert: { text: string; cites: { title: string; url: string }[] } }

const S = (id: string, name: string, status: Status, trend: Sys['trend'], z: number, hazards: Hazard[],
  measure: string, change: string, escalate: string): Sys =>
  ({ id, name, status, trend, z, hazards, measure, change, escalate, source: 'NASA HRP / NASA-STD-3001 (replace with real citation)' });

let ig = 0, sh = 0;
const series: DosePt[] = [];
for (let d = 0; d <= 120; d++) {
  const storm = d >= 60 && d < 64 ? 25 : 0; // illustrative storm
  ig += 1.8 + storm; sh += 1.8 + storm * 0.35;
  series.push({ day: d, ignored: +ig.toFixed(1), sheltered: +sh.toFixed(1) });
}

export const MOCK: State = {
  day: 80,
  systems: [
    S('heart', 'Heart', 'yellow', 'up', 1.8, ['radiation', 'gravity', 'isolation'],
      'Resting HR and HRV from a wearable or pulse sensor, each morning.',
      'Microgravity and stress shift resting HR and HRV; radiation adds long-term risk.',
      'Sustained resting HR above personal baseline for 3+ days, or chest symptoms.'),
    S('bones', 'Bones', 'green', 'flat', 0.4, ['gravity'],
      'Exercise load logs now; bone scans are periodic.',
      'Reduced loading in microgravity lowers bone density over months.',
      'Missed resistive exercise for several days, or new bone pain.'),
    S('immune', 'Immune', 'green', 'flat', 0.6, ['radiation', 'isolation', 'environment'],
      'Temperature, symptom check-in, sleep quality.',
      'Stress, radiation and a closed environment can alter immune function.',
      'Fever, persistent infection signs, or a rash.'),
    S('eyes', 'Eyes', 'yellow', 'up', 1.2, ['gravity', 'environment'],
      'Daily selfie puffiness trend plus a quick vision check.',
      'Fluid shifts toward the head, causing facial puffiness and vision changes.',
      'Blurred vision, headaches, or a sustained puffiness rise.'),
    S('brain', 'Brain', 'green', 'flat', 0.3, ['isolation', 'distance', 'radiation'],
      'Sleep hours, mood check-in, reaction-time test.',
      'Isolation, delay from Earth and circadian disruption affect mood and focus.',
      'Persistent low mood, severe sleep loss, or missed check-ins.'),
    S('muscle', 'Muscle', 'green', 'down', 0.8, ['gravity'],
      'Strength sessions logged; grip or leg-press checks.',
      'Unloaded muscles atrophy unless countered by exercise.',
      'Sharp strength drop or pain during exercise.'),
  ],
  dose: { limit: 600, series }, // limit & rates: verify against NASA-STD-3001 / MSL RAD
  alert: { text: 'Resting HR is 1.8 SD above this astronaut\u2019s baseline for 3 days, while dose is rising after a solar event.',
    cites: [{ title: 'Evidence engine results go here (Person A)', url: '#' }] },
};
