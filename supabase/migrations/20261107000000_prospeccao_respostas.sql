-- Respostas que chegam no WhatsApp da prospecção, lidas e classificadas pela IA (n8n:
-- "Barbozap - Respostas da prospecção"). A aba Respostas da Central mostra as novas, com a
-- sugestão de resposta; o n8n grava (service role) e a equipe interna lê e marca como tratada.

create table if not exists public.prospeccao_respostas (
  id bigint generated always as identity primary key,
  message_id text not null unique,
  lead_id uuid references public.leads(id) on delete set null,
  telefone text not null,
  jid text,
  nome_whatsapp text,
  texto text,
  tipo text not null default 'texto',
  recebida_em timestamptz not null default now(),
  -- nova: aguardando o Thor | agrupada: mensagem seguida, coberta pela última | respondida | ignorada
  status text not null default 'nova' check (status in ('nova', 'agrupada', 'respondida', 'ignorada')),
  humano boolean,
  categoria text,
  prioridade text,
  resumo text,
  sugestao_resposta text,
  conversa text,
  classificada_em timestamptz,
  resposta_enviada text,
  tratada_em timestamptz
);

create index if not exists prospeccao_respostas_pendentes
  on public.prospeccao_respostas (status, recebida_em desc);
create index if not exists prospeccao_respostas_telefone
  on public.prospeccao_respostas (telefone, recebida_em desc);

alter table public.prospeccao_respostas enable row level security;

create policy "equipe interna le as respostas" on public.prospeccao_respostas
  for select using (exists (select 1 from public.equipe_interna e where e.auth_user_id = auth.uid()));

create policy "equipe interna trata as respostas" on public.prospeccao_respostas
  for update using (exists (select 1 from public.equipe_interna e where e.auth_user_id = auth.uid()));

-- lead pelo telefone, ignorando o 9 extra e o 55 (compara os 8 últimos dígitos)
create or replace function public.lead_por_telefone(p_telefone text)
returns setof public.leads
language sql
stable
security definer
set search_path to 'public'
as $$
  select l.* from public.leads l
  where length(regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g')) >= 8
    and right(regexp_replace(p_telefone, '\D', '', 'g'), 8) in (
      right(regexp_replace(coalesce(l.telefone, ''), '\D', '', 'g'), 8),
      right(regexp_replace(coalesce(l.telefone_2, ''), '\D', '', 'g'), 8)
    )
  order by l.atualizado_em desc
  limit 1;
$$;

revoke execute on function public.lead_por_telefone(text) from public, anon, authenticated;
grant execute on function public.lead_por_telefone(text) to service_role;
