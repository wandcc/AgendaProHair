import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL e SUPABASE_KEY não configuradas no .env")

# Cliente global do Supabase para o app inteiro
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Função mantida para compatibilidade com o lifespan do server.py
async def ensure_indexes():
    # No Supabase/PostgreSQL os índices são criados via SQL no painel, 
    # mas mantemos a função vazia aqui para não quebrar o lifespan.
    pass
