"""
Script para criar ou atualizar um Superusuário (Admin) no Supabase.
"""
import os
import sys
from pathlib import Path

# Adiciona o diretório atual ao path para importar lib.db e lib.auth corretamente
sys.path.append(str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

from lib.db import supabase
from lib.auth import hash_password

ADMIN_EMAIL = "wand_cc@hotmail.com"
ADMIN_PASSWORD = "Wand050391@"
ADMIN_NAME = "Wanderson Admin"

def create_super_user():
    print("⏳ Conectando ao Supabase para gerar o Superusuário...")

    # Criptografa a senha usando a função do projeto (passlib/bcrypt)
    hashed_pwd = hash_password(ADMIN_PASSWORD)

    # 1. Verifica se o usuário já existe no banco
    response = supabase.table("users").select("*").eq("email", ADMIN_EMAIL).execute()
    existing_users = response.data

    if existing_users:
        print(f"⚠️ Usuário '{ADMIN_EMAIL}' já existe. Atualizando permissões para admin...")
        user_id = existing_users[0]["id"]
        
        # Atualiza a senha e garante role de superadmin / admin
        update_data = {
            "password_hash": hashed_pwd,
            "role": "admin",  # ou 'superadmin', dependendo do seu modelo de roles
            "is_active": True,
            "is_admin": True
        }
        
        supabase.table("users").update(update_data).eq("id", user_id).execute()
        print("✅ Usuário atualizado com sucesso como ADMIN!")

    else:
        print(f"➕ Criando novo usuário '{ADMIN_EMAIL}' como ADMIN...")
        
        new_user = {
            "email": ADMIN_EMAIL,
            "name": ADMIN_NAME,
            "password_hash": hashed_pwd,
            "role": "admin",
            "is_active": True,
            "is_admin": True
        }
        
        res = supabase.table("users").insert(new_user).execute()
        if res.data:
            print("✅ Superusuário criado com sucesso!")
        else:
            print("❌ Falha ao inserir usuário.")

if __name__ == "__main__":
    create_super_user()
