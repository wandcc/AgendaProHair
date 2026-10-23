"""Session auth (httpOnly cookie) + principal dependencies.

Principal is always re-derived from the DB on each request (user + salon), never from the client.
Scopes: platform (superadmin) and salon (owner/staff) are kept separate and never fall back.
"""

import hashlib
import hmac
import os
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, Request, Response

from lib.db import db

COOKIE = "aph_session"
SESSION_DAYS = 14


def hash_password(pw: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 200_000).hex()
    return f"{salt}${digest}"


def verify_password(pw: str, stored: str) -> bool:
    try:
        salt, digest = stored.split("$", 1)
    except ValueError:
        return False
    calc = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 200_000).hex()
    return hmac.compare_digest(calc, digest)


async def create_session(response: Response, user_id: str) -> None:
    token = secrets.token_urlsafe(32)
    await db.sessions.insert_one({
        "token": token,
        "user_id": user_id,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS),
    })
    response.set_cookie(
        COOKIE, token, httponly=True, samesite="lax",
        secure=os.environ.get("COOKIE_SECURE", "false").lower() == "true",
        max_age=SESSION_DAYS * 86400, path="/",
    )


async def destroy_session(request: Request, response: Response) -> None:
    token = request.cookies.get(COOKIE)
    if token:
        await db.sessions.delete_one({"token": token})
    response.delete_cookie(COOKIE, path="/")


@dataclass
class Principal:
    user: dict
    salon: Optional[dict]

    @property
    def salon_id(self) -> str:
        assert self.salon is not None
        return self.salon["id"]


async def current_principal(request: Request) -> Principal:
    token = request.cookies.get(COOKIE)
    if not token:
        raise HTTPException(401, "Não autenticado")
    sess = await db.sessions.find_one({"token": token})
    if not sess:
        raise HTTPException(401, "Sessão inválida")
    exp = sess["expires_at"].replace(tzinfo=timezone.utc)
    if exp < datetime.now(timezone.utc):
        await db.sessions.delete_one({"token": token})
        raise HTTPException(401, "Sessão expirada")
    user = await db.users.find_one({"id": sess["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(401, "Usuário não encontrado")
    salon = None
    if user.get("salon_id"):
        salon = await db.salons.find_one({"id": user["salon_id"]}, {"_id": 0})
    return Principal(user=user, salon=salon)


async def require_superadmin(p: Principal = Depends(current_principal)) -> Principal:
    if p.user.get("platform_role") != "superadmin":
        raise HTTPException(403, "Acesso restrito ao Super Admin")
    return p


async def require_salon(p: Principal = Depends(current_principal)) -> Principal:
    if not p.user.get("salon_role") or not p.salon:
        raise HTTPException(403, "Acesso restrito ao painel do salão")
    if p.salon.get("status") == "suspenso":
        raise HTTPException(403, "Assinatura suspensa. Entre em contato com o suporte AgendaPROHair.")
    return p


async def require_salon_owner(p: Principal = Depends(require_salon)) -> Principal:
    if p.user.get("salon_role") != "owner":
        raise HTTPException(403, "Apenas o proprietário do salão pode fazer isso")
    return p
