import os
import secrets
import sys
from datetime import datetime
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

load_dotenv(ROOT / ".env")
_db = None


def get_db():
    global _db
    if _db is None:
        from supabase import create_client
        _db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    return _db


app = FastAPI(title="riverhacks 26 backend api")
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])


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


def scored_user(userid):
    db = get_db()
    require_user(db, userid)
    rows = (db.table("readings").select("category,value,phase,recorded_at")
            .eq("user_id", userid).order("recorded_at").limit(5000).execute().data)

    def one(cat):
        mine = [x for x in rows if x["category"] == cat]
        return score_category(cat,
                              [x for x in mine if x["phase"] == "before"],
                              [x for x in mine if x["phase"] == "after"])

    categories = [one(c) for c in CATEGORIES]
    return score_overall(categories), categories


@app.get("/status")
def get_status(userid: str = Query(...), category: str = Query("overall")):
    if category != "overall" and category not in CATEGORIES:
        raise HTTPException(400, f"category must be 'overall' or one of {list(CATEGORIES)}")
    overall, categories = scored_user(userid)
    result = overall if category == "overall" else next(
        r for r in categories if r["category"] == category)
    result.update(explain(result))
    return result


@app.post("/alert")
def send_alert(a: Alert):
    overall, categories = scored_user(a.userid)
    text = build_condition_text(overall, categories, delay_sec=a.delay_sec)
    try:
        return send_message(text)
    except LoopMessageError as exc:
        raise HTTPException(502, str(exc))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=os.environ.get("HOST", "127.0.0.1"), port=int(os.environ.get("PORT", 8000)))