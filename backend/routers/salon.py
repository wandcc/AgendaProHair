"""Salon (tenant scope) routes. Every query is filtered by the principal's salon_id."""

from datetime import date as date_cls, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from lib.auth import Principal, require_salon, require_salon_owner
from lib.db import supabase
from lib.scheduling import compute_slots, pick_professional, to_hhmm, to_min, today_local
from models.schemas import (
    Appointment, AppointmentIn, AppointmentPatch, Availability, DailyPoint, DashboardOut, Expense,
    ExpenseIn, FinanceOut, Notification, PayCommissionIn, Professional, ProfessionalCommission,
    ProfessionalIn, Salon, SalonSettingsIn, Service, ServiceIn,
)

router = APIRouter(prefix="/salon", tags=["salon"])


def _scope(p: Principal, **extra) -> dict:
    return {"salon_id": p.salon_id, **extra}


def _commission(a: dict) -> float:
    return round(a["price"] * a["commission_pct"] / 100, 2)


# ---------- settings ----------
@router.get("/me", response_model=Salon)
async def get_salon(p: Principal = Depends(require_salon)):
    s = dict(p.salon or {})
    s.pop("demo_seeded_on", None)
    return Salon(**s)


@router.put("/me", response_model=Salon)
async def update_salon(body: SalonSettingsIn, p: Principal = Depends(require_salon_owner)):
    if to_min(body.open_time) >= to_min(body.close_time):
        raise HTTPException(422, "O horário de abertura deve ser antes do fechamento")
        
    supabase.table("salons").update(body.model_dump()).eq("id", p.salon_id).execute()
    
    res_salon = supabase.table("salons").select("*").eq("id", p.salon_id).execute()
    s = res_salon.data[0] if res_salon.data else {}
    s.pop("demo_seeded_on", None)
    return Salon(**s)


# ---------- services ----------
@router.get("/services", response_model=list[Service])
async def list_services(p: Principal = Depends(require_salon)):
    res = supabase.table("services").select("*").eq("salon_id", p.salon_id).order("name", desc=False).execute()
    return [Service(**s) for s in (res.data or [])]


@router.post("/services", response_model=Service, status_code=201)
async def create_service(body: ServiceIn, p: Principal = Depends(require_salon)):
    svc = Service(**body.model_dump(), salon_id=p.salon_id)
    supabase.table("services").insert(svc.model_dump()).execute()
    return svc


@router.put("/services/{sid}", response_model=Service)
async def update_service(sid: str, body: ServiceIn, p: Principal = Depends(require_salon)):
    res = supabase.table("services").update(body.model_dump()).eq("salon_id", p.salon_id).eq("id", sid).execute()
    if not res.data:
        raise HTTPException(404, "Serviço não encontrado")
    return Service(id=sid, salon_id=p.salon_id, **body.model_dump())


@router.delete("/services/{sid}")
async def delete_service(sid: str, p: Principal = Depends(require_salon)):
    res = supabase.table("services").delete().eq("salon_id", p.salon_id).eq("id", sid).execute()
    if not res.data:
        raise HTTPException(404, "Serviço não encontrado")
    return {"ok": True}


# ---------- professionals ----------
@router.get("/professionals", response_model=list[Professional])
async def list_professionals(p: Principal = Depends(require_salon)):
    res = supabase.table("professionals").select("*").eq("salon_id", p.salon_id).order("name", desc=False).execute()
    return [Professional(**x) for x in (res.data or [])]


@router.post("/professionals", response_model=Professional, status_code=201)
async def create_professional(body: ProfessionalIn, p: Principal = Depends(require_salon)):
    plan_id = (p.salon or {}).get("plan_id")
    res_plan = supabase.table("plans").select("*").eq("id", plan_id).execute()
    plan = res_plan.data[0] if res_plan.data else None
    
    res_pros = supabase.table("professionals").select("id", count="exact").eq("salon_id", p.salon_id).execute()
    count = len(res_pros.data or [])
    
    if plan and count >= plan["max_professionals"]:
        raise HTTPException(403, f"Seu plano {plan['name']} permite até {plan['max_professionals']} profissionais.")
        
    pro = Professional(**body.model_dump(), salon_id=p.salon_id)
    supabase.table("professionals").insert(pro.model_dump()).execute()
    return pro


