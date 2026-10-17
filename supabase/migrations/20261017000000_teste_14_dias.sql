-- Teste grátis: 14 dias de teste + 7 dias de carência (antes: 5 + 30).
-- Também desliga o bot dos testes vencidos de hora em hora, mesmo que o
-- admin nunca mais abra o CRM (antes só desligava quando alguém entrava).

create or replace function public.status_teste()
returns table(fase text, trial_termina_em timestamptz, acesso_expira_em timestamptz, dias_restantes integer)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  b record;
  v_trial_fim timestamptz;
  v_acesso_fim timestamptz;
begin
  select id, cliente, config_concluida, trial_iniciado_em
  into b
  from public.barbearias
  where id = public.auth_barbearia_id();

  if b.cliente then
    return query select 'assinante'::text, null::timestamptz, null::timestamptz, null::int;
    return;
  end if;

  if not b.config_concluida or b.trial_iniciado_em is null then
    return query select 'configurando'::text, null::timestamptz, null::timestamptz, null::int;
    return;
  end if;

  v_trial_fim := b.trial_iniciado_em + interval '14 days';
  v_acesso_fim := v_trial_fim + interval '7 days';

  if now() < v_trial_fim then
    return query select
      'teste_ativo'::text,
      v_trial_fim,
      v_acesso_fim,
      ceil(extract(epoch from (v_trial_fim - now())) / 86400)::int;
    return;
  end if;

  if now() < v_acesso_fim then
    return query select
      'grace'::text,
      v_trial_fim,
      v_acesso_fim,
      ceil(extract(epoch from (v_acesso_fim - now())) / 86400)::int;
    return;
  end if;

  return query select 'bloqueado'::text, v_trial_fim, v_acesso_fim, 0;
end;
$function$;

-- Desliga o fluxo de todas as barbearias com teste vencido e sem assinatura
create or replace function public.desligar_fluxo_testes_vencidos()
returns integer
language sql
security definer
set search_path to 'public'
as $function$
  with alteradas as (
    update public.barbearias
    set status_fluxo = 'Não'
    where not coalesce(cliente, false)
      and trial_iniciado_em is not null
      and trial_iniciado_em + interval '14 days' <= now()
      and status_fluxo is distinct from 'Não'
    returning 1
  )
  select count(*)::int from alteradas;
$function$;

revoke all on function public.desligar_fluxo_testes_vencidos() from public, anon, authenticated;

create extension if not exists pg_cron;

select cron.schedule(
  'desligar-fluxo-testes-vencidos',
  '7 * * * *',
  $$select public.desligar_fluxo_testes_vencidos()$$
);
