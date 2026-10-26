import sys
import os

# Adiciona o diretório atual ao path para importar as libs do projeto
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from lib.db import supabase
from lib.auth import hash_password

ADMIN_EMAIL = "wand_cc@hotmail.com"
ADMIN_PASS = "Wand050391@"

def fix_superadmin():
    print("🔄 Iniciando correção do Superadmin no Supabase...")
    
    # 1. Gerar o hash seguro compatível com a lib/auth.py
    new_hash = hash_password(ADMIN_PASS)
    print("🔑 Novo hash gerado via Python com sucesso.")

    # 2. Verificar se o usuário existe
    res = supabase.table("users").select("*").eq("email", ADMIN_EMAIL).execute()
    
    if res.data:
        user_id = res.data[0]["id"]
        print(f"👤 Usuário encontrado (ID: {user_id}). Atualizando dados...")
        
        # Atualiza a senha e garante a permissão de superadmin/admin
        supabase.table("users").update({
            "password_hash": new_hash,
            "platform_role": "superadmin",
            "name": "Wanderson Admin"
        }).eq("id", user_id).execute()
        
        print("✅ Superadmin atualizado com sucesso!")
    else:
        print("👤 Usuário não encontrado. Criando novo Superadmin...")
        supabase.table("users").insert({
            "email": ADMIN_EMAIL,
            "name": "Wanderson Admin",
            "password_hash": new_hash,
            "platform_role": "superadmin"
        }).execute()
        
        print("✅ Superadmin criado com sucesso!")

if __name__ == "__main__":
    fix_superadmin()
