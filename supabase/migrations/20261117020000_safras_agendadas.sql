-- Safras agendadas: a Central escolhe data e hora; no horário o n8n começa sozinho.
-- Os leads ficam reservados (leads.safra_agendada_id) e não entram em outra safra.
-- A fila de safras passa a ser pela hora em que cada uma entrou na fila (fila_em), não pelo id:
-- uma safra agendada há dias (id menor) que acorda agora espera a que já está enviando.

alter table public.safras_prospeccao
  add column if not exists agendada_para timestamptz,
  add column if not exists fila_em timestamptz;

update public.safras_prospeccao set fila_em = criado_em where fila_em is null and status <> 'previa';

alter table public.safras_prospeccao drop constraint if exists safras_prospeccao_status_check;
alter table public.safras_prospeccao
  add constraint safras_prospeccao_status_check
  check (status in ('previa', 'agendada', 'na_fila', 'enviando', 'concluida', 'cancelada', 'nao_enviada'));

create index if not exists safras_prospeccao_agendada_idx
  on public.safras_prospeccao (agendada_para) where status = 'agendada';

alter table public.leads
  add column if not exists safra_agendada_id bigint references public.safras_prospeccao (id) on delete set null;
create index if not exists leads_safra_agendada_idx on public.leads (safra_agendada_id) where safra_agendada_id is not null;

comment on column public.leads.safra_agendada_id is
  'Safra agendada que reservou este lead. Enquanto estiver preenchido, o lead não entra em outra safra.';

-- devolve os leads de uma safra agendada (próximo passo original volta)
create or replace function public.safra_liberar_leads(p_safra_id bigint)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  n integer;
begin
  with orig as (
    select (x->>'id')::uuid as id, x->>'proximo_original' as proximo, nullif(x->>'data_original', '')::date as data
    from public.safras_prospeccao s, jsonb_array_elements(coalesce(s.formulario->'reservas', '[]'::jsonb)) x
    where s.id = p_safra_id
  ), u as (
    update public.leads l
    set safra_agendada_id = null,
        proximo_passo = o.proximo,
        data_proximo_passo = o.data
    from orig o
    where l.id = o.id and l.safra_agendada_id = p_safra_id
    returning 1
  )
  select count(*) into n from u;
  -- quem ficou sem registro de origem também é liberado
  update public.leads set safra_agendada_id = null where safra_agendada_id = p_safra_id;
  return n;
end;
$$;

-- Central: cancelar uma safra agendada (só equipe interna, só antes de começar)
create or replace function public.cancelar_safra_agendada(p_safra_id bigint)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not exists (select 1 from public.equipe_interna e where e.auth_user_id = auth.uid()) then
    raise exception 'Só a equipe interna pode cancelar safras.';
  end if;
  update public.safras_prospeccao
  set status = 'cancelada', finalizada_em = now()
  where id = p_safra_id and status = 'agendada';
  if not found then
    raise exception 'Essa safra não está mais agendada (já começou ou foi cancelada).';
  end if;
  perform public.safra_liberar_leads(p_safra_id);
  return 'cancelada';
end;
$$;

-- n8n: existe safra na frente desta? (enviando ou na fila, entrou antes na fila, nas últimas 12 h)
create or replace function public.safra_tem_frente(p_safra_id bigint)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.safras_prospeccao eu, public.safras_prospeccao o
    where eu.id = p_safra_id
      and o.id <> eu.id
      and o.status in ('enviando', 'na_fila')
      and o.fila_em > now() - interval '12 hours'
      and (o.fila_em < eu.fila_em or (o.fila_em = eu.fila_em and o.id < eu.id))
  );
$$;

revoke all on function public.safra_liberar_leads(bigint) from public, anon, authenticated;
revoke all on function public.safra_tem_frente(bigint) from public, anon, authenticated;
revoke all on function public.cancelar_safra_agendada(bigint) from public, anon;
grant execute on function public.safra_liberar_leads(bigint) to service_role;
grant execute on function public.safra_tem_frente(bigint) to service_role;
grant execute on function public.cancelar_safra_agendada(bigint) to authenticated;
