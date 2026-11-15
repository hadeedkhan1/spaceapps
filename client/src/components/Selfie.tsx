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
const TIP = 'Neutral face, even light';

// Only numbers leave this component; the image is never stored or sent.
export default function Selfie({ onMetric }: { onMetric: (pct: number) => void }) {
  const v = useRef<HTMLVideoElement>(null);
  const base = useRef<number | null>(null);
  const [on, setOn] = useState(false);
  const [err, setErr] = useState(false);
  const [msg, setMsg] = useState(TIP);

  async function start() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      v.current!.srcObject = s; await v.current!.play(); setOn(true); setErr(false); setMsg(TIP);
    } catch { setErr(true); }
  }
  async function capture() {
    setMsg('Measuring…');
    const el = v.current!, l = await load(), p = l.detect(el).faceLandmarks[0];
    if (!p) return setMsg('No face found. Move closer or add light.');
    const w = el.videoWidth, h = el.videoHeight;
    const ratio = dist(p[234], p[454], w, h) / dist(p[10], p[152], w, h);
    if (base.current == null) base.current = ratio;
    const pct = +((ratio / base.current - 1) * 100).toFixed(1);
    setMsg(`Change vs day one: ${pct}%`); onMetric(pct);
  }
  return (
    <>
      <div className={`view ${on ? 'live' : ''}`}>
        <span className="camera-label">CAMERA PREVIEW</span>
        <video ref={v} playsInline muted />
        {err ? <div className="err"><b>⚠ Camera unavailable</b><span>Check camera access, then try again.</span></div>
          : <><i className="oval" /><p className="tip">{msg}</p></>}
      </div>
      <div className="shwrap">
        {err ? <button className="btn" onClick={start}>Try again</button>
          : <button className="shutter" aria-label={on ? 'Capture photo' : 'Start camera'} onClick={on ? capture : start} />}
      </div>
    </>
  );
}
