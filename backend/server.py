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

from lib.db import client, ensure_indexes  # noqa: E402
from lib.bootstrap import ensure_base_data  # noqa: E402
from routers import admin, auth, public, salon  # noqa: E402

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.index_task = asyncio.create_task(ensure_indexes())
    try:
        await ensure_base_data()
    except Exception as exc:  # never block boot
        logger.error("ensure_base_data failed: %s", exc)
    yield
    client.close()


app = FastAPI(lifespan=lifespan, title="AgendaPROHair API")
api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"message": "AgendaPROHair API"}


api_router.include_router(auth.router)
api_router.include_router(admin.router)
api_router.include_router(salon.router)
api_router.include_router(public.router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
