import os

import httpx

LOOP_SEND_URL = "https://a.loopmessage.com/api/v1/message/send/"
TIMEOUT_SECONDS = 10.0
MAX_SCORED_LINES = 4

UNITS = {
    "sleep_hours": "h",
    "mood": "",
    "hrv": "ms",
    "heart_rate": "bpm",
    "temperature": "°C",
    "glucose": "mg/dL",
    "blood_pressure": "mmHg",
    "exercise_minutes": "min",
    "vision_symptoms": "/10",
}

NAMES = {
    "sleep_hours": "Sleep",
    "mood": "Mood",
    "hrv": "HRV",
    "heart_rate": "Resting HR",
    "temperature": "Temperature",
    "glucose": "Glucose",
    "blood_pressure": "Systolic BP",
    "exercise_minutes": "Exercise",
    "vision_symptoms": "Vision symptoms",
}


class LoopMessageError(RuntimeError):
    pass


def fmt_delay(seconds: int) -> str:
    return f"{seconds} s" if seconds < 60 else f"{round(seconds / 60)} min"


def action_for(delay_sec: int) -> str:
    if delay_sec < 10:
        return "Contact the flight surgeon now."
    if delay_sec < 120:
        return "Send the report and follow the checklist while waiting for a reply."
    return "Repeat at rest. Follow the onboard protocol; don’t wait for Earth."


def _line(result: dict) -> str:
    category = result.get("category")
    name = NAMES.get(category, category)
    unit = UNITS.get(category, "")
    recent = result.get("recent")
    baseline = result.get("baseline")
    return (
        f"{name} {result.get('score')}/10 {result.get('color')} · "
        f"{recent:g}{unit} vs {baseline:g}{unit} baseline"
    )


def build_condition_text(overall: dict, categories: list, delay_sec: int = 120) -> str:
    worst = overall.get("worst") or []
    urgent = overall.get("color") == "red" or any(w.get("color") == "red" for w in worst)
    flag = "URGENT" if urgent else (overall.get("color") or "grey").upper()
    score = overall.get("score")

    lines = [
        "ORBITAL TWIN",
        f"Status: {flag} · overall {score}/10" if score is not None else f"Status: {flag} · score pending",
    ]

    scored = sorted((r for r in categories if r.get("status") == "scored"),
                    key=lambda r: r.get("score") or 0)
    if scored:
        lines.append("")
        lines.extend(_line(r) for r in scored[:MAX_SCORED_LINES])

    lines += [
        "",
        f"One-way delay: {fmt_delay(delay_sec)}",
        f"Request: {action_for(delay_sec)}",
        "",
        "Reply to acknowledge. Not a diagnosis.",
    ]
    return "\n".join(lines)


def send_message(text: str) -> dict:
    key = os.environ.get("LOOP_API_KEY", "").strip()
    contact = os.environ.get("LOOP_TO", "").strip()
    if not key or not contact:
        return {"sent": False, "mock": True, "contact": contact or None, "text": text}

    headers = {"Authorization": key, "Content-Type": "application/json"}
    secret = os.environ.get("LOOP_SECRET_KEY", "").strip()
    if secret:
        headers["Loop-Secret-Key"] = secret

    body = {"contact": contact, "text": text}
    sender = os.environ.get("LOOP_SENDER_ID", "").strip()
    if sender:
        body["sender"] = sender

    url = os.environ.get("LOOP_API_URL", LOOP_SEND_URL)
    try:
        response = httpx.post(url, headers=headers, json=body, timeout=TIMEOUT_SECONDS)
    except httpx.HTTPError as exc:
        raise LoopMessageError(f"Could not reach LoopMessage ({type(exc).__name__}).") from exc

    try:
        payload = response.json()
    except ValueError:
        payload = {}
    if not isinstance(payload, dict):
        payload = {}

    if response.status_code >= 400:
        detail = payload.get("message") or "no detail"
        raise LoopMessageError(
            f"LoopMessage rejected the message ({response.status_code}): {detail}"
        )

    return {
        "sent": True,
        "mock": False,
        "message_id": payload.get("message_id"),
        "contact": payload.get("contact") or contact,
        "text": text,
    }
