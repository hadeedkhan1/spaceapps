import { useRef, useState } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

let lm: FaceLandmarker | null = null;
async function load() {
  if (lm) return lm;
  const f = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
  lm = await FaceLandmarker.createFromOptions(f, {
    baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task' },
    runningMode: 'IMAGE', numFaces: 1 });
  return lm;
}
const dist = (a: any, b: any, w: number, h: number) => Math.hypot((a.x - b.x) * w, (a.y - b.y) * h);

// Only numbers leave this component; the image is never stored or sent.
export default function Selfie({ onMetric }: { onMetric: (pct: number) => void }) {
  const v = useRef<HTMLVideoElement>(null);
  const base = useRef<number | null>(null);
  const [on, setOn] = useState(false);
  const [msg, setMsg] = useState('Camera off.');

  async function start() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      v.current!.srcObject = s; await v.current!.play(); setOn(true);
      setMsg('Face the camera, neutral expression, even light. The first capture sets your baseline.');
    } catch { setMsg('Camera blocked. Use the simulate button for the demo.'); }
  }
  async function capture() {
    setMsg('Measuring\u2026');
    const el = v.current!, l = await load(), p = l.detect(el).faceLandmarks[0];
    if (!p) return setMsg('No face found. Move closer or add light.');
    const w = el.videoWidth, h = el.videoHeight;
    const ratio = dist(p[234], p[454], w, h) / dist(p[10], p[152], w, h); // face width / height
    if (base.current == null) base.current = ratio;
    const pct = +((ratio / base.current - 1) * 100).toFixed(1);
    setMsg(`Face width-to-height change vs day one: ${pct}%`); onMetric(pct);
  }
  return (
    <div>
      <video ref={v} playsInline muted className={on ? 'cam' : 'cam off'} />
      <div className="row">
        {!on ? <button onClick={start}>Start camera</button> : <button onClick={capture}>Capture today\u2019s photo</button>}
        <button className="ghost" onClick={() => { setMsg('Simulated day-90 photo added.'); onMetric(6.4); }}>Simulate later photo</button>
      </div>
      <p className="note">{msg}</p>
    </div>
  );
}