@router.put("/professionals/{pid}", response_model=Professional)
async def update_professional(pid: str, body: ProfessionalIn, p: Principal = Depends(require_salon)):
    res = supabase.table("professionals").update(body.model_dump()).eq("salon_id", p.salon_id).eq("id", pid).execute()
    if not res.data:
        raise HTTPException(404, "Profissional não encontrado")
        
    # Atualizar nome do profissional nos agendamentos correspondentes
    supabase.table("appointments").update({"professional_name": body.name}).eq("salon_id", p.salon_id).eq("professional_id", pid).execute()
    
    return Professional(id=pid, salon_id=p.salon_id, **body.model_dump())


@router.delete("/professionals/{pid}")
async def delete_professional(pid: str, p: Principal = Depends(require_salon)):
    res = supabase.table("professionals").delete().eq("salon_id", p.salon_id).eq("id", pid).execute()
    if not res.data:
        raise HTTPException(404, "Profissional não encontrado")
    return {"ok": True}


# ---------- appointments ----------
async def _active_pro_ids(salon_id: str) -> list[str]:
    res = supabase.table("professionals").select("id").eq("salon_id", salon_id).eq("active", True).order("name", desc=False).execute()
    return [x["id"] for x in (res.data or [])]


async def book(salon: dict, body: AppointmentIn, source: str) -> Appointment:
    """Shared booking logic for internal + public flows (salon already resolved and scoped)."""
    sid = salon["id"]
    
    res_svc = supabase.table("services").select("*").eq("salon_id", sid).eq("id", body.service_id).eq("active", True).execute()
    svc = res_svc.data[0] if res_svc.data else None
    if not svc:
        raise HTTPException(404, "Serviço não encontrado")
        
    pro_ids = await _active_pro_ids(sid)
    if body.professional_id and body.professional_id not in pro_ids:
        raise HTTPException(404, "Profissional não encontrado")
        
    if body.date < today_local():
        raise HTTPException(422, "Não é possível agendar em datas passadas")
        
    chosen = await pick_professional(salon, body.date, body.start, svc["duration"], body.professional_id, pro_ids)
    if not chosen:
        raise HTTPException(409, "Horário indisponível. Escolha outro horário.")
        
    res_pro = supabase.table("professionals").select("*").eq("salon_id", sid).eq("id", chosen).execute()
    pro = res_pro.data[0] if res_pro.data else None
    
    digits = "".join(c for c in body.client_phone if c.isdigit())
    if len(digits) < 10 or len(digits) > 13:
        raise HTTPException(422, "WhatsApp inválido. Use DDD + número.")
        
    appt = Appointment(
        salon_id=sid, service_id=svc["id"], service_name=svc["name"], professional_id=chosen,
        professional_name=pro["name"], client_name=body.client_name.strip(), client_phone=digits,
        date=body.date, start=body.start, end=to_hhmm(to_min(body.start) + svc["duration"]),
        price=svc["price"], commission_pct=pro["commission_pct"], notes=body.notes, source=source,
    )
    supabase.table("appointments").insert(appt.model_dump()).execute()
    return appt


@router.get("/appointments", response_model=list[Appointment])
async def list_appointments(start: str = Query(...), end: str = Query(...), p: Principal = Depends(require_salon)):
    res = (
        supabase.table("appointments")
        .select("*")
        .eq("salon_id", p.salon_id)
        .gte("date", start)
        .lte("date", end)
        .order("date", desc=False)
        .order("start", desc=False)
        .execute()
    )
    return [Appointment(**a) for a in (res.data or [])]


@router.post("/appointments", response_model=Appointment, status_code=201)
async def create_appointment(body: AppointmentIn, p: Principal = Depends(require_salon)):
    return await book(p.salon or {}, body, "interno")


@router.patch("/appointments/{aid}", response_model=Appointment)
async def patch_appointment(aid: str, body: AppointmentPatch, p: Principal = Depends(require_salon)):
    res = supabase.table("appointments").update({"status": body.status}).eq("salon_id", p.salon_id).eq("id", aid).execute()
    if not res.data:
        raise HTTPException(404, "Agendamento não encontrado")
        
    res_appt = supabase.table("appointments").select("*").eq("salon_id", p.salon_id).eq("id", aid).execute()
    a = res_appt.data[0] if res_appt.data else None
    return Appointment(**a)


