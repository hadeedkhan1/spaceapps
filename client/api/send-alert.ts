// Vercel serverless function. Keys stay server-side.
// Loop Message endpoint/headers below are from memory: VERIFY against their docs before relying on them.
export default async function handler(req: any, res: any) {
  const text = (req.body && req.body.text) || '';
  const { LOOP_API_KEY: key, LOOP_SECRET: secret, LOOP_TO: to, LOOP_SENDER: sender } = process.env;
  if (!key || !secret || !to) return res.status(200).json({ mock: true, text });
  try {
    const r = await fetch('https://server.loopmessage.com/api/v1/message/send/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: key, 'Loop-Secret-Key': secret },
      body: JSON.stringify({ contact: to, text, sender_name: sender }) });
    if (!r.ok) throw new Error(String(r.status));
    return res.status(200).json({ mock: false });
  } catch (e) {
    return res.status(200).json({ mock: true, text, error: 'send failed, fell back to mock' });
  }
}
