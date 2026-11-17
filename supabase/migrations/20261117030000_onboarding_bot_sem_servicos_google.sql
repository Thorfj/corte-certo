-- Correções do onboarding (caso Barbearia Matriz, 17/11):
-- 1) Google conectado sem a permissão da agenda: novo status 'sem_permissao' (o CRM pede para conectar de novo).
-- 2) Bot sem serviços cadastrados: guarda quando o dono foi avisado, para não avisar a cada mensagem.

alter table public.barbearias drop constraint if exists barbearias_google_status_check;
alter table public.barbearias
  add constraint barbearias_google_status_check
  check (google_calendar_status = any (array['conectado', 'desconectado', 'sem_permissao']));

alter table public.barbearias
  add column if not exists aviso_sem_servicos_em timestamptz;

comment on column public.barbearias.aviso_sem_servicos_em is
  'Última vez que o dono foi avisado de que um cliente chamou no WhatsApp e a barbearia ainda não tem serviços cadastrados (no máximo 1 aviso a cada 6 h).';

-- Barbearia Matriz: autorizou o Google sem marcar a permissão da agenda
update public.barbearias set google_calendar_status = 'sem_permissao' where id = 16 and google_calendar_status = 'conectado';

-- Barbearia Matriz: o teste gravou "Oi" como nome do cliente; limpa para o bot perguntar de novo
update public.clientes set nome = null where barbearia_id = 16 and nome = 'Oi';
update public.sessoes set etapa_atual = '00101', aguardando_resposta = false where barbearia_id = 16;
