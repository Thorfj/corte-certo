-- Status do cliente conforme os atendimentos dele:
--   - tem atendimento marcado daqui pra frente  -> 'agendado'
--   - o último atendimento já passou            -> 'follow-up' (mesma conta do
--     Agendador: recorrência do serviço x prazo do 1º ciclo de follow-up)
-- 'falar_com_humano' nunca é mexido. Usado pelo CRM ao salvar um atendimento
-- (inclusive lançado com data passada) e de 15 em 15 min pelo pg_cron.

create or replace function public.recalcular_status_cliente(p_cliente bigint)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  c record;
  v_agora timestamp := (now() at time zone 'America/Sao_Paulo');
  v_ultimo record;
  v_recorrencia int;
  v_prazo numeric;
begin
  select id, barbearia_id, status into c from public.clientes where id = p_cliente;
  if c.id is null then return null; end if;

  -- chamado pelo CRM (tem usuário logado): só clientes da própria barbearia.
  -- Dentro de security definer o current_user é o dono, por isso usa auth.uid().
  if auth.uid() is not null
     and c.barbearia_id is distinct from public.current_barbearia_id() then
    raise exception 'Cliente de outra barbearia' using errcode = '42501';
  end if;

  if c.status = 'falar_com_humano' then return c.status; end if;

  if exists (
    select 1 from public.atendimentos a
    where a.id_cliente = c.id and (a.data_agend + a.horario) > v_agora
  ) then
    update public.clientes
    set status = 'agendado',
        data_ult_agend = (select max(a.data_agend) from public.atendimentos a where a.id_cliente = c.id)
    where id = c.id and (status is distinct from 'agendado'
      or data_ult_agend is distinct from (select max(a.data_agend) from public.atendimentos a where a.id_cliente = c.id));
    return 'agendado';
  end if;

  -- último atendimento que já aconteceu (falta não conta)
  select a.id, a.data_agend into v_ultimo
  from public.atendimentos a
  where a.id_cliente = c.id and (a.data_agend + a.horario) <= v_agora and a.compareceu is not false
  order by a.data_agend desc, a.horario desc
  limit 1;

  if v_ultimo.id is null then return c.status; end if;

  -- já está em follow-up/perdido por um atendimento igual ou mais novo: não reinicia o ciclo
  if c.status in ('follow-up', 'perdido') and exists (
    select 1 from public.clientes x where x.id = c.id and x.data_ult_agend >= v_ultimo.data_agend
  ) then
    return c.status;
  end if;

  select coalesce(min(s.recorrencia), 30) into v_recorrencia
  from public.atendimento_servicos ats join public.servicos s on s.id = ats.servico_id
  where ats.id_atend = v_ultimo.id and s.recorrencia is not null;

  select p.prazo_flu into v_prazo
  from public.prazos_followup p
  where p.barbearia_id = c.barbearia_id
    and nullif(regexp_replace(p.id_msg, '\D', '', 'g'), '')::int = 1
  limit 1;

  update public.clientes
  set status = 'follow-up',
      data_ult_agend = v_ultimo.data_agend,
      ciclo_followup_atual = 0,
      recorrencia_followup = v_recorrencia,
      data_proximo_followup = v_ultimo.data_agend + round(coalesce(v_prazo, 1) * v_recorrencia)::int
  where id = c.id;

  return 'follow-up';
end;
$function$;

revoke all on function public.recalcular_status_cliente(bigint) from public, anon;
grant execute on function public.recalcular_status_cliente(bigint) to authenticated;

-- Passa pra follow-up quem ficou 'agendado' com o horário já vencido
create or replace function public.processar_atendimentos_passados()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r record;
  n int := 0;
begin
  for r in
    select c.id from public.clientes c
    where c.status = 'agendado'
      and exists (select 1 from public.atendimentos a where a.id_cliente = c.id)
      and not exists (
        select 1 from public.atendimentos a
        where a.id_cliente = c.id
          and (a.data_agend + a.horario) > (now() at time zone 'America/Sao_Paulo')
      )
  loop
    if public.recalcular_status_cliente(r.id) = 'follow-up' then n := n + 1; end if;
  end loop;
  return n;
end;
$function$;

revoke all on function public.processar_atendimentos_passados() from public, anon, authenticated;

select cron.schedule(
  'processar-atendimentos-passados',
  '*/15 * * * *',
  $$select public.processar_atendimentos_passados()$$
);
