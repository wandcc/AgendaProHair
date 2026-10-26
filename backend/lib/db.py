import os
import logging
from supabase import create_client, Client

logger = logging.getLogger(__name__)

url: str = os.environ.get("SUPABASE_URL", "https://kvbwagsjzyzsdxskxedg.supabase.co")
key: str = (
    os.environ.get("SUPABASE_SECRET_KEY") 
    or os.environ.get("SUPABASE_SERVICE_ROLE_KEY") 
    or os.environ.get("SUPABASE_KEY", "")
)

if not key:
    logger.error("❌ Nenhuma chave do Supabase foi encontrada nas variáveis de ambiente!")

# Instância principal do cliente Supabase
supabase: Client = create_client(url, key)

# Alias para compatibilidade caso algum módulo importe 'db' em vez de 'supabase'
db = supabase

async def ensure_indexes():
    # Função segura para índices
    pass
