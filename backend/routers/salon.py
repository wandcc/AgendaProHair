"""Salon (tenant scope) routes. Every query is filtered by the principal's salon_id."""

from datetime import date as date_cls, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from lib.auth import Principal, require_salon, require_salon_owner
from lib.db import db
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
    await db.salons.update_one({"id": p.salon_id}, {"$set": body.model_dump()})
    s = await db.salons.find_one({"id": p.salon_id}, {"_id": 0, "demo_seeded_on": 0})
    return Salon(**s)


# ---------- services ----------
@router.get("/services", response_model=list[Service])
async def list_services(p: Principal = Depends(require_salon)):
    return [Service(**s) async for s in db.services.find(_scope(p), {"_id": 0}).sort("name", 1)]


@router.post("/services", response_model=Service, status_code=201)
async def create_service(body: ServiceIn, p: Principal = Depends(require_salon)):
    svc = Service(**body.model_dump(), salon_id=p.salon_id)
    await db.services.insert_one(svc.model_dump())
    return svc


@router.put("/services/{sid}", response_model=Service)
async def update_service(sid: str, body: ServiceIn, p: Principal = Depends(require_salon)):
    res = await db.services.update_one(_scope(p, id=sid), {"$set": body.model_dump()})
    if not res.matched_count:
        raise HTTPException(404, "Serviço não encontrado")
    return Service(id=sid, salon_id=p.salon_id, **body.model_dump())


@router.delete("/services/{sid}")
async def delete_service(sid: str, p: Principal = Depends(require_salon)):
    res = await db.services.delete_one(_scope(p, id=sid))
    if not res.deleted_count:
        raise HTTPException(404, "Serviço não encontrado")
    return {"ok": True}


# ---------- professionals ----------
@router.get("/professionals", response_model=list[Professional])
async def list_professionals(p: Principal = Depends(require_salon)):
    return [Professional(**x) async for x in db.professionals.find(_scope(p), {"_id": 0}).sort("name", 1)]


@router.post("/professionals", response_model=Professional, status_code=201)
async def create_professional(body: ProfessionalIn, p: Principal = Depends(require_salon)):
    plan = await db.plans.find_one({"id": (p.salon or {}).get("plan_id")})
    count = await db.professionals.count_documents(_scope(p))
    if plan and count >= plan["max_professionals"]:
        raise HTTPException(403, f"Seu plano {plan['name']} permite até {plan['max_professionals']} profissionais.")
    pro = Professional(**body.model_dump(), salon_id=p.salon_id)
    await db.professionals.insert_one(pro.model_dump())
    return pro


@router.put("/professionals/{pid}", response_model=Professional)
async def update_professional(pid: str, body: ProfessionalIn, p: Principal = Depends(require_salon)):
    res = await db.professionals.update_one(_scope(p, id=pid), {"$set": body.model_dump()})
    if not res.matched_count:
        raise HTTPException(404, "Profissional não encontrado")
    await db.appointments.update_many(_scope(p, professional_id=pid), {"$set": {"professional_name": body.name}})
    return Professional(id=pid, salon_id=p.salon_id, **body.model_dump())


@router.delete("/professionals/{pid}")
async def delete_professional(pid: str, p: Principal = Depends(require_salon)):
    res = await db.professionals.delete_one(_scope(p, id=pid))
    if not res.deleted_count:
        raise HTTPException(404, "Profissional não encontrado")
    return {"ok": True}


# ---------- appointments ----------
async def _active_pro_ids(salon_id: str) -> list[str]:
    return [x["id"] async for x in db.professionals.find({"salon_id": salon_id, "active": True}).sort("name", 1)]


