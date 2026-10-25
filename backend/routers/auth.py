from fastapi import APIRouter, Depends, HTTPException, Request, Response

from lib.auth import Principal, create_session, current_principal, destroy_session, verify_password
from lib.bootstrap import DEMO_EMAIL, ensure_demo
from lib.db import supabase
from models.schemas import LoginIn, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


def to_user_out(p: Principal) -> UserOut:
    u, s = p.user, p.salon
    return UserOut(
        id=u["id"], email=u["email"], name=u["name"], platform_role=u.get("platform_role"),
        salon_id=u.get("salon_id"), salon_role=u.get("salon_role"),
        salon_name=s["name"] if s else None, salon_slug=s["slug"] if s else None,
        salon_status=s["status"] if s else None, is_demo=bool(s and s.get("is_demo")),
    )


@router.post("/login", response_model=UserOut)
async def login(body: LoginIn, response: Response):
    email_clean = body.email.strip().lower()
    
    # Buscar usuário no Supabase
    res_user = supabase.table("users").select("*").eq("email", email_clean).execute()
    user = res_user.data[0] if res_user.data else None
    
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "E-mail ou senha inválidos")
        
    salon = None
    if user.get("salon_id"):
        res_salon = supabase.table("salons").select("*").eq("id", user["salon_id"]).execute()
        salon = res_salon.data[0] if res_salon.data else None
        
    if salon and salon.get("status") == "suspenso":
        raise HTTPException(403, "Assinatura suspensa. Entre em contato com o suporte AgendaPROHair.")
        
    await create_session(response, user["id"])
    return to_user_out(Principal(user=user, salon=salon))


@router.post("/demo", response_model=UserOut)
async def demo_login(response: Response):
    await ensure_demo()
    
    res_user = supabase.table("users").select("*").eq("email", DEMO_EMAIL).execute()
    user = res_user.data[0] if res_user.data else None
    
    if not user:
        raise HTTPException(500, "Demonstração indisponível")
        
    salon = None
    if user.get("salon_id"):
        res_salon = supabase.table("salons").select("*").eq("id", user["salon_id"]).execute()
        salon = res_salon.data[0] if res_salon.data else None
        
    await create_session(response, user["id"])
    return to_user_out(Principal(user=user, salon=salon))


@router.post("/logout")
async def logout(request: Request, response: Response):
    await destroy_session(request, response)
    return {"ok": True}


@router.get("/me", response_model=UserOut)
async def me(p: Principal = Depends(current_principal)):
    return to_user_out(p)
