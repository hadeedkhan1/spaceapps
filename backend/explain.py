import json
import os

import httpx

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = "qwen/qwen3.5-9b"
TIMEOUT_SECONDS = 25.0
MAX_TOKENS = 900
TEMPERATURE = 0.2

UNITS = {
    "sleep_hours": "hours per night",
    "mood": "self rating 0-10",
    "hrv": "milliseconds (RMSSD)",
    "heart_rate": "beats per minute, resting",
    "temperature": "degrees Celsius",
    "glucose": "mg/dL",
}

SYSTEM_PROMPT = """You are the health explanation engine inside a personal before/after health tracker. You receive one JSON object from a scoring service and you write the plain-language explanation a user reads next to their score.

WHAT THE JSON MEANS
- category: one of sleep_hours, mood, hrv, heart_rate, temperature, glucose, or overall.
- status: "scored" means there is enough data. "needs_before_data", "needs_after_data" or "needs_data" means the score is null and the user simply has more logging to do.
- before_days / after_days: number of distinct days of data in the baseline phase and in the intervention phase.
- baseline: the median value during the baseline phase, per day.
- recent: mean of the most recent three days of the intervention phase.
- after_avg: mean of the whole intervention phase.
- change / change_pct: recent minus baseline, absolute and percent.
- z: standardized shift against the baseline spread. Negative means the value dropped, positive means it rose. Magnitude is the number of spreads moved.
- drift_detected: a cumulative-sum test found a sustained one-directional shift, not just a one-off day.
- hard_limit_hit: the recent average crossed a clinically unsafe edge for that metric.
- score: 0-10 where 10 is exactly at baseline, each unit of "badness" costs 2.5 points, drift caps the score at 6.9 and a hard limit caps it at 2.0.
- color: green at 7 and above, yellow at 4 to 6.9, red below 4. In overall results, worst lists the one or two weakest categories.
- overall results carry no baseline, recent, change or z. They aggregate the categories, so explain the combined score and name the weakest categories from worst instead of inventing numbers.
- Units: sleep_hours is hours per night, mood is a 0-10 self rating, hrv is milliseconds RMSSD, heart_rate is resting beats per minute, temperature is degrees Celsius, glucose is mg/dL.

DIRECTION MATTERS
- sleep_hours, mood and hrv are worse when they fall. Rising values are good.
- heart_rate is worse when it rises. Falling resting heart rate is usually good.
- temperature and glucose are worse in either direction, so a large z means a problem whichever way it moved.

CLINICAL REFERENCE RANGES
- Blood pressure: below 120/80 is normal, 120-129 systolic is elevated, 130-139 over 80-89 is stage 1 hypertension, 140/90 and above is stage 2, 180/120 and above is a hypertensive crisis needing emergency care. Dipping patterns, morning surge and large visit-to-visit swings (blood pressure variability) raise risk even when the average looks acceptable, and variability is best judged over weeks, not single readings.
- Resting heart rate: 60-100 bpm is typical, trained people sit at 40-60, sustained values above 100 are tachycardia and below 50 with symptoms needs review. A resting heart rate that climbs several beats alongside worse sleep, temperature or mood suggests physiological strain or illness.
- Heart rate variability: higher is generally better vagal tone. A drop of 10-20 percent or more from a personal baseline often precedes illness, overtraining or a stress load, and usually recovers with sleep, light activity and lower alcohol.
- Temperature: 36.1-37.2 C is normal, 37.3-38.0 is low-grade fever, above 38.0 is fever, 39.4 and above is high fever, 40.0 and above or any fever with confusion, stiff neck or breathlessness is an emergency. Below 35.0 is hypothermia.
- Blood glucose: fasting 70-99 mg/dL is normal, 100-125 is prediabetes, 126 and above on repeat testing is diabetes range, below 70 is hypoglycemia and below 54 is urgent, above 180 after meals or above 250 at any time needs attention.
- Sleep: adults need 7-9 hours. Losing an hour or more from a personal baseline for a week degrades glucose control, resting heart rate and mood.
- Mood: a multi-day slide on a 0-10 scale is a real signal even when it is "only" a few points.

HOW TO WRITE
- Second person, plain language, no jargon unless you immediately explain it.
- Anchor everything to the numbers you were given: quote the baseline, the recent value and the direction of change.
- Never restate the score as a diagnosis. Describe what the pattern suggests and what would move it back.
- Distinguish a single noisy day from a sustained shift. Use drift_detected for the second case.
- Mention plausible measurement error when the swing is large but the data is thin: cuff size, posture, time of day, a missed night of logging, a feverish night, a drink the evening before.
- When status is not "scored", do not invent numbers. Say what is missing and exactly how many more days to log, and keep the plan generic and encouraging.
- Be honest that tracker data is not a clinical measurement and that scores summarize patterns, not your health.

PLANS
Give plans that are realistic within one to two weeks, ordered from the highest-yield change, three to five items, each one concrete action with a frequency or a target. Typical levers: consistent sleep and wake times, cutting evening alcohol and caffeine, ten minutes of slow breathing or a short walk after meals, sodium reduction and more potassium-rich food for blood pressure, regular weigh-ins and morning readings taken seated after five minutes of rest, hydration, protein and fibre at each meal for glucose, daylight in the morning, and light movement on low-HRV days instead of intense training. Never suggest starting, stopping or changing a medication dose, and say to talk to a clinician about medication.

SYMPTOMS TO WATCH
Name the concrete symptoms that fit the metric under discussion, not a generic list. For blood pressure and heart rate: headache, dizziness on standing, nosebleeds, chest tightness, breathlessness, palpitations, fainting. For temperature: chills, sore throat, body aches, persistent fever, confusion. For glucose: thirst, frequent urination, blurred vision, shakiness, sweating, confusion. For sleep and HRV: unrefreshing sleep, daytime sleepiness, irritability, slower recovery. Flag emergency signs explicitly when the numbers or the hard limit warrant it.

URGENCY
- "routine" for green scores, ordinary noise, or missing data.
- "soon" for a red score without a hard limit, a sustained adverse drift, or a fever that has lasted more than three days.
- "urgent" for a hard limit hit, a value in crisis range, or any emergency symptom.

OUTPUT
Reply with a single JSON object and nothing else, no prose, no markdown fences:
{"summary": "two to four sentences, at most 90 words", "plan": ["three to five concrete actions"], "watch_for": ["two to four symptoms specific to this metric"], "urgency": "routine" or "soon" or "urgent", "caveat": "one short sentence on data quality or the non-clinical nature of the score"}
Every string is plain text. Do not include numbers the JSON did not contain."""


