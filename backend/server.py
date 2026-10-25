import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        from lib.db import ensure_indexes
        app.state.index_task = asyncio.create_task(ensure_indexes())
    except Exception as exc:
        logger.error("Failed to start ensure_indexes: %s", exc)

    try:
        from lib.bootstrap import ensure_base_data
        await ensure_base_data()
    except Exception as exc:
        logger.error("ensure_base_data failed: %s", exc)
        
    yield

# O app é instanciado primeiro para garantir que o Uvicorn o encontre sempre
app = FastAPI(lifespan=lifespan, title="AgendaPROHair API")

api_router = APIRouter(prefix="/api")

@api_router.get("/")
async def root():
    return {"message": "AgendaPROHair API rodando com Supabase!"}

# Importação e inclusão segura dos routers
try:
    from routers import admin, auth, public, salon
    api_router.include_router(auth.router)
    api_router.include_router(admin.router)
    api_router.include_router(salon.router)
    api_router.include_router(public.router)
except Exception as exc:
    logger.error("Erro ao carregar routers: %s", exc)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
