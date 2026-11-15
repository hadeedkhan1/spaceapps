# Full game plan: Orbital Twin

**Pitch:** A health monitor that learns each astronaut's own normal, tracks radiation as a health indicator, explains every alert with cited evidence, and messages Earth automatically, adapting its advice to how long the reply will take.

I can't promise a win. As planned I'd rate it about 7/10, and execution decides most of that.

## 1. What you're building

```
INPUTS                              BRAIN                          OUTPUTS
Wearable export (real baseline) ─┐
Daily selfie → face metrics ─────┤  Personal baseline          ─► Body map (traffic lights, hazard overlay)
Dose Ledger (NOAA storm + rate) ─┼─ + ML deviation detector   ─► "Why" panel with cited NASA evidence
Check-in replies (text) ─────────┤  + delay-aware rules        ─► Auto message to Earth (Loop Message)
Optional: ESP32 pulse ───────────┘
```

## 2. Modules by tier

**Tier 1: must work flawlessly**
1. **Body map (SVG):** clickable systems, traffic-light status with trend arrows, hazard overlay (five NASA hazards), "why is this measured?" panels.
2. **ML baseline detector:** trained on real public physiology (WESAD, PhysioNet) and your teammate's own wearable export, with spaceflight-style drifts injected from NASA-sourced numbers. Benchmark vs fixed thresholds: days-to-alert and false alarms per 100 crew-days, on held-out people. This is your headline number.
3. **Dose Ledger:** background rate (MSL RAD) plus storm rate from a real NOAA proton-flux replay, times a shielding multiplier, running against the career limit. Projection line and a sheltered-vs-ignored comparison. No prediction claims, and labeled illustrative.
4. **Daily selfie (lean version):** one metric, face puffiness change vs day one, on the body map's head region and fused with the detector. Process on-device with MediaPipe and store only numbers.
5. **Delay-aware autonomy dial:** the same flag yields different actions by simulated delay ("contact surgeon" at 2 seconds, "act on this plan and report back" at 20 minutes).
6. **Auto messaging (Loop Message):** triggers only on sustained flags or dose alerts, one packet per event, acknowledgment tracking, escalation if nobody replies. Mock channel as fallback.
7. **Evidence engine (SerpApi):** on a flag, search NASA and research sources, summarize only what was retrieved, and show citations in the alert and the message packet. Cache the demo scenario.
8. **Data sources panel:** every NASA and partner dataset, what it feeds, and its citation.

**Tier 2: only if Tier 1 is solid by hour 16**
- ESP32 + MAX30102 live pulse with a physical shelter-alert beacon (USB/WebSerial or BLE, replay mode as backup)
- Blink-rate fatigue cue from the selfie flow

**Tier 3: roadmap slide only**
Next-best-measurement triage, schedule replanner, environment modes, crew behavioral health, federated learning.

## 3. Stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite + TypeScript, installable PWA, SVG body map, Recharts |
| Selfies | `getUserMedia` front camera (fallback `<input capture="user">`), MediaPipe Face Mesh in the browser |
| Backend | FastAPI (Python): detector, dose ledger, SerpApi, Loop Message |
| ML | scikit-learn or PyTorch |
| Hosting | Vercel/Netlify (frontend), Render/Railway (backend), HTTPS required for camera |

Flutter and Tauri are not needed, since a deployed link is the easiest thing for judges to open. Use whichever stack you're fastest in if it differs.

## 4. Data and NASA trail

| Piece | Source |
|---|---|
| Storm replay | NOAA SWPC/GOES proton flux, labeled with NASA DONKI (confirm the storm is covered by both) |
| Background dose, limit, thresholds | NASA MSL RAD, NASA-STD-3001 (verify numbers) |
| "Why measured" content | NASA Human Research Program |
| Injected drift parameters | NASA HRP and ISS/Twins Study literature, one citation per parameter |
| Possible calibration | NASA OSDR and the challenge Resources tab (spend 30 minutes checking) |
| Baselines | WESAD, PhysioNet, plus your own consented wearable export |

