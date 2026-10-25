"""Idempotent startup data: super admin account, default plans and the demo salon.

The demo salon ("Salão Exemplo", slug salao-exemplo) is the only populated tenant; it is
re-generated relative to today at most once per day so the "Ver demonstração" button always
shows a live-looking panel. Every other salon starts empty.
"""

import os
import random
from datetime import date as date_cls, timedelta

from lib.auth import hash_password
from lib.db import db
from lib.scheduling import now_local, today_local, to_hhmm, to_min, weekday_sun0
from models.schemas import Appointment, Expense, Plan, Professional, Salon, Service

LEGACY_DEFAULT_ADMIN = "admin@agendaprohair.com"
DEMO_EMAIL = "demo@agendaprohair.com"
DEMO_SLUG = "salao-exemplo"


async def ensure_base_data() -> None:
    # Super admin comes from env (email + pbkdf2 hash) — no plaintext password in code or config.
    admin_email = os.environ.get("SUPERADMIN_EMAIL", "").strip().lower()
    admin_hash = os.environ.get("SUPERADMIN_PASSWORD_HASH", "")
    if admin_email and admin_hash:
        if not await db.users.find_one({"email": admin_email}):
            await db.users.insert_one({
                "id": f"superadmin-{admin_email}", "email": admin_email, "name": "Super Admin",
                "password_hash": admin_hash, "platform_role": "superadmin",
                "salon_id": None, "salon_role": None,
            })
        # retire the old default account (weak, publicly known password)
        old = await db.users.find_one({"email": LEGACY_DEFAULT_ADMIN})
        if old:
            await db.users.delete_one({"email": LEGACY_DEFAULT_ADMIN})
            await db.sessions.delete_many({"user_id": old["id"]})
    if await db.plans.count_documents({}) == 0:
        await db.plans.insert_many([
            Plan(id="plan-basico", name="Básico", price=49, max_professionals=2,
                 features=["Agenda online", "Link de agendamento + QR", "Até 2 profissionais"]).model_dump(),
            Plan(id="plan-pro", name="Pro", price=89, max_professionals=10,
                 features=["Tudo do Básico", "Financeiro e comissões", "Até 10 profissionais", "WhatsApp"]).model_dump(),
        ])
    await ensure_demo()


DEMO_CLIENTS = ["Ana Souza", "Bruno Costa", "Carla Mendes", "Diego Ferreira", "Eduarda Martins", "Felipe Santos",
                "Gabriela Ribeiro", "Henrique Araújo", "Isabela Gomes", "João Pereira", "Larissa Dias", "Marcos Vieira"]
DEMO_DAY_RANGE = range(-28, 7)  # days relative to today
DEMO_OPEN, DEMO_CLOSE = to_min("09:00"), to_min("19:00")


async def ensure_demo(force: bool = False) -> None:
    """Re-generate the demo salon's data relative to today (at most once per day unless forced)."""
    today = today_local()
    salon = await db.salons.find_one({"slug": DEMO_SLUG})
    if salon and salon.get("demo_seeded_on") == today and not force:
        return
    salon = salon or await _create_demo_salon()
    sid = salon["id"]
    await _ensure_demo_user(sid)
    await _clear_salon_data(sid)
    services, pros = _demo_catalog(sid)
    await db.services.insert_many([x.model_dump() for x in services])
    await db.professionals.insert_many([x.model_dump() for x in pros])
    appts = _demo_appointments(sid, salon.get("work_days", [1, 2, 3, 4, 5, 6]), services, pros, today)
    if appts:
        await db.appointments.insert_many(appts)
    await db.expenses.insert_many([e.model_dump() for e in _demo_expenses(sid, today)])
    await db.salons.update_one({"id": sid}, {"$set": {"demo_seeded_on": today}})


async def _create_demo_salon() -> dict:
    s = Salon(id="demo-salon", name="Salão Exemplo", slug=DEMO_SLUG, phone="11987654321",
              address="Rua das Flores, 120 - São Paulo/SP", plan_id="plan-pro", is_demo=True).model_dump()
    await db.salons.insert_one(dict(s))
    return s


async def _ensure_demo_user(sid: str) -> None:
    if await db.users.find_one({"email": DEMO_EMAIL}):
        return
    await db.users.insert_one({
        "id": "demo-user", "email": DEMO_EMAIL, "name": "Demonstração",
        "password_hash": hash_password("demo123"), "platform_role": None,
        "salon_id": sid, "salon_role": "owner",
    })