@router.delete("/appointments/{aid}")
async def delete_appointment(aid: str, p: Principal = Depends(require_salon)):
    res = supabase.table("appointments").delete().eq("salon_id", p.salon_id).eq("id", aid).execute()
    if not res.data:
        raise HTTPException(404, "Agendamento não encontrado")
    return {"ok": True}


@router.get("/availability", response_model=Availability)
async def availability(date: str, service_id: str, professional_id: Optional[str] = None,
                       p: Principal = Depends(require_salon)):
    res_svc = supabase.table("services").select("*").eq("salon_id", p.salon_id).eq("id", service_id).execute()
    svc = res_svc.data[0] if res_svc.data else None
    if not svc:
        raise HTTPException(404, "Serviço não encontrado")
        
    pro_ids = await _active_pro_ids(p.salon_id)
    if professional_id:
        pro_ids = [x for x in pro_ids if x == professional_id]
        
    is_open, slots = await compute_slots(p.salon or {}, date, svc["duration"], pro_ids)
    return Availability(date=date, open=is_open, slots=list(slots.keys()))


# ---------- dashboard ----------
def _notifications(recent: list[dict], salon_status: Optional[str]) -> list[Notification]:
    items = [
        Notification(id=a["id"], title="Novo agendamento online",
                     message=f"{a['client_name']} agendou {a['service_name']} em {a['date'][8:10]}/{a['date'][5:7]} "
                             f"às {a['start']} com {a['professional_name']}",
                     created_at=a["created_at"])
        for a in recent
    ]
    if salon_status == "inadimplente":
        items.insert(0, Notification(
            id="billing", title="Pagamento pendente",
            message="Sua assinatura está com pagamento em atraso. Regularize para evitar suspensão.",
            created_at=recent[0]["created_at"] if recent else datetime.now(timezone.utc)))
    return items


def _price_sum(appts: list[dict], *statuses: str) -> float:
    return sum(a["price"] for a in appts if a["status"] in statuses)


def _count(appts: list[dict], *statuses: str) -> int:
    return sum(1 for a in appts if a["status"] in statuses)


@router.get("/dashboard", response_model=DashboardOut)
async def dashboard(p: Principal = Depends(require_salon)):
    today = today_local()
    month_prefix = today[:7]
    
    # Buscar agendamentos do mês (usando filtro de data com .like ou .gte/.lte)
    res_month = (
        supabase.table("appointments")
        .select("*")
        .eq("salon_id", p.salon_id)
        .like("date", f"{month_prefix}%")
        .execute()
    )
    month_appts = res_month.data or []
    
    today_appts = sorted((a for a in month_appts if a["date"] == today), key=lambda a: a["start"])
    
    res_comm = (
        supabase.table("appointments")
        .select("*")
        .eq("salon_id", p.salon_id)
        .eq("status", "finalizado")
        .eq("commission_paid", False)
        .execute()
    )
    pending_comm = res_comm.data or []
    
    res_recent = (
        supabase.table("appointments")
        .select("*")
        .eq("salon_id", p.salon_id)
        .eq("source", "online")
        .order("created_at", desc=True)
        .limit(6)
        .execute()
    )
    recent = res_recent.data or []
    
    return DashboardOut(
        today=today,
        revenue_today=_price_sum(today_appts, "finalizado"),
        revenue_month=_price_sum(month_appts, "finalizado"),
        forecast_month=_price_sum(month_appts, "finalizado", "confirmado"),
        appointments_today_count=_count(today_appts, "confirmado", "finalizado", "ausente"),
        pending_today=_count(today_appts, "confirmado"),
        commissions_pending=round(sum(_commission(a) for a in pending_comm), 2),
        appointments_today=[Appointment(**a) for a in today_appts],
        notifications=_notifications(recent, (p.salon or {}).get("status")),
    )


