"""Public booking page routes (no auth). Salon resolved by slug; suspended salons are hidden."""

from typing import Optional

from fastapi import APIRouter, HTTPException

from lib.db import supabase
from lib.scheduling import compute_slots, today_local
from models.schemas import (
    AppointmentIn, Availability, Plan, PublicBookingOut, PublicProfessional, PublicSalon, PublicService,
)
from routers.salon import _active_pro_ids, book

router = APIRouter(prefix="/public", tags=["public"])


async def _salon(slug: str) -> dict:
    res = supabase.table("salons").select("*").eq("slug", slug).neq("status", "suspenso").execute()
    s = res.data[0] if res.data else None
    if not s:
        raise HTTPException(404, "Agenda não encontrada ou indisponível")
    return s


@router.get("/plans", response_model=list[Plan])
async def public_plans():
    """Active license plans for the public sales page."""
    res = supabase.table("plans").select("*").eq("active", True).order("price", desc=False).execute()
    return [Plan(**p) for p in (res.data or [])]


@router.get("/salons/{slug}", response_model=PublicSalon)
async def get_public_salon(slug: str):
    s = await _salon(slug)
    
    res_services = supabase.table("services").select("*").eq("salon_id", s["id"]).eq("active", True).order("name", desc=False).execute()
    services = [PublicService(**x) for x in (res_services.data or [])]
    
    res_pros = supabase.table("professionals").select("*").eq("salon_id", s["id"]).eq("active", True).order("name", desc=False).execute()
    pros = [PublicProfessional(**x) for x in (res_pros.data or [])]
    
    return PublicSalon(name=s["name"], slug=s["slug"], phone=s.get("phone", ""), address=s.get("address", ""),
                       open_time=s["open_time"], close_time=s["close_time"], work_days=s["work_days"],
                       today=today_local(), services=services, professionals=pros)


@router.get("/salons/{slug}/availability", response_model=Availability)
async def public_availability(slug: str, date: str, service_id: str, professional_id: Optional[str] = None):
    s = await _salon(slug)
    
    res_svc = supabase.table("services").select("*").eq("salon_id", s["id"]).eq("id", service_id).eq("active", True).execute()
    svc = res_svc.data[0] if res_svc.data else None
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