async def _clear_salon_data(sid: str) -> None:
    for coll in ("services", "professionals", "appointments", "expenses"):
        await db[coll].delete_many({"salon_id": sid})


def _demo_catalog(sid: str) -> tuple[list[Service], list[Professional]]:
    services = [
        Service(salon_id=sid, name="Corte Feminino", category="Cabelo", duration=60, price=90),
        Service(salon_id=sid, name="Corte Masculino", category="Cabelo", duration=30, price=45),
        Service(salon_id=sid, name="Escova Modeladora", category="Cabelo", duration=45, price=80),
        Service(salon_id=sid, name="Barba Completa", category="Barba", duration=30, price=40),
        Service(salon_id=sid, name="Mechas / Luzes", category="Coloração", duration=180, price=280),
        Service(salon_id=sid, name="Manicure & Pedicure", category="Unhas", duration=60, price=60),
        Service(salon_id=sid, name="Design de Sobrancelhas", category="Sobrancelhas", duration=30, price=35),
    ]
    pros = [
        Professional(salon_id=sid, name="Camila Rocha", specialty="Cabeleireira & Colorista", phone="11991112222", commission_pct=40),
        Professional(salon_id=sid, name="Rafael Lima", specialty="Barbeiro", phone="11993334444", commission_pct=45),
        Professional(salon_id=sid, name="Juliana Alves", specialty="Manicure & Estética", phone="11995556666", commission_pct=35),
    ]
    return services, pros


def _demo_appointments(sid: str, work_days: list[int], services: list[Service],
                       pros: list[Professional], today: str) -> list[dict]:
    """Deterministic sample schedule. `random.Random(42)` is intentional: this is fake demo
    content, not a security value — sessions and password salts use `secrets`."""
    skills = {pros[0].id: [0, 2, 4], pros[1].id: [1, 3], pros[2].id: [5, 6]}
    rng = random.Random(42)
    t0 = date_cls.fromisoformat(today)
    now_min = to_min(now_local().strftime("%H:%M"))
    appts: list[dict] = []
    for offset in DEMO_DAY_RANGE:
        d = (t0 + timedelta(days=offset)).isoformat()
        if weekday_sun0(d) not in work_days:
            continue
        for p in pros:
            appts.extend(_demo_day_for_pro(rng, sid, d, offset, now_min, p, [services[i] for i in skills[p.id]]))
    return appts


def _demo_day_for_pro(rng: random.Random, sid: str, d: str, offset: int, now_min: int,
                      p: Professional, options: list[Service]) -> list[dict]:
    out: list[dict] = []
    cursor = DEMO_OPEN + rng.choice([0, 30, 60])
    while True:
        svc = rng.choice(options)
        if cursor + svc.duration > DEMO_CLOSE:
            return out
        if rng.random() < 0.55:
            out.append(_demo_appt(rng, sid, d, offset, now_min, p, svc, cursor))
        cursor += svc.duration + rng.choice([0, 0, 30])


def _demo_status(rng: random.Random, offset: int, end_min: int, now_min: int) -> str:
    past = offset < 0 or (offset == 0 and end_min <= now_min)
    if not past:
        return "confirmado"
    return rng.choices(["finalizado", "cancelado", "ausente"], [85, 9, 6])[0]


def _demo_appt(rng: random.Random, sid: str, d: str, offset: int, now_min: int,
               p: Professional, svc: Service, start: int) -> dict:
    status = _demo_status(rng, offset, start + svc.duration, now_min)
    return Appointment(
        salon_id=sid, service_id=svc.id, service_name=svc.name, professional_id=p.id,
        professional_name=p.name, client_name=rng.choice(DEMO_CLIENTS),
        client_phone=f"1198{rng.randint(1000000, 9999999)}",
        date=d, start=to_hhmm(start), end=to_hhmm(start + svc.duration), price=svc.price,
        commission_pct=p.commission_pct, status=status, source=rng.choice(["online", "interno"]),
        commission_paid=offset < -14 and status == "finalizado",
    ).model_dump()


def _demo_expenses(sid: str, today: str) -> list[Expense]:
    month_start = date_cls.fromisoformat(today).replace(day=1)
    rows = [("Aluguel do espaço", "Aluguel", 2500, 0), ("Produtos de coloração", "Produtos", 640, 3),
            ("Conta de energia", "Energia", 380, 5), ("Internet e telefone", "Serviços", 150, 7)]
    expenses = [Expense(salon_id=sid, description=desc, category=cat, amount=amt,
                        date=(month_start + timedelta(days=day)).isoformat()) for desc, cat, amt, day in rows]
    return [e for e in expenses if e.date <= today]
