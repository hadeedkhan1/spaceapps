export type Status = 'green' | 'yellow' | 'red' | 'grey';
export type Hazard = 'radiation' | 'isolation' | 'distance' | 'gravity' | 'environment';
export const HAZARDS: Hazard[] = ['radiation', 'isolation', 'distance', 'gravity', 'environment'];

export type Category = 'sleep_hours' | 'mood' | 'hrv' | 'heart_rate' | 'temperature' | 'glucose' | 'vision_symptoms';
export type ReadingPhase = 'before' | 'after';

export const CATEGORY_META: Record<Category, { label: string; unit: string; step: number; sample: number }> = {
  sleep_hours: { label: 'Sleep', unit: 'hours', step: 0.1, sample: 7.5 },
  mood: { label: 'Mood', unit: '0–10', step: 0.5, sample: 7 },
  hrv: { label: 'HRV', unit: 'ms', step: 1, sample: 45 },
  heart_rate: { label: 'Resting HR', unit: 'bpm', step: 1, sample: 62 },
  temperature: { label: 'Temperature', unit: '°C', step: 0.1, sample: 36.8 },
  glucose: { label: 'Glucose', unit: 'mg/dL', step: 1, sample: 92 },
  vision_symptoms: { label: 'Vision symptoms', unit: '0–10', step: 1, sample: 0 },
};
export const CATEGORY_IDS = Object.keys(CATEGORY_META) as Category[];

export interface Reading {
  userid: string;
  category: Category;
  value: number;
  time: ReadingPhase;
  recorded_at?: string;
}

export interface WorstCategory {
  category: Category;
  score: number;
  color: Status;
}

export interface ScoreResult {
  category: Category | 'overall';
  label: string;
  status: 'scored' | 'needs_before_data' | 'needs_after_data' | 'needs_data';
  color: Status;
  score: number | null;
  before_days?: number;
  after_days?: number;
  baseline?: number;
  after_avg?: number;
  recent?: number;
  change?: number;
  change_pct?: number | null;
  z?: number;
  drift_detected?: boolean;
  hard_limit_hit?: boolean;
  worst?: WorstCategory[];
  explanation?: string;
  explanation_plan?: string[];
  explanation_watch_for?: string[];
  explanation_urgency?: 'routine' | 'soon' | 'urgent';
  explanation_caveat?: string;
  explanation_source?: 'openrouter' | 'fallback';
  explanation_model?: string;
  explanation_error?: string;
  evidence_summary?: string;
  evidence_provider?: 'serpapi' | 'curated' | 'curated_fallback' | 'none';
  evidence_results?: EvidenceResult[];
}

export interface EvidenceResult {
  title: string;
  url: string;
  snippet: string;
}

export interface CategoryScore extends ScoreResult {
  category: Category;
}

export interface SystemMeta {
  id: string;
  name: string;
  categories: Category[];
  hazards: Hazard[];
  measure: string;
  change: string;
  escalate: string;
  source: string;
}

const SOURCE = 'Experimental self-report indicator; see Sources and safety';

export const SYSTEM_META: SystemMeta[] = [
  {
    id: 'brain', name: 'Brain', categories: ['sleep_hours', 'mood'],
    hazards: ['isolation', 'distance', 'radiation'],
    measure: 'Sleep hours and a daily mood rating, each morning.',
    change: 'Isolation, delay from Earth and circadian disruption affect mood and focus.',
    escalate: 'Persistent low mood, severe sleep loss, or missed check-ins.',
    source: SOURCE,
  },
  {
    id: 'eyes', name: 'Eyes', categories: ['vision_symptoms'],
    hazards: ['gravity', 'environment'],
    measure: 'Daily self-report of visual symptoms such as blur, spots, or field changes. This is an experimental indicator, not an eye examination.',
    change: 'Spaceflight-associated fluid shifts can affect ocular structures and vision; this tracker does not assess the cause.',
    escalate: 'New or worsening visual symptoms should be reviewed under the mission medical protocol.',
    source: SOURCE,
  },
  {
    id: 'heart', name: 'Heart', categories: ['heart_rate', 'hrv'],
    hazards: ['radiation', 'gravity', 'isolation'],
    measure: 'Resting HR and HRV from a wearable or pulse sensor, each morning.',
    change: 'Microgravity and stress shift resting HR and HRV; radiation adds long-term risk.',
    escalate: 'Sustained resting HR above personal baseline for 3+ days, or chest symptoms.',
    source: SOURCE,
  },
  {
    id: 'immune', name: 'Immune', categories: ['temperature'],
    hazards: ['radiation', 'isolation', 'environment'],
    measure: 'Body temperature and a daily symptom check-in.',
    change: 'Stress, radiation and a closed environment can alter immune function and raise temperature.',
    escalate: 'Fever, persistent infection signs, or a rash.',
    source: SOURCE,
  },
  {
    id: 'bones', name: 'Bones', categories: [],
    hazards: ['gravity'],
    measure: 'Exercise load logs now; bone scans are periodic.',
    change: 'Reduced loading in microgravity lowers bone density over months.',
    escalate: 'Missed resistive exercise for several days, or new bone pain.',
    source: SOURCE,
  },
  {
    id: 'muscle', name: 'Muscle', categories: [],
    hazards: ['gravity'],
    measure: 'Strength sessions logged; grip or leg-press checks.',
    change: 'Unloaded muscles atrophy unless countered by exercise.',
    escalate: 'Sharp strength drop or pain during exercise.',
    source: SOURCE,
  },
];

export interface Sys extends SystemMeta {
  status: Status;
  trend: 'up' | 'flat' | 'down';
  z: number;
}

export interface State {
  day: number;
  systems: Sys[];
  results: Partial<Record<Category, CategoryScore>>;
  overall: ScoreResult;
  alert: { title?: string; text: string; cites: { title: string; url: string }[]; explanation_source?: 'openrouter' | 'fallback'; explanation_model?: string; evidence_summary?: string; evidence_provider?: ScoreResult['evidence_provider']; evidence_results?: EvidenceResult[] };
  demo?: boolean;
}

export interface Session {
  userid: string;
  phone: string;
  demo?: boolean;
}

export const MISSION_DAY = 80;

export const ALERT_CITES = [
  { title: 'NASA · Cardiovascular monitoring in microgravity', url: 'https://www.nasa.gov/wp-content/uploads/2022/03/iss_technical_publication_030116.pdf' },
  { title: 'UCI · WESAD wearable-signal dataset', url: 'https://archive.ics.uci.edu/dataset/465/wesad' },
];
