"""Availability computation based on salon working hours and existing appointments."""

from datetime import date as date_cls, datetime
from typing import Optional
from zoneinfo import ZoneInfo

from lib.db import db

TZ = "America/Sao_Paulo"
BLOCKING = ["confirmado", "finalizado"]


def now_local() -> datetime:
    return datetime.now(ZoneInfo(TZ))


def today_local() -> str:
    return now_local().strftime("%Y-%m-%d")


def to_min(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def to_hhmm(mins: int) -> str:
    return f"{mins // 60:02d}:{mins % 60:02d}"


def weekday_sun0(d: str) -> int:
    """0=Domingo .. 6=Sábado"""
    return (date_cls.fromisoformat(d).weekday() + 1) % 7


async def busy_by_professional(salon_id: str, d: str) -> dict[str, list[tuple[int, int]]]:
    busy: dict[str, list[tuple[int, int]]] = {}
    async for a in db.appointments.find({"salon_id": salon_id, "date": d, "status": {"$in": BLOCKING}}):
        busy.setdefault(a["professional_id"], []).append((to_min(a["start"]), to_min(a["end"])))
    return busy


def _free(intervals: list[tuple[int, int]], s: int, e: int) -> bool:
    return all(e <= bs or s >= be for bs, be in intervals)


async def compute_slots(salon: dict, d: str, duration: int, pro_ids: list[str]) -> tuple[bool, dict[str, list[str]]]:
    """Return (open, {slot: [free professional ids]})."""
    if weekday_sun0(d) not in salon.get("work_days", []) or d < today_local():
        return False, {}
    open_m, close_m = to_min(salon["open_time"]), to_min(salon["close_time"])
    step = int(salon.get("slot_interval", 30))
    busy = await busy_by_professional(salon["id"], d)
    min_start = -1
    if d == today_local():
        n = now_local()
        min_start = n.hour * 60 + n.minute
    result: dict[str, list[str]] = {}
    s = open_m
    while s + duration <= close_m:
        if s > min_start:
            free = [p for p in pro_ids if _free(busy.get(p, []), s, s + duration)]
            if free:
                result[to_hhmm(s)] = free
        s += step
    return True, result


async def pick_professional(salon: dict, d: str, start: str, duration: int,
                            requested: Optional[str], pro_ids: list[str]) -> Optional[str]:
    """Validate slot and return the professional id that will take it (None if unavailable)."""
    if to_min(start) + duration > to_min(salon["close_time"]) or to_min(start) < to_min(salon["open_time"]):
        return None
    if weekday_sun0(d) not in salon.get("work_days", []):
        return None
    busy = await busy_by_professional(salon["id"], d)
    s, e = to_min(start), to_min(start) + duration
    candidates = [requested] if requested else pro_ids
    for p in candidates:
        if p in pro_ids and _free(busy.get(p, []), s, e):
            return p
    return None
