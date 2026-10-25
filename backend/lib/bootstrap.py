"""
Bootstrap module — ensures base data, default entries, and superuser exist on startup.
"""
import logging
from lib.db import supabase
from lib.auth import hash_password

logger = logging.getLogger(__name__)

async def ensure_base_data() -> None:
    """
    Executado no arranque da aplicação para garantir que dados iniciais 
    e o superusuário administrador existam no Supabase.
    """
    logger.info("A verificar dados iniciais e superusuário no Supabase...")
    
    admin_email = "wand_cc@hotmail.com"
    admin_password = "Wand050391@"
    admin_name = "Wanderson Admin"
    
    try:
        # Gera o hash seguro da senha
        hashed_pwd = hash_password(admin_password)
        
        # Verifica se o superusuário já existe
        response = supabase.table("users").select("*").eq("email", admin_email).execute()
        existing_users = response.data
        
        if existing_users:
            # Atualiza credenciais/permissões se já existir
            user_id = existing_users[0]["id"]
            update_data = {
                "password_hash": hashed_pwd,
                "role": "admin",
                "is_active": True,
                "is_admin": True
            }
            supabase.table("users").update(update_data).eq("id", user_id).execute()
            logger.info(f"Superusuário '{admin_email}' atualizado com sucesso como Admin.")
        else:
            # Cria o superusuário caso não exista
            new_user = {
                "email": admin_email,
                "name": admin_name,
                "password_hash": hashed_pwd,
                "role": "admin",
                "is_active": True,
                "is_admin": True
            }
            res = supabase.table("users").insert(new_user).execute()
            if res.data:
                logger.info(f"Superusuário '{admin_email}' criado com sucesso no boot!")
            else:
                logger.error("Falha ao inserir o superusuário no banco de dados.")
                
    except Exception as e:
        logger.error(f"Erro ao configurar superusuário no boot: {e}")
