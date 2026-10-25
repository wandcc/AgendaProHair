"""
Bootstrap module — ensures base data and superuser exist on startup.
"""
import logging
from lib.db import supabase
from lib.auth import hash_password

logger = logging.getLogger(__name__)

DEMO_EMAIL = "demo@agendaprohair.com"
DEMO_SALON_ID = "demo-salon-id"

async def ensure_demo() -> None:
    pass

async def ensure_base_data() -> None:
    logger.info("A garantir criacao do superusuario no Supabase...")
    
    admin_email = "wand_cc@hotmail.com"
    admin_password = "Wand050391@"
    admin_name = "Wanderson Admin"
    
    try:
        # Gera o hash real e seguro utilizando o bcrypt do projeto
        hashed_pwd = hash_password(admin_password)
        
        # Verifica se o utilizador já existe
        response = supabase.table("users").select("*").eq("email", admin_email).execute()
        existing = response.data
        
        if existing:
            # Atualiza a senha correta
            user_id = existing[0]["id"]
            supabase.table("users").update({"password_hash": hashed_pwd}).eq("id", user_id).execute()
            logger.info("Senha do superusuario atualizada com sucesso via boot!")
        else:
            # Insere o novo superusuario com ID gerado automaticamente ou tratado pela DB
            new_user = {
                "email": admin_email,
                "name": admin_name,
                "password_hash": hashed_pwd
            }
            supabase.table("users").insert(new_user).execute()
            logger.info("Superusuario criado com sucesso via boot!")
            
    except Exception as e:
        logger.error(f"Erro ao configurar superusuario: {e}")
