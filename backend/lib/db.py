import os
import logging
from supabase import create_client, Client

logger = logging.getLogger(__name__)

url: str = os.environ.get("SUPABASE_URL", "https://kvbwagsjzyzsdxskxedg.supabase.co")
# Prioriza a chave secreta (service role) para contornar bloqueios de RLS no backend
key: str = (
    os.environ.get("SUPABASE_SECRET_KEY") 
    or os.environ.get("SUPABASE_SERVICE_ROLE_KEY") 
    or os.environ.get("SUPABASE_KEY", "")
)

if not key:
    logger.error("❌ SUPABASE_SECRET_KEY não foi configurada nas variáveis de ambiente!")

supabase: Client = create_client(url, key)

async def ensure_indexes():
    # Mantido para inicialização segura
    pass