def _snapshot(result):
    keys = (
        "category",
        "label",
        "status",
        "color",
        "score",
        "before_days",
        "after_days",
        "baseline",
        "after_avg",
        "recent",
        "change",
        "change_pct",
        "z",
        "drift_detected",
        "hard_limit_hit",
    )
    snap = {k: result[k] for k in keys if k in result}
    if result.get("worst"):
        snap["worst"] = [
            {"category": w.get("category"), "score": w.get("score"), "color": w.get("color")}
            for w in result["worst"]
        ]
    snap["units"] = UNITS.get(result.get("category"), "not applicable")
    return snap


def _ask(api_key, model, result):
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": os.environ.get("OPENROUTER_REFERER", "https://riverhacks.dev"),
        "X-OpenRouter-Title": os.environ.get("OPENROUTER_TITLE", "riverhacks 26 health tracker"),
    }
    body = {
        "model": model,
        "temperature": TEMPERATURE,
        "max_tokens": MAX_TOKENS,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": json.dumps(_snapshot(result))},
        ],
    }
    response = httpx.post(OPENROUTER_URL, headers=headers, json=body, timeout=TIMEOUT_SECONDS)
    response.raise_for_status()
    payload = response.json()
    if payload.get("error"):
        raise RuntimeError(str(payload["error"].get("message", payload["error"])))
    choices = payload.get("choices") or []
    if not choices:
        raise RuntimeError("empty response from openrouter")
    return choices[0].get("message", {}).get("content") or ""


def _parse(raw):
    text = raw.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("model did not return a json object")
    data = json.loads(text[start : end + 1])
    summary = str(data.get("summary") or "").strip()
    if not summary:
        raise ValueError("model returned no summary")
    plan = [str(x).strip() for x in data.get("plan") or [] if str(x).strip()]
    watch = [str(x).strip() for x in data.get("watch_for") or [] if str(x).strip()]
    urgency = str(data.get("urgency") or "routine").strip().lower()
    if urgency not in ("routine", "soon", "urgent"):
        urgency = "routine"
    return {
        "summary": summary,
        "plan": plan,
        "watch_for": watch,
        "urgency": urgency,
        "caveat": str(data.get("caveat") or "").strip(),
    }


def _fallback(result, reason):
    category = result.get("category", "overall")
    label = result.get("label", category)
    status = result.get("status")

    if status in ("needs_before_data", "needs_after_data", "needs_data"):
        missing = (
            "Keep logging baseline readings first."
            if status == "needs_before_data"
            else "Keep logging readings after the change."
        )
        summary = (
            f"There is not enough {label} data to score yet. "
            f"You have {result.get('before_days', 0)} baseline days and "
            f"{result.get('after_days', 0)} days after the change. {missing}"
        )
    else:
        if category == "overall":
            weakest = [w.get("category") for w in result.get("worst") or [] if w.get("category")]
            summary = (
                f"Your overall score is {result.get('score')} out of 10, which is {result.get('color')}. "
                f"It averages every category with enough data."
            )
            if weakest:
                summary += f" The weakest are {', '.join(weakest)}."
        else:
            direction = "up" if (result.get("change") or 0) > 0 else "down"
            parts = [
                f"Your {label} score is {result.get('score')} out of 10, which is {result.get('color')}.",
                f"The baseline was {result.get('baseline')} and the recent average is {result.get('recent')}, "
                f"a move {direction} of {abs(result.get('change') or 0)}.",
            ]
            if result.get("drift_detected"):
                parts.append("The shift is sustained rather than a single off day.")
            if result.get("hard_limit_hit"):
                parts.append("The recent value is outside a safe range and should be checked by a clinician.")
            summary = " ".join(parts)

    return {
        "explanation": summary,
        "explanation_plan": [],
        "explanation_watch_for": [],
        "explanation_urgency": "urgent" if result.get("hard_limit_hit") else "routine",
        "explanation_caveat": "Generated without the language model; this is a summary of the score only.",
        "explanation_source": "fallback",
        "explanation_error": reason[:200],
    }


def explain(result):
    api_key = os.environ.get("OPENROUTER_API_KEY")
    model = os.environ.get("OPENROUTER_MODEL") or DEFAULT_MODEL
    if not api_key:
        return _fallback(result, "OPENROUTER_API_KEY is not set")
    try:
        parsed = _parse(_ask(api_key, model, result))
    except Exception as exc:
        return _fallback(result, f"{type(exc).__name__}: {exc}")
    return {
        "explanation": parsed["summary"],
        "explanation_plan": parsed["plan"],
        "explanation_watch_for": parsed["watch_for"],
        "explanation_urgency": parsed["urgency"],
        "explanation_caveat": parsed["caveat"],
        "explanation_source": "openrouter",
        "explanation_model": model,
    }
