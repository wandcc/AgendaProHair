import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# Configuração de Logs
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Importações internas do projeto
from lib.db import supabase, ensure_indexes
from lib.auth import hash_password

def auto_fix_admin():
    """Garante que o superadmin existe e tem o hash e permissões corretos no arranque"""
    try:
        admin_email = "wand_cc@hotmail.com"
        admin_pass = "Wand050391@"
        
        logger.info("🔄 Verificando e corrigindo superadmin na inicialização...")
        
        # Gerar o hash seguro compatível com a lib/auth.py
        new_hash = hash_password(admin_pass)
        
        res = supabase.table("users").select("id").eq("email", admin_email).execute()
        
        if res.data:
            user_id = res.data[0]["id"]
            supabase.table("users").update({
                "password_hash": new_hash,
                "platform_role": "superadmin",
                "name": "Wanderson Admin"
            }).eq("id", user_id).execute()
            logger.info("✅ Superadmin atualizado com sucesso no arranque!")
        else:
            supabase.table("users").insert({
                "email": admin_email,
                "name": "Wanderson Admin",
                "password_hash": new_hash,
                "platform_role": "superadmin"
            }).execute()
            logger.info("✅ Superadmin criado com sucesso no arranque!")
    except Exception as e:
        logger.error(f"❌ Erro ao auto-corrigir admin: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Executado ao iniciar a aplicação
    logger.info("🚀 A iniciar o servidor AgendaPROHair...")
    await ensure_indexes()
    auto_fix_admin()
    yield
    # Executado ao encerrar (se necessário)
    logger.info("🛑 A encerrar o servidor...")

app = FastAPI(
    title="AgendaPROHair API",
    version="1.0.0",
    lifespan=lifespan
)

# Configuração de CORS
origins = os.environ.get("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "online", "service": "AgendaPROHair Backend"}

# Importação dos routers da aplicação
try:
    from routers import auth, salons, appointments, clients, services
    app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
    app.include_router(salons.router, prefix="/api/salons", tags=["Salons"])
    app.include_router(appointments.router, prefix="/api/appointments", tags=["Appointments"])
    app.include_router(clients.router, prefix="/api/clients", tags=["Clients"])
    app.include_router(services.router, prefix="/api/services", tags=["Services"])
    logger.info("✅ Routers carregados com sucesso.")
except Exception as e:
    logger.error(f"❌ Erro ao carregar routers: {e}")
