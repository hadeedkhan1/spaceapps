import os
import secrets
import sys
import json
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, time, timedelta, timezone
from functools import lru_cache
from pathlib import Path
from typing import Literal

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.alert import LoopMessageError, build_condition_text, send_message
from backend.auth import normalize_phone, hash_password, verify_password
from backend.scoring import CATEGORIES, score_category, score_overall
from backend.explain import explain
from backend.evidence import search_evidence

load_dotenv(ROOT / ".env")
_db = None


def get_db():
    global _db
    if _db is None:
        from supabase import create_client
        _db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    return _db


app = FastAPI(title="Orbital Twin API")
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])
DEMO_PHONE = "+15555550199"


class Credentials(BaseModel):
    phone: str
    password: str = Field(min_length=8, max_length=128)


class Reading(BaseModel):
    userid: str
    category: str
    value: float
    time: Literal["before", "after"]
    recorded_at: datetime | None = None


class Alert(BaseModel):
    userid: str
    delay_sec: int = Field(default=120, ge=0, le=3600)


def clean_phone(raw):
    try:
        return normalize_phone(raw)
    except ValueError as e:
        raise HTTPException(400, str(e))


def require_user(db, userid):
    if not db.table("users").select("user_id").eq("user_id", userid).execute().data:
        raise HTTPException(404, "Unknown userid. Sign up first.")


DEMO_BASELINE_DAYS = 7
DEMO_AFTER_DAYS = 5
DEMO_SERIES = {
    "heart_rate": ([60, 61, 60, 62, 61, 60, 61], [71, 72, 73, 74, 75]),
    "hrv": ([48, 47, 49, 48, 46, 48, 47], [46, 45, 44, 43, 43]),
    "sleep_hours": ([7.4, 7.6, 7.5, 7.3, 7.5, 7.6, 7.4], [7.2, 7.0, 6.9, 6.8, 6.8]),
    "mood": ([7, 7.5, 7, 7, 8, 7, 7.5], [7, 6.5, 6.5, 6, 6]),
    "blood_pressure": ([118, 120, 117, 119, 118, 121, 119], [121, 122, 120, 123, 122]),
    "temperature": ([36.7, 36.8, 36.7, 36.8, 36.7, 36.8, 36.7], [36.8, 36.7, 36.8, 36.8, 36.7]),
    "glucose": ([92, 90, 94, 91, 93, 92, 90], [93, 91, 95, 92, 94]),
    "exercise_minutes": ([130, 120, 125, 135, 120, 130, 125], [120, 115, 110, 105, 100]),
    "vision_symptoms": ([0, 0, 1, 0, 0, 0, 0], [0, 1, 1, 2, 2]),
}


def demo_rows(userid):
    today = datetime.now(timezone.utc).date()
    rows = []
    for category, (baseline, after) in DEMO_SERIES.items():
        for offset, value in zip(range(DEMO_BASELINE_DAYS + DEMO_AFTER_DAYS, DEMO_AFTER_DAYS, -1), baseline):
            rows.append(demo_row(userid, category, value, "before", today - timedelta(days=offset)))
        for offset, value in zip(range(DEMO_AFTER_DAYS, 0, -1), after):
            rows.append(demo_row(userid, category, value, "after", today - timedelta(days=offset)))
    return rows


def demo_row(userid, category, value, phase, day):
    return {
        "user_id": userid,
        "category": category,
        "value": value,
        "phase": phase,
        "recorded_at": datetime.combine(day, time(8), timezone.utc).isoformat(),
    }


@app.post("/demo")
def demo_account():
    db = get_db()
    users = db.table("users").select("user_id").eq("phone", DEMO_PHONE).execute().data
    if users:
        userid = users[0]["user_id"]
    else:
        userid = "u_demo_" + secrets.token_hex(6)
        db.table("users").insert({
            "user_id": userid,
            "phone": DEMO_PHONE,
            "password_hash": hash_password(secrets.token_urlsafe(32)),
        }).execute()

    existing = db.table("readings").select("category,phase").eq("user_id", userid).execute().data
    complete = all(
        sum(1 for row in existing if row["category"] == category and row["phase"] == "before") >= DEMO_BASELINE_DAYS
        and sum(1 for row in existing if row["category"] == category and row["phase"] == "after") >= DEMO_AFTER_DAYS
        for category in DEMO_SERIES
    )
    if not complete:
        db.table("readings").delete().eq("user_id", userid).execute()
        db.table("readings").insert(demo_rows(userid)).execute()
    return {"userid": userid, "phone": "Simulated demo account", "demo": True}