# ---------- finance ----------
def _commission_rows(pros: list[dict], appts: list[dict]) -> list[ProfessionalCommission]:
    rows = {
        x["id"]: ProfessionalCommission(professional_id=x["id"], name=x["name"], commission_pct=x["commission_pct"],
                                        appointments=0, revenue=0, commission=0, paid=0, pending=0)
        for x in pros
    }
    for a in appts:
        row = rows.get(a["professional_id"])
        if row:
            _add_to_commission_row(row, a)
    return list(rows.values())


def _add_to_commission_row(row: ProfessionalCommission, a: dict) -> None:
    c = _commission(a)
    row.appointments += 1
    row.revenue += a["price"]
    row.commission = round(row.commission + c, 2)
    if a.get("commission_paid"):
        row.paid = round(row.paid + c, 2)
    else:
        row.pending = round(row.pending + c, 2)


def _month_days(month: str) -> list[str]:
    y, m = map(int, month.split("-"))
    first = date_cls(y, m, 1)
    nxt = (first.replace(day=28) + timedelta(days=4)).replace(day=1)
    return [(first + timedelta(days=i)).isoformat() for i in range((nxt - first).days)]


def _daily_series(month: str, appts: list[dict], expenses: list[dict]) -> list[DailyPoint]:
    rev: dict[str, float] = {}
    exp: dict[str, float] = {}
    for a in appts:
        rev[a["date"]] = rev.get(a["date"], 0) + a["price"]
    for e in expenses:
        exp[e["date"]] = exp.get(e["date"], 0) + e["amount"]
    return [DailyPoint(date=d, revenue=rev.get(d, 0), expenses=exp.get(d, 0)) for d in _month_days(month)]


@router.get("/finance", response_model=FinanceOut)
async def finance(month: Optional[str] = Query(default=None, pattern=r"^\d{4}-\d{2}$"),
                  p: Principal = Depends(require_salon)):
    month = month or today_local()[:7]
    
    res_appts = (
        supabase.table("appointments")
        .select("*")
        .eq("salon_id", p.salon_id)
        .like("date", f"{month}%")
        .eq("status", "finalizado")
        .order("date", desc=True)
        .order("start", desc=True)
        .execute()
    )
    appts = res_appts.data or []
    
    res_expenses = (
        supabase.table("expenses")
        .select("*")
        .eq("salon_id", p.salon_id)
        .like("date", f"{month}%")
        .order("date", desc=True)
        .execute()
    )
    expenses = res_expenses.data or []
    
    res_pros = supabase.table("professionals").select("*").eq("salon_id", p.salon_id).execute()
    pros = res_pros.data or []
    
    by_pro = _commission_rows(pros, appts)
    revenue = sum(a["price"] for a in appts)
    exp_total = sum(e["amount"] for e in expenses)
    comm_total = round(sum(r.commission for r in by_pro), 2)
    
    return FinanceOut(
        month=month, revenue=revenue, expenses_total=exp_total, commissions_total=comm_total,
        profit=round(revenue - exp_total - comm_total, 2), by_professional=by_pro,
        expenses=[Expense(**e) for e in expenses], entries=[Appointment(**a) for a in appts],
        daily=_daily_series(month, appts, expenses),
    )


@router.post("/commissions/pay")
async def pay_commission(body: PayCommissionIn, p: Principal = Depends(require_salon_owner)):
    res = (
        supabase.table("appointments")
        .update({"commission_paid": True})
        .eq("salon_id", p.salon_id)
        .eq("professional_id", body.professional_id)
        .eq("status", "finalizado")
        .eq("commission_paid", False)
        .like("date", f"{body.month}%")
        .execute()
    )
    updated_count = len(res.data or [])
    return {"ok": True, "updated": updated_count}


@router.post("/expenses", response_model=Expense, status_code=201)
async def create_expense(body: ExpenseIn, p: Principal = Depends(require_salon)):
    e = Expense(**body.model_dump(), salon_id=p.salon_id)
    supabase.table("expenses").insert(e.model_dump()).execute()
    return e


@router.delete("/expenses/{eid}")
async def delete_expense(eid: str, p: Principal = Depends(require_salon)):
    res = supabase.table("expenses").delete().eq("salon_id", p.salon_id).eq("id", eid).execute()
    if not res.data:
        raise HTTPException(404, "Despesa não encontrada")
    return {"ok": True}
