"""Shared Supabase handle — import `supabase` from here (server.py, routers, seed.py)."""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(Path(__file__).parent.parent / ".env")

supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_KEY")

if not supabase_url or not supabase_key:
    raise ValueError("SUPABASE_URL e SUPABASE_KEY devem estar configuradas no arquivo .env")

# Cliente global do Supabase para toda a aplicação
supabase: Client = create_client(supabase_url, supabase_key)

# Apelido para manter compatibilidade com imports antigos (`from lib.db import db`)
db = supabase

logger = logging.getLogger(__name__)

async def ensure_indexes() -> None:
    """
    No Supabase (PostgreSQL), os índices e tabelas são gerenciados 
    via SQL no painel do Supabase. Mantido vazio para compatibilidade com o lifespan.
    """
    logger.info("Supabase client initialized successfully.")