Garmin's developer API likely needs approval you won't get in time, so plan on a Garmin Connect export (FIT/CSV) and confirm today. State on a slide that real astronaut garment data isn't public.

## 5. Roles

- **Person A:** data, ML detector, benchmark, dose and storm data, evidence engine, backend API
- **Person B:** frontend, body map, selfie capture, Loop Message flow, deployment, demo flow, optional hardware

Hour 1: agree on the JSON contract (indicators, status, dose, alerts, message packet, citations, face metrics).

## 6. Timeline (kickoff Saturday 11 AM to Sunday 1 PM)

| Hours | A | B |
|---|---|---|
| 0-1 | Create repo together, write the API contract and the one demo scenario | |
| 1-3 | Confirm storm data, load datasets | Scaffold app, body map with mock data, start Loop Message setup |
| 3-8 | Detector v1, fixed-threshold comparison, drift injection | Hazard overlay, panels, baseline-band charts |
| 8-12 | Dose ledger API and storm replay. **Know your benchmark result by hour 12 and adjust the story if it's weak** | Dose UI, selfie capture, first working text send |
| **12-16** | **Integration checkpoint: full loop works end to end.** Evidence engine | Acknowledgment and escalation, face-metric chart |
| 16-18 | Benchmark slide, decide on Tier 2 | Deploy a live link |
| 18-21 | Autonomy dial, source labels, caching | Polish, color-blind-safe palette, PWA install |
| **21** | **Feature freeze** | |
| 21-25 | Rehearse the demo at least three times, record a backup video, finish the Space Apps project page | |
| 25-26 | Final push to GitHub, submit before Sunday 1 PM | |

Sleep in shifts. A tired team at hour 24 breaks working code.

## 7. The 3-minute demo

1. **Problem (20s):** a Mars crew can't wait 20 minutes for every answer.
2. **Baseline (40s):** feed in a day's data, including a selfie, and the detector flags a drift days before fixed thresholds, with the benchmark on screen.
3. **Evidence (30s):** the alert explains itself with cited NASA sources.
4. **Dose Ledger (40s):** replay the real storm, trigger the shelter alert, and watch the dose line bend depending on whether the person acknowledges.
5. **Loop Message (30s):** a real phone buzzes, someone replies, and the app updates after the simulated delay.
6. **Impact (20s):** Antarctic stations, rural clinics, and polar flights use the same loop.

Optional crowd moment: a QR code so a judge opens the live link and takes a selfie on their own phone.

## 8. Honesty rules

- Dose values and shielding are illustrative, with no solar-event prediction claims.
- Simulated drifts and staged selfie series are labeled simulated.
- Face cues are fluid-shift and fatigue signals, not mood.
- "Not a diagnosis" on all guidance.
- Only your own or consented data goes over messaging.

## 9. Pre-event checklist (no code in the repo yet)

- Confirm the storm archive, format, and DONKI coverage
- Confirm Loop Message account, number, and delivery to your phones
- Claim SerpApi's free searches and check available engines
- Export wearable data and check the format
- Download WESAD and PhysioNet and check licenses
- Record NASA-STD-3001 and MSL RAD figures with sources
- Search OSDR and the Resources tab for usable data
- Form your team page on spaceappschallenge.org
- Test the selfie flow on iPhone and Android browsers
- If doing hardware, buy parts with spares and test the sensor

Fair play: research, accounts, and data checks are fine now. The repo and all project code start at kickoff, since commit history is the check.

## 10. Cut order if you fall behind

1. Blink-rate and hardware (Tier 2)
2. Dose projection scenarios
3. Face metrics
4. Evidence engine (keep a cached version)

**Never cut:** the detector with its benchmark, the dose ledger, the messaging loop, and a working live link. Spend your last hours polishing and rehearsing, not adding features.

## 11. What decides the outcome

1. A clear benchmark win, or an honest explanation if it's modest.
2. A demo that runs without a hitch, with a backup video.
3. A visible NASA data trail.
4. A sharp story: the autonomy problem is real, on Mars and on Earth.

I can put this into a document you can share with your teammate, or write the JSON API contract and message packet format next so you can paste them in at hour 1.