"""Super Admin (platform scope) routes: metrics, subscribers, plans, salon access users."""

import uuid

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import hash_password, require_superadmin
from lib.db import supabase
from models.schemas import (
    AdminMetrics, Plan, PlanBreakdown, PlanIn, Salon, SalonAdminRow, SalonAdminUpdateIn, SalonCreateIn,
    SalonPatchIn, SalonUserIn, SalonUserOut,
)

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_superadmin)])


async def _plans_map() -> dict[str, dict]:
    res = supabase.table("plans").select("*").execute()
    return {p["id"]: p for p in (res.data or [])}


async def _salon_or_404(salon_id: str) -> dict:
    res = supabase.table("salons").select("*").eq("id", salon_id).execute()
    s = res.data[0] if res.data else None
    if not s:
        raise HTTPException(404, "Salão não encontrado")
    return s


@router.get("/metrics", response_model=AdminMetrics)
async def metrics():
    plans = await _plans_map()
    
    res_salons = supabase.table("salons").select("*").execute()
    all_salons = res_salons.data or []
    
    salons = [s for s in all_salons if not s.get("is_demo")]
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
            
    # Contar profissionais ativos nos salões
    total_pros = 0
    total_users = 0
    if ids:
        res_pros = supabase.table("professionals").select("id", count="exact").in_("salon_id", ids).eq("active", True).execute()
        total_pros = len(res_pros.data or [])
        
        res_users = supabase.table("users").select("id", count="exact").in_("salon_id", ids).execute()
        total_users = len(res_users.data or [])

    return AdminMetrics(
        total_salons=len(salons),
        active=sum(1 for x in salons if x["status"] == "ativo"),
        suspended=sum(1 for x in salons if x["status"] == "suspenso"),
        delinquent=sum(1 for x in salons if x["status"] == "inadimplente"),
        total_professionals=total_pros,
        total_users=total_users,
        mrr=mrr,
        plans=list(breakdown.values()),
    )


@router.get("/salons", response_model=list[SalonAdminRow])
async def list_salons():
    plans = await _plans_map()
    
    res_salons = supabase.table("salons").select("*").order("created_at", desc=True).execute()
    salons = res_salons.data or []
    
    rows = []
    for s in salons:
        s.pop("demo_seeded_on", None)
        plan = plans.get(s["plan_id"], {"name": "—", "price": 0})
        
        res_owner = supabase.table("users").select("*").eq("salon_id", s["id"]).eq("salon_role", "owner").execute()
        owner = res_owner.data[0] if res_owner.data else None
        
        res_pros_count = supabase.table("professionals").select("id", count="exact").eq("salon_id", s["id"]).execute()
        pros_count = len(res_pros_count.data or [])
        
        res_users_count = supabase.table("users").select("id", count="exact").eq("salon_id", s["id"]).execute()
        users_count = len(res_users_count.data or [])
        
        rows.append(SalonAdminRow(
            **s, plan_name=plan["name"], plan_price=plan["price"],
            owner_name=owner["name"] if owner else "",
            owner_email=owner["email"] if owner else "",
            professionals_count=pros_count,
            users_count=users_count,
        ))
    return rows


@router.post("/salons", response_model=Salon, status_code=201)
async def create_salon(body: SalonCreateIn):
    res_plan = supabase.table("plans").select("*").eq("id", body.plan_id).execute()
    if not res_plan.data:
        raise HTTPException(422, "Plano inválido")
        
    res_slug = supabase.table("salons").select("id").eq("slug", body.slug).execute()
    if res_slug.data:
        raise HTTPException(409, "Este link (slug) já está em uso")
        
    email = body.owner_email.strip().lower()
    res_email = supabase.table("users").select("id").eq("email", email).execute()
    if res_email.data:
        raise HTTPException(409, "Já existe um usuário com este e-mail")
        
    salon = Salon(name=body.name, slug=body.slug, phone=body.phone, plan_id=body.plan_id)
    supabase.table("salons").insert(salon.model_dump()).execute()
    
    supabase.table("users").insert({
        "id": f"u-{salon.id}", "email": email, "name": body.owner_name,
        "password_hash": hash_password(body.owner_password), "platform_role": None,
        "salon_id": salon.id, "salon_role": "owner",
    }).execute()
    
    return salon


@router.patch("/salons/{salon_id}", response_model=Salon)
async def patch_salon(salon_id: str, body: SalonPatchIn):
    await _salon_or_404(salon_id)
    update = body.model_dump(exclude_none=True)
    
    if "plan_id" in update:
        res_plan = supabase.table("plans").select("id").eq("id", update["plan_id"]).execute()
        if not res_plan.data:
            raise HTTPException(422, "Plano inválido")
            
    if update:
        supabase.table("salons").update(update).eq("id", salon_id).execute()
        
    s = await _salon_or_404(salon_id)
    s.pop("demo_seeded_on", None)
    return Salon(**s)


