-- Black Friday 2026: quem criar a conta até 30/11 e deixar o bot rodando (ligado) até 15/12
-- ganha 30 dias de teste grátis em vez de 14. Os dias contam a partir de quando o bot é ligado
-- (trial_iniciado_em). Quem ligar o bot depois de 15/12 fica com os 14 dias normais, sem aviso.
-- Vale também para as contas criadas antes da campanha.

create or replace function public.dias_teste_gratis(p_criado_em timestamptz, p_trial_iniciado_em timestamptz)
returns integer
language sql
immutable
set search_path to 'public'
as $$
  select case
    when p_criado_em < timestamptz '2026-12-01 00:00:00-03'
     and p_trial_iniciado_em < timestamptz '2026-12-16 00:00:00-03'
    then 30 else 14
  end;
$$;

comment on function public.dias_teste_gratis(timestamptz, timestamptz) is
  'Black Friday 2026: conta criada até 30/11 e bot ligado até 15/12 → 30 dias de teste. Senão, 14.';

-- Status do teste no CRM (banner, bloqueio)
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
  select id, cliente, config_concluida, trial_iniciado_em, criado_em
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

  v_trial_fim := b.trial_iniciado_em + make_interval(days => public.dias_teste_gratis(b.criado_em, b.trial_iniciado_em));
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

-- Desliga o bot de quem passou do teste
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
      and trial_iniciado_em + make_interval(days => public.dias_teste_gratis(criado_em, trial_iniciado_em)) <= now()
      and status_fluxo is distinct from 'Não'
    returning 1
  )
  select count(*)::int from alteradas;
$function$;

-- Aviso da Black Friday no CRM: conta elegível que ainda não ligou o bot
create or replace function public.promo_black_friday()
returns table(elegivel boolean, ligar_ate date, dias integer)
language sql
stable security definer
set search_path to 'public'
as $function$
  select
    not coalesce(b.cliente, false)
      and b.criado_em < timestamptz '2026-12-01 00:00:00-03'
      and b.trial_iniciado_em is null
      and now() < timestamptz '2026-12-16 00:00:00-03',
    date '2026-12-15',
    30
  from public.barbearias b
  where b.id = public.auth_barbearia_id();
$function$;

revoke all on function public.promo_black_friday() from public, anon;
grant execute on function public.promo_black_friday() to authenticated, service_role;

-- Assistente de IA do CRM: datas do teste com a regra nova
create or replace function public.assistente_info(p_barbearia_id bigint)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'empresa', b.empresa,
    'bot_ligado', b.status_fluxo = 'Sim',
    'assinatura', case when b.cliente then 'ativa' else b.status_assinatura end,
    'teste_gratis', case when b.trial_iniciado_em is not null and not coalesce(b.cliente, false) then jsonb_build_object(
      'dias', public.dias_teste_gratis(b.criado_em, b.trial_iniciado_em),
      'termina_em', (b.trial_iniciado_em + make_interval(days => public.dias_teste_gratis(b.criado_em, b.trial_iniciado_em)))::date,
      'carencia_ate', (b.trial_iniciado_em + make_interval(days => public.dias_teste_gratis(b.criado_em, b.trial_iniciado_em) + 7))::date) end,
    'black_friday', case when b.trial_iniciado_em is null and not coalesce(b.cliente, false)
                          and b.criado_em < timestamptz '2026-12-01 00:00:00-03'
                          and now() < timestamptz '2026-12-16 00:00:00-03'
                     then 'Conta criada na Black Friday: se ligar o bot até 15/12, ganha 30 dias de teste grátis (em vez de 14).' end,
    'horario_funcionamento', b.horario_funcionamento,
    'landing_page', case when b.landing_publicada and b.slug is not null
                         then 'barbozap.com.br/b/' || b.slug end,
    'servicos', coalesce((
      select jsonb_agg(jsonb_build_object('nome', s.nome, 'preco', s.preco, 'duracao_min', s.duracao_min) order by s.nome)
      from servicos s where s.barbearia_id = b.id
    ), '[]'::jsonb),
    'profissionais', coalesce((
      select jsonb_agg(jsonb_build_object('nome', p.nome, 'acesso', p.acesso, 'atende_clientes', p.atende_clientes) order by p.nome)
      from profissionais p where p.barbearia_id = b.id and p.removido_em is null
    ), '[]'::jsonb)
  )
  from barbearias b
  where b.id = p_barbearia_id;
$function$;
