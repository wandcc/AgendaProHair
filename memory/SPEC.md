# AgendaPROHair — SPEC

SaaS multi-tenant de agendamento e gestão para salões/barbearias/estética (pt-BR, R$).
Stack: FastAPI + MongoDB (backend/), React 19 + Vite + Tailwind v4 + shadcn (frontend/).

## Níveis de acesso
- **Super Admin** (`users.platform_role="superadmin"`) → `/admin` (métricas, assinantes, planos). API `/api/admin/*`.
- **Salão** (`users.salon_id` + `salon_role` owner|staff) → `/app`. API `/api/salon/*`, todas as queries filtradas por `salon_id` do principal. Salão `suspenso` → 403 em login e API. Apenas `owner` altera configurações / paga comissões.
- **Público** → `/agendar/:slug`, API `/api/public/salons/{slug}` (+ `/availability`, `/book`). Salão suspenso → 404.
- Sessão: cookie httpOnly `aph_session` (coleção `sessions`), `GET /api/auth/me`.

## Dados
plans, salons(slug único, status ativo|suspenso|inadimplente, open/close_time, work_days 0=Dom, slot_interval), users, services, professionals(commission_pct), appointments(status confirmado|finalizado|cancelado|ausente, source online|interno, commission_paid), expenses.

## Seed (startup, idempotente — lib/bootstrap.py)
- Super admin: from env SUPERADMIN_EMAIL + SUPERADMIN_PASSWORD_HASH (pbkdf2 `salt$hex`), currently wand_cc@hotmail.com. Old default admin@agendaprohair.com is deleted on startup.
- Demo salon is READ-ONLY: `require_salon` rejects every non-GET request for `is_demo` salons (403 "Modo demonstração…"); frontend hides all write controls via `useReadOnly()` (also hides WhatsApp buttons, since demo phones are fake).
- Planos: Básico R$49 (2 prof.), Pro R$89 (10 prof.)
- Salão demo "Salão Exemplo" slug `salao-exemplo` (is_demo, plano Pro, Seg–Sáb 09–19h) com 7 serviços, 3 profissionais, agendamentos −28..+6 dias e 4 despesas; regenerado 1x/dia (e no botão "Ver demonstração", `POST /api/auth/demo`). Excluído do MRR.
- Nenhum outro dado simulado: salões criados pelo admin começam vazios.

## Regras
- Disponibilidade: horários a cada slot_interval dentro do funcionamento, sem sobreposição com confirmado/finalizado do profissional; "qualquer" escolhe o primeiro livre. Hoje usa fuso America/Sao_Paulo.
- Financeiro: receita = finalizados; comissão = preço × % do profissional; lucro = receita − comissões − despesas.
- Limite de profissionais pelo plano (403 ao exceder).
- WhatsApp: links wa.me (click-to-chat) — confirmação/lembrete ao cliente na agenda, confirmação do cliente ao salão após agendar, compartilhar link. Nada é enviado automaticamente.
