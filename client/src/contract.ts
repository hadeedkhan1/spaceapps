export type Status = 'green' | 'yellow' | 'red' | 'grey';
export type Hazard = 'radiation' | 'isolation' | 'distance' | 'gravity' | 'environment';
export const HAZARDS: Hazard[] = ['radiation', 'isolation', 'distance', 'gravity', 'environment'];

export type Category = 'sleep_hours' | 'mood' | 'hrv' | 'heart_rate' | 'blood_pressure' | 'temperature' | 'glucose' | 'exercise_minutes' | 'vision_symptoms';
export type ReadingPhase = 'before' | 'after';

export interface CategoryMeta {
  label: string;
  unit: string;
  step: number;
  sample: number;
  why: string;
  howto: string[];
  actions: string[];
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  sleep_hours: {
    label: 'Sleep', unit: 'hours', step: 0.1, sample: 7.5,
    why: 'Sleep shifts with 16 sunrises a day, noise, light and workload, and short sleep erodes judgment, mood and immunity.',
    howto: [
      'Note when you fell asleep and when you woke up.',
      'Subtract time spent awake in the night.',
      'Enter total hours slept, ideally within an hour of waking.',
    ],
    actions: [
      'Keep a fixed sleep window and dim cabin lights and screens an hour before it.',
      'Use the crew sleep station and earplugs or an eye mask to cut noise and light.',
      'Avoid caffeine in the last six hours before sleep, and report several short nights in a row.',
    ],
  },
  mood: {
    label: 'Mood', unit: '0–10', step: 0.5, sample: 7,
    why: 'Isolation, confinement and distance from Earth are linked to low mood, irritability and withdrawal. Tracking it early lets you act before it affects the crew.',
    howto: [
      'Pause for a moment and ask how you feel right now.',
      'Rate it from 0 (very low) to 10 (very good).',
      'Rate the same way each morning so the trend is comparable.',
    ],
    actions: [
      'Schedule private downtime and a call or message to family or friends.',
      'Share a meal and a conversation with the crew and keep a regular routine.',
      'Talk to the flight surgeon or a behavioral health contact if low mood lasts more than a few days.',
    ],
  },
  hrv: {
    label: 'HRV', unit: 'ms', step: 1, sample: 45,
    why: 'Heart rate variability reflects how well your nervous system recovers from stress. A sustained fall often shows up before you feel strain.',
    howto: [
      'Measure at rest, seated or lying, soon after waking.',
      'Wear the wearable or chest strap snug against the skin.',
      'Record the RMSSD value in milliseconds that the device reports.',
    ],
    actions: [
      'Protect sleep and add recovery time between demanding tasks.',
      'Try slow breathing, about six breaths a minute, for five minutes.',
      'Keep exercise consistent, and check sensor fit before trusting a low reading.',
    ],
  },
  heart_rate: {
    label: 'Resting HR', unit: 'bpm', step: 1, sample: 62,
    why: 'Fluid shifts, stress, deconditioning and illness all move resting heart rate, and radiation exposure adds long-term cardiovascular risk.',
    howto: [
      'Sit quietly for five minutes, not right after exercise or caffeine.',
      'Place two fingertips on the inside of your wrist, or use your wearable.',
      'Count beats for 30 seconds and double it, or read the device value.',
    ],
    actions: [
      'Repeat the reading at rest at the same time of day before acting on it.',
      'Hydrate, keep up cardio exercise and review sleep and stress.',
      'Report a resting rate that stays above your baseline for several days, or any chest symptoms, to the flight surgeon.',
    ],
  },
  blood_pressure: {
    label: 'Blood pressure', unit: 'mmHg systolic', step: 1, sample: 118,
    why: 'Microgravity shifts fluid toward the head and changes how blood pressure is regulated. Standing up again after a long flight can cause dizziness.',
    howto: [
      'Rest seated for five minutes with your arm at heart level.',
      'Wrap the cuff on a bare upper arm and stay still while it inflates.',
      'Record the top number, the systolic value, in mmHg.',
    ],
    actions: [
      'Repeat after five minutes of rest to rule out a one-off reading.',
      'Keep up fluids and exercise countermeasures, and limit salty foods.',
      'Contact the flight surgeon for a persistently changed reading, dizziness or fainting.',
    ],
  },
  temperature: {
    label: 'Temperature', unit: '°C', step: 0.1, sample: 36.8,
    why: 'Stress, radiation and a closed environment can change immune function, and a closed cabin spreads infections quickly.',
    howto: [
      'Use the same thermometer at the same time each day, away from exercise.',
      'Wait 15 minutes after eating, drinking or exercise.',
      'Record the reading in degrees Celsius.',
    ],
    actions: [
      'Repeat after rest and check for cough, sore throat or rash.',
      'Wash or sanitize hands, wipe shared surfaces and keep fluids up.',
      'Report a fever or infection signs to the flight surgeon and consider limiting close contact.',
    ],
  },
  glucose: {
    label: 'Glucose', unit: 'mg/dL', step: 1, sample: 92,
    why: 'Stress, a changed diet and reduced activity can change how the body handles sugar, and good nutrition is a core spaceflight risk.',
    howto: [
      'Measure in the morning before eating, after at least eight hours without food.',
      'Wash hands, prick the side of a fingertip and touch the strip to the drop.',
      'Record the mg/dL value shown on the meter.',
    ],
    actions: [
      'Keep meals regular and balanced and follow the crew nutrition plan.',
      'Stay active and avoid long gaps between meals.',
      'Report repeated high or low readings, or symptoms such as shakiness or thirst, to the flight surgeon.',
    ],
  },
  exercise_minutes: {
    label: 'Exercise', unit: 'minutes', step: 5, sample: 120,
    why: 'Without gravity, bones and muscles lose strength within weeks. Daily resistive and aerobic exercise is the main countermeasure.',
    howto: [
      'Add up resistive and aerobic exercise from the day.',
      'Count only time spent actively exercising, not rest between sets.',
      'Enter the total in minutes.',
    ],
    actions: [
      'Schedule exercise as a fixed block and protect it from other tasks.',
      'Mix resistive training, such as the resistive exercise device, with aerobic work.',
      'Report new bone, joint or muscle pain, or a sharp drop in strength.',
    ],
  },
  vision_symptoms: {
    label: 'Vision symptoms', unit: '0–10', step: 1, sample: 0,
    why: 'Fluid shifts can change the shape of the eye and optic nerve. Many long-duration astronauts report blurred near vision.',
    howto: [
      'Read a line of small text at your normal reading distance.',
      'Rate blur, floaters or other field changes from 0 (none) to 10 (severe).',
      'Rate it the same way each day and compare with how it was last week.',
    ],
    actions: [
      'Repeat the reading in good light and check that your eyes are rested.',
      'Follow the crew vision-check routine and note any change in near or far vision.',
      'Report new or worsening symptoms to the flight surgeon promptly.',
    ],
  },
};
export const CATEGORY_IDS = Object.keys(CATEGORY_META) as Category[];

