-- Revisão de segurança das funções do schema public.
-- No Postgres toda função nasce executável por PUBLIC, e o Supabase ainda concede
-- EXECUTE para anon/authenticated. Aqui cada função fica só com quem precisa dela.

-- 1) Só o servidor (service_role: edge function asaas-webhook, triggers).
--    Antes qualquer visitante podia recalcular o status de pagamento de todas as
--    barbearias ou inserir mensagens padrão na barbearia de outra pessoa.
revoke execute on function public.atualizar_status_pagantes() from public, anon, authenticated;
revoke execute on function public.atualizar_status_pagante() from public, anon, authenticated;
revoke execute on function public.seed_fluxo_mensagens_padrao(bigint) from public, anon, authenticated;
revoke execute on function public.trg_seed_fluxo_mensagens() from public, anon, authenticated;
grant execute on function public.atualizar_status_pagantes() to service_role;
grant execute on function public.atualizar_status_pagante() to service_role;
grant execute on function public.seed_fluxo_mensagens_padrao(bigint) to service_role;

-- 2) Só usuário logado no CRM (todas dependem de auth.uid()).
revoke execute on function public.finalizar_cadastro_barbearia(text, text, text, text, text) from public, anon;
revoke execute on function public.concluir_configuracao_teste() from public, anon;
revoke execute on function public.sincronizar_fluxo_teste() from public, anon;
revoke execute on function public.status_teste() from public, anon;
revoke execute on function public.update_meu_tema(text) from public, anon;
grant execute on function public.finalizar_cadastro_barbearia(text, text, text, text, text) to authenticated, service_role;
grant execute on function public.concluir_configuracao_teste() to authenticated, service_role;
grant execute on function public.sincronizar_fluxo_teste() to authenticated, service_role;
grant execute on function public.status_teste() to authenticated, service_role;
grant execute on function public.update_meu_tema(text) to authenticated, service_role;

-- Continuam públicas de propósito:
--   email_disponivel / whatsapp_barbearia_disponivel: usadas no cadastro do site, antes do login.
--   auth_barbearia_id, current_*, minha(s)_barbearia(s): usadas nas políticas de RLS
--   (para visitante sem login retornam null, então não expõem nada).

-- 3) search_path fixo nas SECURITY DEFINER que estavam sem (evita sequestro de objetos).
alter function public.current_acesso() set search_path = public;
alter function public.current_barbearia_id() set search_path = public;
alter function public.current_prof_id() set search_path = public;
alter function public.minhas_barbearias() set search_path = public;
alter function public.update_meu_tema(text) set search_path = public;

-- 4) Política que deixava qualquer visitante inserir linhas em barbearias.
--    O cadastro do site usa finalizar_cadastro_barbearia (SECURITY DEFINER), não precisa dela.
revoke insert, update, delete on public.barbearias from anon;
drop policy if exists "permitir cadastro publico via site" on public.barbearias;
