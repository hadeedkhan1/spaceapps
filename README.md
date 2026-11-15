# Orbital Twin

A self-assessment tool that helps astronauts understand their own health on long missions. It learns each person's own baseline, turns daily measurements into a color-coded body map and trend charts, explains what a change means and what to do about it, and sends a report to Earth that adapts to the communication delay.

Built for the NASA Space Apps Challenge on astronaut health self-assessment.

## The problem

On a Mars mission a crew member may wait 20 minutes for every reply from flight surgeons. NASA's Human Research Program groups the dangers of spaceflight into five hazards: space radiation, isolation and confinement, distance from Earth, gravity fields, and hostile closed environments. Each one shifts the body in ways that are easy to miss day to day, so astronauts need to be able to assess themselves and act early.

## What it does

| Challenge requirement | How Orbital Twin meets it |
|---|---|
| Visual tool for self-assessment | Clickable body map with seven systems (brain, eyes, heart, immune, metabolism, bones, muscle), colored green, yellow or red |
| Health indicators | Nine indicators: sleep, mood, resting heart rate, HRV, systolic blood pressure, body temperature, blood glucose, exercise minutes, vision symptoms |
| Data from any input | Typed readings, plus an on-device camera check that measures a face-width ratio with MediaPipe and keeps only the number |
| Guidance on treatments and improvements | Each indicator lists what you can do, when to contact the flight surgeon, and an AI-written plan, plus research excerpts retrieved from NASA and NIH sources |
| Explain measurements and risks | Step-by-step "how to measure" for every indicator, why it matters in space, and how each hazard affects it |
| Five hazards | Hazard filter on the body map highlights the systems each hazard affects |
| Different environments | Space station, lunar base, Mars transit and Mars surface presets set the communication delay and the hazards to watch |
| Prompts to take measurements | "Today's check-in" lists indicators not yet logged and opens the logger with one tap |
| Gamification | Day streak, points, levels and badges reward consistent measuring |
| Dynamic charts | Trend chart per indicator with your personal normal range, baseline and after-change readings |
| Color coding | Green, yellow, red and grey, always paired with a text label so color is never the only signal |
| Contact with Earth | One-tap health report by text message through LoopMessage, a simulated acknowledgment timeline and a recommended action that changes with the delay |
| Space weather | Live solar energetic particle reports from NASA DONKI |

## How the scoring works

1. The first readings become your personal baseline: the median of your own values, with a spread based on how much they vary day to day.
2. Recent readings are compared with that baseline. For example, a high resting heart rate is bad, a low sleep duration is bad, and blood pressure and temperature are bad in either direction.
3. A score from 0 to 10 is derived from the distance from baseline. A cumulative-sum drift check caps the score when a shift is sustained, so slow trends are caught that a single reading would not show.
4. The overall score is the average, capped at yellow if any system is red.

The scores describe change relative to you, not clinical thresholds. Real medical limits and treatment decisions belong to the flight surgeon.

## Architecture

```
React + Vite + TypeScript  ->  FastAPI  ->  Supabase (Postgres)
   body map, charts,             scoring        users, readings
   check-in, Earth tab           explanations
                                 evidence search (SerpApi)
                                 LoopMessage (text to Earth)
                                 NASA DONKI (space weather)
```

- `backend/scoring.py` baseline, score and drift detection
- `backend/explain.py` plain-language explanation, with a deterministic fallback when no model key is set
- `backend/evidence.py` cited NASA and NIH sources for flagged systems, with curated fallbacks
- `backend/alert.py` health report text and delay-aware recommendation
- `backend/main.py` API routes
- `client/src` interface, including `components/BodyMap.tsx`, `TrendChart.tsx` and `Mission.tsx`

## Run it

Requirements: Python 3.11 or newer, [Bun](https://bun.sh), and a free [Supabase](https://supabase.com) project.

1. In the Supabase SQL editor, run `backend/schema.sql`.
2. Copy `.env.example` to `.env` and fill it in. Only the Supabase values are required.
3. Install and start both servers:

```
bun install
cd client && bun install && cd ..
pip install -r backend/requirements.txt
bun run dev
```

App: http://localhost:5173 · API: http://127.0.0.1:8000

Tap **Open demo account** on the sign-in screen for a ready-made crew member with nine indicators of simulated data.

### Environment variables

| Variable | Needed for | Without it |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_KEY` | Accounts and readings | The app cannot store data |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | AI-written explanations and plans | A deterministic summary is shown |
| `SERPAPI_API_KEY` | Live NASA and NIH citations on alerts | Curated NASA references are shown |
| `LOOP_API_KEY`, `LOOP_TO`, `LOOP_SENDER_ID` | Real text messages to Earth | Mock mode: the report is built but not sent |

Never commit `.env`. It is listed in `.gitignore`.

### Tests

```
python -m unittest backend.test_scoring -v
```

## A 3-minute walkthrough

1. Sign in with the demo account. The body map shows which systems are drifting from baseline and the overall score.
2. Tap the heart. See the trend chart with your normal range, why the change matters in space, what to do and how to measure again.
3. Turn on the **Radiation** hazard filter to see which systems it affects.
4. Open **Check-in** from the "Today's check-in" panel, log a reading and watch the streak and points update.
5. Open **Earth**, choose **Mars surface**, and send the report. The recommended action changes with the delay, and the acknowledgment timeline escalates to onboard protocol if nobody replies.

## Data sources

- NASA DONKI solar energetic particle catalog: live, shown on the Earth tab.
- NASA Human Research Program: the five-hazard framework and the explanations of each body system.
- NASA and NIH research found through SerpApi: cited beside alerts.
- NASA ISS technical publication and the NASA Twins Study: curated fallback references.

The demo account uses simulated readings. Real astronaut data is not public.

## Limits and safety

- This is a prototype for self-assessment. It is not a diagnosis and not a medical device.
- Scores compare you with your own baseline. They do not establish that a value is safe or unsafe.
- AI explanations are instructed to restate only the supplied numbers and retrieved sources and never to recommend medication. A deterministic summary is used if the model is unavailable.
- Camera images are processed in the browser. Only a single ratio is kept.
- The selfie metric is a rough indicator of facial fluid shift, not a measurement of any condition.

## Roadmap

- Live wearable and pulse-sensor input
- Measured delay replay and reply tracking from Earth
- Benchmarking the baseline detector against fixed thresholds on public physiology datasets
- Crew-level view for behavioral health
