import { MOCK, State } from './contract';
const API = (import.meta as any).env?.VITE_API_URL as string | undefined;

export async function getState(): Promise<State> {
  if (!API) return MOCK;
  try { const r = await fetch(`${API}/state`); if (!r.ok) throw 0; return await r.json(); } catch { return MOCK; }
}
export async function sendAlert(text: string) {
  try {
    const r = await fetch('/api/send-alert', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
    return await r.json();
  } catch { return { mock: true, text }; }
}
// Placeholder rules: Person A's delay-aware logic replaces this.
export function actionFor(delaySec: number) {
  if (delaySec < 10) return 'Contact the flight surgeon now.';
  if (delaySec < 120) return 'Send the report and follow the checklist while waiting for a reply.';
  return 'Repeat at rest. Follow the onboard protocol; don’t wait for Earth.';
}