@app.post("/signup", status_code=201)
def signup(c: Credentials):
    phone = clean_phone(c.phone)
    db = get_db()
    if db.table("users").select("user_id").eq("phone", phone).execute().data:
        raise HTTPException(409, "That phone number is already registered")
    userid = "u_" + secrets.token_hex(8)
    db.table("users").insert({"user_id": userid, "phone": phone,
                              "password_hash": hash_password(c.password)}).execute()
    return {"userid": userid}


@app.post("/login")
def login(c: Credentials):
    phone = clean_phone(c.phone)
    rows = (get_db().table("users").select("user_id,password_hash")
            .eq("phone", phone).execute().data)
    if not rows or not verify_password(c.password, rows[0]["password_hash"]):
        raise HTTPException(401, "Wrong phone number or password")
    return {"userid": rows[0]["user_id"]}


@app.post("/readings")
def add_reading(r: Reading):
    if r.category not in CATEGORIES:
        raise HTTPException(400, f"category must be one of {list(CATEGORIES)}")
    db = get_db()
    require_user(db, r.userid)
    row = {"user_id": r.userid, "category": r.category, "value": r.value, "phase": r.time}
    if r.recorded_at:
        row["recorded_at"] = r.recorded_at.isoformat()
    db.table("readings").insert(row).execute()
    return {"ok": True}


def user_categories(userid):
    db = get_db()
    require_user(db, userid)
    rows = (db.table("readings").select("category,value,phase,recorded_at")
            .eq("user_id", userid).order("recorded_at").limit(5000).execute().data)

    def one(category):
        mine = [x for x in rows if x["category"] == category]
        return score_category(category,
                              [x for x in mine if x["phase"] == "before"],
                              [x for x in mine if x["phase"] == "after"])

    return {category: one(category) for category in CATEGORIES}


def scored_user(userid):
    categories = list(user_categories(userid).values())
    return score_overall(categories), categories


@app.get("/status")
def get_status(userid: str = Query(...), category: str = Query("overall")):
    if category != "overall" and category not in CATEGORIES:
        raise HTTPException(400, f"category must be 'overall' or one of {list(CATEGORIES)}")
    by_category = user_categories(userid)
    if category == "overall":
        result = score_overall(list(by_category.values()))
        evidence = search_evidence(result)
    else:
        result = by_category[category]
        evidence = {"provider": "none", "results": [], "query": None}
    result.update(explain(result, use_llm=result.get("status") == "scored", evidence=evidence["results"]))
    result["evidence_provider"] = evidence["provider"]
    result["evidence_results"] = evidence["results"]
    return result


@app.get("/dashboard")
def get_dashboard(userid: str = Query(...)):
    by_category = user_categories(userid)
    overall = score_overall(list(by_category.values()))
    evidence = search_evidence(overall)
    overall.update(explain(overall, use_llm=overall.get("status") == "scored", evidence=evidence["results"]))
    overall["evidence_provider"] = evidence["provider"]
    overall["evidence_results"] = evidence["results"]
    for result in by_category.values():
        result.update(explain(result, use_llm=result.get("status") == "scored"))
        result["evidence_provider"] = "none"
        result["evidence_results"] = []
    return {"overall": overall, "categories": by_category}


@app.post("/alert")
def send_alert(a: Alert):
    overall, categories = scored_user(a.userid)
    text = build_condition_text(overall, categories, delay_sec=a.delay_sec)
    try:
        return send_message(text)
    except LoopMessageError as exc:
        raise HTTPException(502, str(exc))


@lru_cache(maxsize=1)
def _nasa_sep_events(_cache_minute: str):
    today = datetime.now(timezone.utc).date()
    params = urllib.parse.urlencode({
        "startDate": (today - timedelta(days=7)).isoformat(),
        "endDate": today.isoformat(),
    })
    url = f"https://ccmc.gsfc.nasa.gov/DONKI-API/get/SEP?{params}"
    req = urllib.request.Request(url, headers={"User-Agent": "OrbitalTwin/1.0"})
    with urllib.request.urlopen(req, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


@app.get("/space-weather")
def space_weather():
    try:
        payload = _nasa_sep_events(datetime.now(timezone.utc).strftime("%Y-%m-%dT%H"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
        raise HTTPException(502, "NASA space weather feed is temporarily unavailable") from error
    events = []
    for event in payload if isinstance(payload, list) else []:
        events.append({
            "eventTime": event.get("eventTime"),
            "link": event.get("link"),
            "instruments": event.get("instruments", []),
        })
    events.sort(key=lambda event: event.get("eventTime") or "", reverse=True)
    return {
        "events": events[:5],
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "source": "NASA DONKI Solar Energetic Particle catalog",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=os.environ.get("HOST", "127.0.0.1"), port=int(os.environ.get("PORT", 8000)))
