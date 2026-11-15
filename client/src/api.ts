import { ALERT_CITES, CATEGORY_IDS, CATEGORY_META, SYSTEM_META } from './contract';
import type {
  Category,
  CategoryScore,
  Reading,
  ScoreResult,
  Session,
  State,
  Sys,
  SystemMeta,
} from './contract';

const BASE = (import.meta.env?.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
const SESSION_KEY = 'orbital-twin-session';

async function request<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail ?? `Request failed (${res.status})`);
  return data as T;
}

export type SolarEvent = { eventTime: string; link?: string | null; instruments?: { displayName?: string }[] };
export type SolarFeed = { events: SolarEvent[]; fetchedAt: string; source: string };

export function getSolarFeed() {
  return request<SolarFeed>('/space-weather');
}

export function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session | null) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
}

export function createAccount(phone: string, password: string) {
  return request<{ userid: string }>('/signup', { phone, password });
}

export function logIn(phone: string, password: string) {
  return request<{ userid: string }>('/login', { phone, password });
}

export function startDemo() {
  return request<{ userid: string; phone: string; demo: boolean }>('/demo', {});
}

export function addReading(reading: Reading) {
  return request<{ ok: boolean }>('/readings', reading);
}

export function getStatus(userid: string, category: Category | 'overall') {
  return request<ScoreResult>(
    `/status?userid=${encodeURIComponent(userid)}&category=${encodeURIComponent(category)}`,
  );
}

export async function loadState(userid: string, demo = false): Promise<State> {
  const [overall, categoryScores] = await Promise.all([
    getStatus(userid, 'overall'),
    Promise.all(CATEGORY_IDS.map(category => getStatus(userid, category))),
  ]);
  const results = Object.fromEntries(
    CATEGORY_IDS.map((category, index) => [category, categoryScores[index] as CategoryScore]),
  ) as Record<Category, CategoryScore>;

  return {
    systems: SYSTEM_META.map(meta => buildSystem(meta, meta.categories.map(category => results[category]))),
    results,
    overall,
    alert: buildAlert(overall),
    demo,
  };
}

function buildSystem(meta: SystemMeta, scores: CategoryScore[]): Sys {
  const scored = scores.filter(r => r.status === 'scored' && r.score != null);
  if (!scored.length) return { ...meta, status: 'grey', trend: 'flat', z: 0 };

  const worst = scored.reduce((a, b) => ((b.score ?? 0) < (a.score ?? 0) ? b : a));
  const z = scored.reduce((sum, r) => sum + (r.z ?? 0), 0) / scored.length;
  return {
    ...meta,
    status: worst.color,
    trend: z > 0.5 ? 'up' : z < -0.5 ? 'down' : 'flat',
    z,
  };
}

function buildAlert(overall: ScoreResult): State['alert'] {
  const cites = overall.evidence_results?.length
    ? overall.evidence_results.map(({ title, url }) => ({ title, url }))
    : ALERT_CITES;
  const worst = overall.worst?.[0];
  if (overall.status !== 'scored' || !worst) {
    return {
      title: 'Learning your baseline',
      text: overall.explanation
        || 'Log one baseline reading, then a reading after the change, to unlock your first score.',
      cites,
      explanation_source: overall.explanation_source,
      explanation_model: overall.explanation_model,
      evidence_summary: overall.evidence_summary,
      evidence_provider: overall.evidence_provider,
      evidence_results: overall.evidence_results,
    };
  }
  const label = CATEGORY_META[worst.category].label;
  return {
    title: `${label} ${worst.color === 'red' ? 'needs attention' : 'on watch'}`,
    text: `${overall.explanation ?? ''} Overall ${overall.score}/10.`,
    cites,
    explanation_source: overall.explanation_source,
    explanation_model: overall.explanation_model,
    evidence_summary: overall.evidence_summary,
    evidence_provider: overall.evidence_provider,
    evidence_results: overall.evidence_results,
  };
}

export interface AlertDelivery {
  sent: boolean;
  mock: boolean;
  text: string;
  contact?: string | null;
  message_id?: string;
}

export function sendAlert(userid: string, delaySec: number) {
  return request<AlertDelivery>('/alert', { userid, delay_sec: delaySec });
}

export function actionFor(delaySec: number) {
  if (delaySec < 10) return 'Contact the flight surgeon now.';
  if (delaySec < 120) return 'Send the report and follow the checklist while waiting for a reply.';
  return 'Repeat at rest. Follow the onboard protocol; don’t wait for Earth.';
}
