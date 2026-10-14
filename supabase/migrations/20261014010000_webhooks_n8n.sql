-- Webhooks do banco para o n8n (equivalente aos "Database Webhooks" do painel).
-- O payload segue o formato dos webhooks do Supabase: { type, table, schema, record, old_record }.

create extension if not exists pg_net with schema extensions;

create or replace function public.notificar_n8n()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform net.http_post(
    url := tg_argv[0],
    body := jsonb_build_object(
      'type', tg_op,
      'table', tg_table_name,
      'schema', tg_table_schema,
      'record', case when tg_op = 'DELETE' then null else to_jsonb(new) end,
      'old_record', case when tg_op = 'INSERT' then null else to_jsonb(old) end
    ),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 5000
  );
  return coalesce(new, old);
end;
$$;

revoke execute on function public.notificar_n8n() from public, anon, authenticated;

-- Atendimentos -> Google Calendar
drop trigger if exists n8n_atendimento_alterado on public.atendimentos;
create trigger n8n_atendimento_alterado
  after insert or update or delete on public.atendimentos
  for each row execute function public.notificar_n8n('https://cortecerto.app.n8n.cloud/webhook/atendimento-alterado');

-- Falta registrada -> mensagem de remarcação (só quando compareceu passa a false)
drop trigger if exists n8n_atendimento_falta on public.atendimentos;
create trigger n8n_atendimento_falta
  after update of compareceu on public.atendimentos
  for each row
  when (new.compareceu = false and old.compareceu is distinct from false)
  execute function public.notificar_n8n('https://cortecerto.app.n8n.cloud/webhook/atendimento-falta');

-- Bloqueios -> Google Calendar
drop trigger if exists n8n_sincronizar_bloqueio on public.bloqueios_agenda;
create trigger n8n_sincronizar_bloqueio
  after insert or delete on public.bloqueios_agenda
  for each row execute function public.notificar_n8n('https://cortecerto.app.n8n.cloud/webhook/sincronizar-bloqueio');