async def book(salon: dict, body: AppointmentIn, source: str) -> Appointment:
    """Shared booking logic for internal + public flows (salon already resolved and scoped)."""
    sid = salon["id"]
    svc = await db.services.find_one({"salon_id": sid, "id": body.service_id, "active": True})
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
    pro = await db.professionals.find_one({"salon_id": sid, "id": chosen})
    digits = "".join(c for c in body.client_phone if c.isdigit())
    if len(digits) < 10 or len(digits) > 13:
        raise HTTPException(422, "WhatsApp inválido. Use DDD + número.")
    appt = Appointment(
        salon_id=sid, service_id=svc["id"], service_name=svc["name"], professional_id=chosen,
        professional_name=pro["name"], client_name=body.client_name.strip(), client_phone=digits,
        date=body.date, start=body.start, end=to_hhmm(to_min(body.start) + svc["duration"]),
        price=svc["price"], commission_pct=pro["commission_pct"], notes=body.notes, source=source,
    )
    await db.appointments.insert_one(appt.model_dump())
    return appt


@router.get("/appointments", response_model=list[Appointment])
async def list_appointments(start: str = Query(...), end: str = Query(...), p: Principal = Depends(require_salon)):
    q = _scope(p, date={"$gte": start, "$lte": end})
    return [Appointment(**a) async for a in db.appointments.find(q, {"_id": 0}).sort([("date", 1), ("start", 1)])]


@router.post("/appointments", response_model=Appointment, status_code=201)
async def create_appointment(body: AppointmentIn, p: Principal = Depends(require_salon)):
    return await book(p.salon or {}, body, "interno")


@router.patch("/appointments/{aid}", response_model=Appointment)
async def patch_appointment(aid: str, body: AppointmentPatch, p: Principal = Depends(require_salon)):
    res = await db.appointments.update_one(_scope(p, id=aid), {"$set": {"status": body.status}})
    if not res.matched_count:
        raise HTTPException(404, "Agendamento não encontrado")
    a = await db.appointments.find_one(_scope(p, id=aid), {"_id": 0})
    return Appointment(**a)


@router.delete("/appointments/{aid}")
async def delete_appointment(aid: str, p: Principal = Depends(require_salon)):
    res = await db.appointments.delete_one(_scope(p, id=aid))
    if not res.deleted_count:
        raise HTTPException(404, "Agendamento não encontrado")
    return {"ok": True}


@router.get("/availability", response_model=Availability)
async def availability(date: str, service_id: str, professional_id: Optional[str] = None,
                       p: Principal = Depends(require_salon)):
    svc = await db.services.find_one(_scope(p, id=service_id))
    if not svc:
        raise HTTPException(404, "Serviço não encontrado")
    pro_ids = await _active_pro_ids(p.salon_id)
    if professional_id:
        pro_ids = [x for x in pro_ids if x == professional_id]
    is_open, slots = await compute_slots(p.salon or {}, date, svc["duration"], pro_ids)
    return Availability(date=date, open=is_open, slots=list(slots.keys()))


# ---------- dashboard ----------
@router.get("/dashboard", response_model=DashboardOut)
async def dashboard(p: Principal = Depends(require_salon)):
    today = today_local()
    month = today[:7]
    month_appts = await db.appointments.find(_scope(p, date={"$regex": f"^{month}"}), {"_id": 0}).to_list(10000)
    today_appts = sorted([a for a in month_appts if a["date"] == today], key=lambda a: a["start"])
    done = [a for a in month_appts if a["status"] == "finalizado"]
    pending_comm = await db.appointments.find(_scope(p, status="finalizado", commission_paid=False), {"_id": 0}).to_list(10000)
    recent = await db.appointments.find(_scope(p, source="online"), {"_id": 0}).sort("created_at", -1).to_list(6)
    notifications = [
        Notification(id=a["id"], title="Novo agendamento online",
                     message=f"{a['client_name']} agendou {a['service_name']} em {a['date'][8:10]}/{a['date'][5:7]} às {a['start']} com {a['professional_name']}",
                     created_at=a["created_at"])
        for a in recent
    ]
    if (p.salon or {}).get("status") == "inadimplente":
        notifications.insert(0, Notification(id="billing", title="Pagamento pendente",
                                              message="Sua assinatura está com pagamento em atraso. Regularize para evitar suspensão.",
                                              created_at=recent[0]["created_at"] if recent else datetime.now(timezone.utc)))
    return DashboardOut(
        today=today,
        revenue_today=sum(a["price"] for a in today_appts if a["status"] == "finalizado"),
        revenue_month=sum(a["price"] for a in done),
        forecast_month=sum(a["price"] for a in month_appts if a["status"] in ("finalizado", "confirmado")),
        appointments_today_count=len([a for a in today_appts if a["status"] != "cancelado"]),
        pending_today=len([a for a in today_appts if a["status"] == "confirmado"]),
        commissions_pending=round(sum(_commission(a) for a in pending_comm), 2),
        appointments_today=[Appointment(**a) for a in today_appts],
        notifications=notifications,
    )