export interface Reading {
  userid: string;
  category: Category;
  value: number;
  time: ReadingPhase;
  recorded_at?: string;
}

export interface SeriesPoint {
  date: string;
  value: number;
  phase: ReadingPhase;
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
  before_readings?: number;
  after_readings?: number;
  baseline?: number;
  spread?: number;
  series?: SeriesPoint[];
  last_recorded?: string | null;
  after_avg?: number;
  recent?: number;
  change?: number;
  change_pct?: number | null;
  z?: number;
  drift_detected?: boolean;
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

const SOURCE = 'NASA Human Research Program hazard framework; experimental personal-baseline indicator, see Sources and safety';

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
    id: 'heart', name: 'Heart', categories: ['heart_rate', 'hrv', 'blood_pressure'],
    hazards: ['radiation', 'gravity', 'isolation'],
    measure: 'Resting heart rate, HRV and blood pressure from a wearable, pulse sensor or cuff, each morning.',
    change: 'Microgravity and stress shift resting HR and HRV; radiation adds long-term risk.',
    escalate: 'Sustained resting HR above personal baseline for 3+ days, or chest symptoms.',
    source: SOURCE,
  },
  {
    id: 'immune', name: 'Immune', categories: ['temperature'],
    hazards: ['radiation', 'isolation', 'environment'],
    measure: 'Body temperature each morning, plus a daily check for cough, sore throat or rash.',
    change: 'Stress, radiation and a closed environment can alter immune function and raise temperature.',
    escalate: 'Fever, persistent infection signs, or a rash.',
    source: SOURCE,
  },
  {
    id: 'metabolism', name: 'Metabolism', categories: ['glucose'],
    hazards: ['environment', 'isolation'],
    measure: 'Fasting blood glucose from a fingertip meter each morning.',
    change: 'Stress, a changed diet and less activity can alter how the body handles sugar.',
    escalate: 'Repeated high or low readings, extreme thirst, shakiness or confusion.',
    source: SOURCE,
  },
  {
    id: 'bones', name: 'Bones', categories: ['exercise_minutes'],
    hazards: ['gravity'],
    measure: 'Daily exercise minutes as the protective habit; bone density scans are periodic and done on the ground.',
    change: 'Reduced loading in microgravity lowers bone density over months.',
    escalate: 'Missed resistive exercise for several days, or new bone pain.',
    source: SOURCE,
  },
  {
    id: 'muscle', name: 'Muscle', categories: ['exercise_minutes'],
    hazards: ['gravity'],
    measure: 'Daily exercise minutes, with strength sessions and grip or leg-press checks.',
    change: 'Unloaded muscles atrophy unless countered by exercise.',
    escalate: 'Sharp strength drop or pain during exercise.',
    source: SOURCE,
  },
];

