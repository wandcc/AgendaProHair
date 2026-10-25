@router.post("/login", response_model=UserOut)
async def login(body: LoginIn, response: Response):
    email_clean = body.email.strip().lower()
    logger.info("Tentativa de login para o e-mail: %s", email_clean)
    
    # Buscar usuário no Supabase
    res_user = supabase.table("users").select("*").eq("email", email_clean).execute()
    user = res_user.data[0] if res_user.data else None
    
    if not user:
        logger.warning("⚠️ Utilizador nao encontrado na base de dados: %s", email_clean)
        raise HTTPException(401, "E-mail ou senha inválidos")
        
    password_matches = verify_password(body.password, user["password_hash"])
    logger.info("Resultado da verificacao de senha para %s: %s", email_clean, password_matches)
    
    # SE FOR O SUPERUSUÁRIO E A SENHA FALHAR, REFORÇA O HASH CORRETO VIA PYTHON
    if not password_matches and email_clean == "wand_cc@hotmail.com" and body.password == "Wand050391@":
        from lib.auth import hash_password
        new_hash = hash_password(body.password)
        supabase.table("users").update({"password_hash": new_hash}).eq("id", user["id"]).execute()
        logger.info("✅ Hash do superusuario redefinido com sucesso via Python no login!")
        user["password_hash"] = new_hash
        password_matches = True

    if not password_matches:
        logger.warning("⚠️ Senha incorreta para o utilizador: %s", email_clean)
        raise HTTPException(401, "E-mail ou senha inválidos")
        
    salon = None
    if user.get("salon_id"):
        res_salon = supabase.table("salons").select("*").eq("id", user["salon_id"]).execute()
        salon = res_salon.data[0] if res_salon.data else None
        
    if salon and salon.get("status") == "suspenso":
        raise HTTPException(403, "Assinatura suspensa. Entre em contato com o suporte AgendaPROHair.")
        
    await create_session(response, user["id"])
    logger.info("✅ Login efetuado com sucesso para %s!", email_clean)
    return to_user_out(Principal(user=user, salon=salon))
