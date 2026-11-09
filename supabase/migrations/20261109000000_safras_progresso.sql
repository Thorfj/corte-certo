-- Progresso das safras em andamento (Central Interna > WhatsApp > Safras).
-- O n8n registra cada lead processado em lead_atividades com "safra n8n #<id>"
-- (enviado, sem WhatsApp, já respondeu, pulado ou erro); contar esses registros
-- dá quantos leads da safra já passaram. Respeita a RLS de lead_atividades
-- (só a equipe interna enxerga).
create or replace function public.safras_progresso(p_ids bigint[])
returns table (safra_id bigint, processados integer)
language sql
stable
security invoker
set search_path to 'public'
as $$
  select s.id, count(distinct a.lead_id)::integer
  from unnest(p_ids) as s(id)
  join public.safras_prospeccao sp on sp.id = s.id
  left join public.lead_atividades a
    on a.criado_em >= sp.criado_em
   and a.descricao ~* ('safra n8n #' || s.id || '(\D|$)')
  group by s.id;
$$;

revoke all on function public.safras_progresso(bigint[]) from public, anon;
grant execute on function public.safras_progresso(bigint[]) to authenticated;
