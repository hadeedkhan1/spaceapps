from collections import defaultdict
from statistics import median, mean, pstdev

MIN_BEFORE_DAYS = 1
RECENT_DAYS = 3
SPREAD_INFLATE = 1.4
CUSUM_H = 5

CATEGORIES = {
    "sleep_hours": {"label": "sleep", "bad": "low", "min_spread": 0.3},
    "mood": {"label": "mood", "bad": "low", "min_spread": 0.3},
    "hrv": {"label": "heart variability", "bad": "low", "min_spread": 3.0},
    "heart_rate": {"label": "resting heart rate", "bad": "high", "min_spread": 2.0},
    "temperature": {"label": "body temperature", "bad": "both", "min_spread": 0.15},
    "glucose": {"label": "blood glucose", "bad": "both", "min_spread": 5.0},
    "vision_symptoms": {"label": "vision symptoms", "bad": "high", "min_spread": 1.0},
}

def daily_series(rows):
    by_day = defaultdict(list)
    for r in rows:
        by_day[str(r["recorded_at"])[:10]].append(float(r["value"]))
    return [(d, mean(v)) for d, v in sorted(by_day.items())]

def color_for(score):
    return "green" if score >= 7 else "yellow" if score >= 4 else "red"

def cusum_alarm(values, base, spread, bad):
    k, h = 0.5 * spread, CUSUM_H * spread
    lo = hi = 0.0
    for x in values:
        lo = max(0.0, lo + (base - x) - k)
        hi = max(0.0, hi + (x - base) - k)
    return (bad in ("low", "both") and lo > h) or (bad in ("high", "both") and hi > h)

def score_category(category, before_rows, after_rows):
    cfg = CATEGORIES[category]
    before = [v for _, v in daily_series(before_rows)]
    after = [v for _, v in daily_series(after_rows)]
    out = {
        "category": category,
        "label": cfg["label"],
        "before_days": len(before),
        "after_days": len(after),
        "before_readings": len(before_rows),
        "after_readings": len(after_rows)
    }

    if len(before) < MIN_BEFORE_DAYS:
        out.update(status="needs_before_data", color="grey", score=None)
        return out
    if not after:
        out.update(status="needs_after_data", color="grey", score=None)
        return out

    base = median(before)
    mad = median(abs(v - base) for v in before)
    spread = max(max(1.4826 * mad, pstdev(before)) * SPREAD_INFLATE, cfg["min_spread"])

    recent = mean(after[-RECENT_DAYS:])
    z = (recent - base) / spread
    bad = cfg["bad"]
    badness = max(0.0, -z) if bad == "low" else max(0.0, z) if bad == "high" else abs(z)

    score = max(0.0, min(10.0, 10 - 2.5 * badness))

    drift = cusum_alarm(after, base, spread, bad)
    if drift:
        score = min(score, 6.9)

    hard_hit = False

    change = recent - base
    out.update(
        status="scored",
        score=round(score, 1),
        color=color_for(score),
        baseline=round(base, 2),
        after_avg=round(mean(after), 2),
        recent=round(recent, 2),
        change=round(change, 2),
        change_pct=round(100 * change / base, 1) if base else None,
        z=round(z, 2),
        drift_detected=drift,
        hard_limit_hit=hard_hit
    )
    return out

def score_overall(results):
    scored = [r for r in results if r["status"] == "scored"]
    if not scored:
        return {
            "category": "overall",
            "label": "overall",
            "status": "needs_data",
            "color": "grey",
            "score": None
        }
    score = mean(r["score"] for r in scored)
    if any(r["color"] == "red" for r in scored):
        score = min(score, 6.9)
    return {
        "category": "overall",
        "label": "overall",
        "status": "scored",
        "score": round(score, 1),
        "color": color_for(score),
        "worst": sorted(scored, key=lambda r: r["score"])[:2]
    }
