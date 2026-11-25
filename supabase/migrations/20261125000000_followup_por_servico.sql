-- Follow-up por serviço.
-- Antes: um conjunto de ciclos para a barbearia inteira (prazos_followup + fluxo_followup).
-- Agora: cada serviço tem os próprios ciclos (servico_id) e a própria recorrência
-- (servicos.recorrencia). O cliente segue os ciclos do serviço de menor recorrência
-- do último atendimento, guardado em clientes.servico_followup.
-- O "Encerramento do follow-up" (id_msg 101) continua único por barbearia (servico_id nulo).

alter table public.prazos_followup add column if not exists servico_id bigint references public.servicos(id) on delete cascade;
alter table public.fluxo_followup add column if not exists servico_id bigint references public.servicos(id) on delete cascade;

alter table public.prazos_followup drop constraint if exists prazos_followup_barbearia_id_id_msg_key;
alter table public.fluxo_followup drop constraint if exists fluxo_followup_barbearia_id_id_msg_key;
create unique index if not exists prazos_followup_servico_ciclo_unico
  on public.prazos_followup (barbearia_id, coalesce(servico_id, 0), id_msg);
create unique index if not exists fluxo_followup_servico_ciclo_unico
  on public.fluxo_followup (barbearia_id, coalesce(servico_id, 0), id_msg);

-- Ciclos gerais que já existiam viram ciclos de cada serviço da barbearia
insert into public.prazos_followup (barbearia_id, servico_id, id_msg, prazo_flu)
select p.barbearia_id, s.id, p.id_msg, p.prazo_flu
from public.prazos_followup p
join public.servicos s on s.barbearia_id = p.barbearia_id
where p.servico_id is null
on conflict do nothing;

insert into public.fluxo_followup (barbearia_id, servico_id, id_msg, tempo, etapa, mensagem)
select f.barbearia_id, s.id, f.id_msg, f.tempo, f.etapa, f.mensagem
from public.fluxo_followup f
join public.servicos s on s.barbearia_id = f.barbearia_id
where f.servico_id is null and f.id_msg <> '101'
on conflict do nothing;

delete from public.prazos_followup where servico_id is null;
delete from public.fluxo_followup where servico_id is null and id_msg <> '101';

-- O antigo "Adicionar ciclo" mexia em barbearias.flu e criava ciclos gerais; a tela agora
-- cria os ciclos do serviço direto, então o gatilho sai.
drop trigger if exists trg_sync_ciclos_followup on public.barbearias;

alter table public.clientes add column if not exists servico_followup bigint references public.servicos(id) on delete set null;

-- Entrada no follow-up pelo banco: escolhe o serviço de menor recorrência do último
-- atendimento e usa o prazo do ciclo 1 desse serviço.
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
  v_servico record;
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

  select a.id, a.data_agend into v_ultimo
  from public.atendimentos a
  where a.id_cliente = c.id and (a.data_agend + a.horario) <= v_agora and a.compareceu is not false
  order by a.data_agend desc, a.horario desc
  limit 1;

  if v_ultimo.id is null then return c.status; end if;

  if c.status in ('follow-up', 'perdido') and exists (
    select 1 from public.clientes x where x.id = c.id and x.data_ult_agend >= v_ultimo.data_agend
  ) then
    return c.status;
  end if;

  select s.id, s.recorrencia into v_servico
  from public.atendimento_servicos ats join public.servicos s on s.id = ats.servico_id
  where ats.id_atend = v_ultimo.id and s.recorrencia is not null
  order by s.recorrencia, s.id
  limit 1;

  select p.prazo_flu into v_prazo
  from public.prazos_followup p
  where p.barbearia_id = c.barbearia_id
    and p.servico_id = v_servico.id
    and nullif(regexp_replace(p.id_msg, '\D', '', 'g'), '')::int = 1
  limit 1;

  update public.clientes
  set status = 'follow-up',
      data_ult_agend = v_ultimo.data_agend,
      ciclo_followup_atual = 0,
      servico_followup = v_servico.id,
      recorrencia_followup = coalesce(v_servico.recorrencia, 30),
      data_proximo_followup = v_ultimo.data_agend + round(coalesce(v_prazo, 1) * coalesce(v_servico.recorrencia, 30))::int
  where id = c.id;

  return 'follow-up';
end;
$function$;