# ---------- finance ----------
@router.get("/finance", response_model=FinanceOut)
async def finance(month: Optional[str] = None, p: Principal = Depends(require_salon)):
    month = month or today_local()[:7]
    appts = await db.appointments.find(_scope(p, date={"$regex": f"^{month}"}, status="finalizado"),
                                       {"_id": 0}).sort([("date", -1), ("start", -1)]).to_list(10000)
    expenses = await db.expenses.find(_scope(p, date={"$regex": f"^{month}"}), {"_id": 0}).sort("date", -1).to_list(5000)
    pros = await db.professionals.find(_scope(p), {"_id": 0}).to_list(500)
    by_pro: dict[str, ProfessionalCommission] = {
        x["id"]: ProfessionalCommission(professional_id=x["id"], name=x["name"], commission_pct=x["commission_pct"],
                                        appointments=0, revenue=0, commission=0, paid=0, pending=0) for x in pros
    }
    for a in appts:
        row = by_pro.get(a["professional_id"])
        if not row:
            continue
        c = _commission(a)
        row.appointments += 1
        row.revenue += a["price"]
        row.commission = round(row.commission + c, 2)
        if a.get("commission_paid"):
            row.paid = round(row.paid + c, 2)
        else:
            row.pending = round(row.pending + c, 2)
    y, m = map(int, month.split("-"))
    first = date_cls(y, m, 1)
    last = (first.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
    daily = []
    d = first
    while d <= last:
        ds = d.isoformat()
        daily.append(DailyPoint(date=ds, revenue=sum(a["price"] for a in appts if a["date"] == ds),
                                expenses=sum(e["amount"] for e in expenses if e["date"] == ds)))
        d += timedelta(days=1)
    revenue = sum(a["price"] for a in appts)
    exp_total = sum(e["amount"] for e in expenses)
    comm_total = round(sum(r.commission for r in by_pro.values()), 2)
    return FinanceOut(
        month=month, revenue=revenue, expenses_total=exp_total, commissions_total=comm_total,
        profit=round(revenue - exp_total - comm_total, 2), by_professional=list(by_pro.values()),
        expenses=[Expense(**e) for e in expenses], entries=[Appointment(**a) for a in appts], daily=daily,
    )


@router.post("/commissions/pay")
async def pay_commission(body: PayCommissionIn, p: Principal = Depends(require_salon_owner)):
    res = await db.appointments.update_many(
        _scope(p, professional_id=body.professional_id, status="finalizado", commission_paid=False,
               date={"$regex": f"^{body.month}"}),
        {"$set": {"commission_paid": True}},
    )
    return {"ok": True, "updated": res.modified_count}


@router.post("/expenses", response_model=Expense, status_code=201)
async def create_expense(body: ExpenseIn, p: Principal = Depends(require_salon)):
    e = Expense(**body.model_dump(), salon_id=p.salon_id)
    await db.expenses.insert_one(e.model_dump())
    return e


@router.delete("/expenses/{eid}")
async def delete_expense(eid: str, p: Principal = Depends(require_salon)):
    res = await db.expenses.delete_one(_scope(p, id=eid))
    if not res.deleted_count:
        raise HTTPException(404, "Despesa não encontrada")
    return {"ok": True}
