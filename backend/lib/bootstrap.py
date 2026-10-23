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


async def ensure_demo(force: bool = False) -> None:
    salon = await db.salons.find_one({"slug": DEMO_SLUG})
    today = today_local()
    if salon and salon.get("demo_seeded_on") == today and not force:
        return
    if not salon:
        s = Salon(id="demo-salon", name="Salão Exemplo", slug=DEMO_SLUG, phone="11987654321",
                  address="Rua das Flores, 120 - São Paulo/SP", plan_id="plan-pro", is_demo=True)
        await db.salons.insert_one(s.model_dump())
        salon = s.model_dump()
    sid = salon["id"]
    if not await db.users.find_one({"email": DEMO_EMAIL}):
        await db.users.insert_one({
            "id": "demo-user", "email": DEMO_EMAIL, "name": "Demonstração",
            "password_hash": hash_password("demo123"), "platform_role": None,
            "salon_id": sid, "salon_role": "owner",
        })
    for coll in ("services", "professionals", "appointments", "expenses"):
        await db[coll].delete_many({"salon_id": sid})

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
    await db.services.insert_many([x.model_dump() for x in services])
    await db.professionals.insert_many([x.model_dump() for x in pros])

    clients = ["Ana Souza", "Bruno Costa", "Carla Mendes", "Diego Ferreira", "Eduarda Martins", "Felipe Santos",
               "Gabriela Ribeiro", "Henrique Araújo", "Isabela Gomes", "João Pereira", "Larissa Dias", "Marcos Vieira"]
    skill = {pros[0].id: [0, 2, 4], pros[1].id: [1, 3], pros[2].id: [5, 6]}
    rng = random.Random(42)
    t0 = date_cls.fromisoformat(today)
    now_min = to_min(now_local().strftime("%H:%M"))
    appts = []
    for offset in range(-28, 7):
        d = (t0 + timedelta(days=offset)).isoformat()
        if weekday_sun0(d) not in salon.get("work_days", [1, 2, 3, 4, 5, 6]):
            continue
        for p in pros:
            cursor = to_min("09:00") + rng.choice([0, 30, 60])
            while True:
                svc = services[rng.choice(skill[p.id])]
                if cursor + svc.duration > to_min("19:00"):
                    break
                if rng.random() < 0.55:
                    past = offset < 0 or (offset == 0 and cursor + svc.duration <= now_min)
                    if past:
                        status = rng.choices(["finalizado", "cancelado", "ausente"], [85, 9, 6])[0]
                    else:
                        status = "confirmado"
                    name = rng.choice(clients)
                    appts.append(Appointment(
                        salon_id=sid, service_id=svc.id, service_name=svc.name, professional_id=p.id,
                        professional_name=p.name, client_name=name, client_phone=f"1198{rng.randint(1000000, 9999999)}",
                        date=d, start=to_hhmm(cursor), end=to_hhmm(cursor + svc.duration), price=svc.price,
                        commission_pct=p.commission_pct, status=status,
                        source=rng.choice(["online", "interno"]),
                        commission_paid=offset < -14 and status == "finalizado",
                    ).model_dump())
                cursor += svc.duration + rng.choice([0, 0, 30])
    if appts:
        await db.appointments.insert_many(appts)

    month_start = t0.replace(day=1)
    expenses = [
        Expense(salon_id=sid, description="Aluguel do espaço", category="Aluguel", amount=2500, date=month_start.isoformat()),
        Expense(salon_id=sid, description="Produtos de coloração", category="Produtos", amount=640, date=(month_start + timedelta(days=3)).isoformat()),
        Expense(salon_id=sid, description="Conta de energia", category="Energia", amount=380, date=(month_start + timedelta(days=5)).isoformat()),
        Expense(salon_id=sid, description="Internet e telefone", category="Serviços", amount=150, date=(month_start + timedelta(days=7)).isoformat()),
    ]
    await db.expenses.insert_many([e.model_dump() for e in expenses if e.date <= today])
    await db.salons.update_one({"id": sid}, {"$set": {"demo_seeded_on": today}})
