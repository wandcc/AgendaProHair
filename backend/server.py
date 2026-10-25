"""
Bootstrap module — ensures base data and superuser exist on startup.
"""
import logging
import uuid
from lib.db import supabase
from lib.auth import hash_password

logger = logging.getLogger(__name__)

DEMO_EMAIL = "demo@agendaprohair.com"
DEMO_SALON_ID = "demo-salon-id"

async def ensure_demo() -> None:
    pass

async def ensure_base_data() -> None:
    logger.info("A verificar e configurar o superusuario administrador...")
    
    admin_email = "wand_cc@hotmail.com"
    admin_password = "Wand050391@"
    admin_name = "Wanderson Admin"
    
    try:
        # Gera o hash exato utilizando o passlib/bcrypt do Python
        hashed_pwd = hash_password(admin_password)
        
        # Verifica se o utilizador já existe na tabela users
        response = supabase.table("users").select("*").eq("email", admin_email).execute()
        existing = response.data
        
        if existing:
            user_id = existing[0]["id"]
            # Atualiza a senha e o nome se já existir
            supabase.table("users").update({"password_hash": hashed_pwd, "name": admin_name}).eq("id", user_id).execute()
            logger.info(f"✅ Senha do superusuario '{admin_email}' atualizada com sucesso via backend!")
        else:
            # Se não existir, insere o novo registo gerando um UUID obrigatório para o ID
            new_user = {
                "id": str(uuid.uuid4()),
                "email": admin_email,
                "name": admin_name,
                "password_hash": hashed_pwd
            }
            supabase.table("users").insert(new_user).execute()
            logger.info(f"✅ Superusuario '{admin_email}' criado com sucesso via backend!")
            
    except Exception as e:
        logger.error(f"❌ Erro crítico ao configurar superusuario no boot: {e}")
        raise e