@router.put("/salons/{salon_id}", response_model=Salon)
async def update_salon(salon_id: str, body: SalonAdminUpdateIn):
    s = await _salon_or_404(salon_id)
    if s.get("is_demo"):
        raise HTTPException(409, "O salão de demonstração não pode ser editado")
        
    res_plan = supabase.table("plans").select("id").eq("id", body.plan_id).execute()
    if not res_plan.data:
        raise HTTPException(422, "Plano inválido")
        
    res_slug_check = supabase.table("salons").select("id").eq("slug", body.slug).neq("id", salon_id).execute()
    if res_slug_check.data:
        raise HTTPException(409, "Este link (slug) já está em uso")
        
    res_owner = supabase.table("users").select("*").eq("salon_id", salon_id).eq("salon_role", "owner").execute()
    owner = res_owner.data[0] if res_owner.data else None
    
    email = body.owner_email.strip().lower()
    res_clash = supabase.table("users").select("*").eq("email", email).execute()
    clash = res_clash.data[0] if res_clash.data else None
    
    if clash and (not owner or clash["id"] != owner["id"]):
        raise HTTPException(409, "Já existe um usuário com este e-mail")
        
    supabase.table("salons").update({
        "name": body.name, "slug": body.slug, "phone": "".join(c for c in body.phone if c.isdigit()),
        "address": body.address, "plan_id": body.plan_id, "status": body.status,
    }).eq("id", salon_id).execute()
    
    owner_set = {"name": body.owner_name, "email": email}
    if body.owner_password:
        owner_set["password_hash"] = hash_password(body.owner_password)
        
    if owner:
        supabase.table("users").update(owner_set).eq("id", owner["id"]).execute()
        if body.owner_password:
            supabase.table("sessions").delete().eq("user_id", owner["id"]).execute()
    else:
        if not body.owner_password:
            raise HTTPException(422, "Defina uma senha para criar o acesso do proprietário")
        supabase.table("users").insert({
            "id": str(uuid.uuid4()), "platform_role": None, "salon_id": salon_id,
            "salon_role": "owner", **owner_set
        }).execute()
        
    res_updated_salon = supabase.table("salons").select("*").eq("id", salon_id).execute()
    updated_salon = res_updated_salon.data[0] if res_updated_salon.data else {}
    updated_salon.pop("demo_seeded_on", None)
    return Salon(**updated_salon)


@router.get("/salons/{salon_id}/users", response_model=list[SalonUserOut])
async def salon_users(salon_id: str):
    await _salon_or_404(salon_id)
    res = supabase.table("users").select("*").eq("salon_id", salon_id).execute()
    return [SalonUserOut(**u) for u in (res.data or [])]


@router.post("/salons/{salon_id}/users", response_model=SalonUserOut, status_code=201)
async def create_salon_user(salon_id: str, body: SalonUserIn):
    await _salon_or_404(salon_id)
    email = body.email.strip().lower()
    
    res_email = supabase.table("users").select("id").eq("email", email).execute()
    if res_email.data:
        raise HTTPException(409, "Já existe um usuário com este e-mail")
        
    doc = {
        "id": str(uuid.uuid4()), "email": email, "name": body.name,
        "password_hash": hash_password(body.password), "platform_role": None,
        "salon_id": salon_id, "salon_role": body.salon_role
    }
    supabase.table("users").insert(doc).execute()
    return SalonUserOut(**doc)


@router.delete("/salons/{salon_id}/users/{user_id}")
async def delete_salon_user(salon_id: str, user_id: str):
    res = supabase.table("users").delete().eq("id", user_id).eq("salon_id", salon_id).execute()
    if not res.data:
        raise HTTPException(404, "Usuário não encontrado")
    supabase.table("sessions").delete().eq("user_id", user_id).execute()
    return {"ok": True}


@router.get("/plans", response_model=list[Plan])
async def list_plans():
    res = supabase.table("plans").select("*").order("price", desc=False).execute()
    return [Plan(**p) for p in (res.data or [])]


@router.post("/plans", response_model=Plan, status_code=201)
async def create_plan(body: PlanIn):
    plan = Plan(**body.model_dump())
    supabase.table("plans").insert(plan.model_dump()).execute()
    return plan


@router.put("/plans/{plan_id}", response_model=Plan)
async def update_plan(plan_id: str, body: PlanIn):
    res = supabase.table("plans").update(body.model_dump()).eq("id", plan_id).execute()
    if not res.data:
        raise HTTPException(404, "Plano não encontrado")
    return Plan(id=plan_id, **body.model_dump())


@router.delete("/plans/{plan_id}")
async def delete_plan(plan_id: str):
    res_salons_count = supabase.table("salons").select("id", count="exact").eq("plan_id", plan_id).execute()
    if len(res_salons_count.data or []) > 0:
        raise HTTPException(409, "Existem salões neste plano. Troque o plano deles antes de excluir.")
        
    res = supabase.table("plans").delete().eq("id", plan_id).execute()
    if not res.data:
        raise HTTPException(404, "Plano não encontrado")
    return {"ok": True}
