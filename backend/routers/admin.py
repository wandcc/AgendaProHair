"""Super Admin (platform scope) routes: metrics, subscribers, plans, salon access users."""

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import hash_password, require_superadmin
from lib.db import db
from models.schemas import (
    AdminMetrics, Plan, PlanBreakdown, PlanIn, Salon, SalonAdminRow, SalonCreateIn,
    SalonPatchIn, SalonUserIn, SalonUserOut,
)

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_superadmin)])


async def _plans_map() -> dict[str, dict]:
    return {p["id"]: p async for p in db.plans.find({}, {"_id": 0})}


async def _salon_or_404(salon_id: str) -> dict:
    s = await db.salons.find_one({"id": salon_id}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Salão não encontrado")
    return s


@router.get("/metrics", response_model=AdminMetrics)
async def metrics():
    plans = await _plans_map()
    salons = await db.salons.find({"is_demo": {"$ne": True}}, {"_id": 0}).to_list(5000)
    ids = [s["id"] for s in salons]
    breakdown: dict[str, PlanBreakdown] = {}
    mrr = 0.0
    for s in salons:
        plan = plans.get(s["plan_id"], {"name": "—", "price": 0})
        b = breakdown.setdefault(plan["name"], PlanBreakdown(plan_name=plan["name"], count=0, revenue=0))
        b.count += 1
        if s["status"] == "ativo":
            mrr += plan["price"]
            b.revenue += plan["price"]
    return AdminMetrics(
        total_salons=len(salons),
        active=sum(1 for s in salons if s["status"] == "ativo"),
        suspended=sum(1 for s in salons if s["status"] == "suspenso"),
        delinquent=sum(1 for s in salons if s["status"] == "inadimplente"),
        total_professionals=await db.professionals.count_documents({"salon_id": {"$in": ids}, "active": True}),
        total_users=await db.users.count_documents({"salon_id": {"$in": ids}}),
        mrr=mrr,
        plans=list(breakdown.values()),
    )


@router.get("/salons", response_model=list[SalonAdminRow])
async def list_salons():
    plans = await _plans_map()
    rows = []
    async for s in db.salons.find({}, {"_id": 0}).sort("created_at", -1):
        s.pop("demo_seeded_on", None)
        plan = plans.get(s["plan_id"], {"name": "—", "price": 0})
        owner = await db.users.find_one({"salon_id": s["id"], "salon_role": "owner"})
        rows.append(SalonAdminRow(
            **s, plan_name=plan["name"], plan_price=plan["price"],
            owner_email=owner["email"] if owner else "",
            professionals_count=await db.professionals.count_documents({"salon_id": s["id"]}),
            users_count=await db.users.count_documents({"salon_id": s["id"]}),
        ))
    return rows


@router.post("/salons", response_model=Salon, status_code=201)
async def create_salon(body: SalonCreateIn):
    if not await db.plans.find_one({"id": body.plan_id}):
        raise HTTPException(422, "Plano inválido")
    if await db.salons.find_one({"slug": body.slug}):
        raise HTTPException(409, "Este link (slug) já está em uso")
    email = body.owner_email.strip().lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "Já existe um usuário com este e-mail")
    salon = Salon(name=body.name, slug=body.slug, phone=body.phone, plan_id=body.plan_id)
    await db.salons.insert_one(salon.model_dump())
    await db.users.insert_one({
        "id": f"u-{salon.id}", "email": email, "name": body.owner_name,
        "password_hash": hash_password(body.owner_password), "platform_role": None,
        "salon_id": salon.id, "salon_role": "owner",
    })
    return salon


@router.patch("/salons/{salon_id}", response_model=Salon)
async def patch_salon(salon_id: str, body: SalonPatchIn):
    await _salon_or_404(salon_id)
    update = body.model_dump(exclude_none=True)
    if "plan_id" in update and not await db.plans.find_one({"id": update["plan_id"]}):
        raise HTTPException(422, "Plano inválido")
    if update:
        await db.salons.update_one({"id": salon_id}, {"$set": update})
    s = await _salon_or_404(salon_id)
    s.pop("demo_seeded_on", None)
    return Salon(**s)


@router.get("/salons/{salon_id}/users", response_model=list[SalonUserOut])
async def salon_users(salon_id: str):
    await _salon_or_404(salon_id)
    return [SalonUserOut(**u) async for u in db.users.find({"salon_id": salon_id}, {"_id": 0})]


@router.post("/salons/{salon_id}/users", response_model=SalonUserOut, status_code=201)
async def create_salon_user(salon_id: str, body: SalonUserIn):
    await _salon_or_404(salon_id)
    email = body.email.strip().lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "Já existe um usuário com este e-mail")
    import uuid
    doc = {"id": str(uuid.uuid4()), "email": email, "name": body.name,
           "password_hash": hash_password(body.password), "platform_role": None,
           "salon_id": salon_id, "salon_role": body.salon_role}
    await db.users.insert_one(doc)
    return SalonUserOut(**doc)


@router.delete("/salons/{salon_id}/users/{user_id}")
async def delete_salon_user(salon_id: str, user_id: str):
    res = await db.users.delete_one({"id": user_id, "salon_id": salon_id})
    if not res.deleted_count:
        raise HTTPException(404, "Usuário não encontrado")
    await db.sessions.delete_many({"user_id": user_id})
    return {"ok": True}


@router.get("/plans", response_model=list[Plan])
async def list_plans():
    return [Plan(**p) async for p in db.plans.find({}, {"_id": 0}).sort("price", 1)]


@router.post("/plans", response_model=Plan, status_code=201)
async def create_plan(body: PlanIn):
    plan = Plan(**body.model_dump())
    await db.plans.insert_one(plan.model_dump())
    return plan


@router.put("/plans/{plan_id}", response_model=Plan)
async def update_plan(plan_id: str, body: PlanIn):
    res = await db.plans.update_one({"id": plan_id}, {"$set": body.model_dump()})
    if not res.matched_count:
        raise HTTPException(404, "Plano não encontrado")
    return Plan(id=plan_id, **body.model_dump())


@router.delete("/plans/{plan_id}")
async def delete_plan(plan_id: str):
    if await db.salons.count_documents({"plan_id": plan_id}):
        raise HTTPException(409, "Existem salões neste plano. Troque o plano deles antes de excluir.")
    res = await db.plans.delete_one({"id": plan_id})
    if not res.deleted_count:
        raise HTTPException(404, "Plano não encontrado")
    return {"ok": True}