export interface Environment {
  id: string;
  name: string;
  delay: number;
  hazards: Hazard[];
  note: string;
}

export const ENVIRONMENTS: Environment[] = [
  {
    id: 'station', name: 'Space station', delay: 2, hazards: ['gravity', 'radiation', 'environment'],
    note: 'Low Earth orbit. Flight surgeons are a call away, so contact them early. Microgravity and a closed cabin dominate the risk.',
  },
  {
    id: 'moon', name: 'Lunar base', delay: 2, hazards: ['radiation', 'gravity', 'isolation'],
    note: 'Seconds of delay. Radiation from solar particle events is the main concern, along with dust and reduced gravity.',
  },
  {
    id: 'transit', name: 'Mars transit', delay: 600, hazards: ['radiation', 'isolation', 'distance'],
    note: 'Minutes of delay each way. Plan to act on onboard protocols first and report afterward.',
  },
  {
    id: 'mars', name: 'Mars surface', delay: 1200, hazards: ['distance', 'isolation', 'environment'],
    note: 'Up to about 20 minutes each way. You are the first responder, so routine checks and prevention matter most.',
  },
];

export interface Sys extends SystemMeta {
  status: Status;
  trend: 'up' | 'flat' | 'down';
  z: number;
}

export interface State {
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

export const ALERT_CITES = [
  { title: 'NASA · ISS technical publication', url: 'https://www.nasa.gov/wp-content/uploads/2022/03/iss_technical_publication_030116.pdf' },
  { title: 'NASA · Twins Study', url: 'https://www.nasa.gov/humans-in-space/twins-study/about/' },
];

export const DATA_SOURCES = [
  { name: 'NASA DONKI', feeds: 'Live solar energetic particle reports on the Earth tab.' },
  { name: 'NASA Human Research Program', feeds: 'The five-hazard framework, the hazard filter and the explanations of each body system.' },
  { name: 'NASA and NIH research via SerpApi', feeds: 'Cited research excerpts shown beside an alert when a system is flagged.' },
  { name: 'NASA ISS technical publication and Twins Study', feeds: 'Curated fallback references when live search is unavailable.' },
];

