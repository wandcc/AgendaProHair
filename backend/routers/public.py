"""Public booking page routes (no auth). Salon resolved by slug; suspended salons are hidden."""

from typing import Optional

from fastapi import APIRouter, HTTPException

from lib.db import db
from lib.scheduling import compute_slots, today_local
from models.schemas import (
    AppointmentIn, Availability, PublicBookingOut, PublicProfessional, PublicSalon, PublicService,
)
from routers.salon import _active_pro_ids, book

router = APIRouter(prefix="/public", tags=["public"])


async def _salon(slug: str) -> dict:
    s = await db.salons.find_one({"slug": slug, "status": {"$ne": "suspenso"}}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Agenda não encontrada ou indisponível")
    return s


@router.get("/salons/{slug}", response_model=PublicSalon)
async def get_public_salon(slug: str):
    s = await _salon(slug)
    services = [PublicService(**x) async for x in db.services.find({"salon_id": s["id"], "active": True}, {"_id": 0}).sort("name", 1)]
    pros = [PublicProfessional(**x) async for x in db.professionals.find({"salon_id": s["id"], "active": True}, {"_id": 0}).sort("name", 1)]
    return PublicSalon(name=s["name"], slug=s["slug"], phone=s.get("phone", ""), address=s.get("address", ""),
                       open_time=s["open_time"], close_time=s["close_time"], work_days=s["work_days"],
                       today=today_local(), services=services, professionals=pros)


@router.get("/salons/{slug}/availability", response_model=Availability)
async def public_availability(slug: str, date: str, service_id: str, professional_id: Optional[str] = None):
    s = await _salon(slug)
    svc = await db.services.find_one({"salon_id": s["id"], "id": service_id, "active": True})
    if not svc:
        raise HTTPException(404, "Serviço não encontrado")
    pro_ids = await _active_pro_ids(s["id"])
    if professional_id:
        pro_ids = [x for x in pro_ids if x == professional_id]
    is_open, slots = await compute_slots(s, date, svc["duration"], pro_ids)
    return Availability(date=date, open=is_open, slots=list(slots.keys()))


@router.post("/salons/{slug}/book", response_model=PublicBookingOut, status_code=201)
async def public_book(slug: str, body: AppointmentIn):
    s = await _salon(slug)
    a = await book(s, body, "online")
    return PublicBookingOut(id=a.id, salon_name=s["name"], salon_phone=s.get("phone", ""),
                            service_name=a.service_name, professional_name=a.professional_name,
                            client_name=a.client_name, date=a.date, start=a.start, end=a.end, price=a.price)
