-- Safras de prospecção disparadas pelo n8n (workflow "Barbozap - Safra de prospecção").
-- Cada envio do formulário vira uma linha aqui; o resultado de cada lead vai para
-- leads + lead_atividades pela função registrar_lead_safra.

create table if not exists public.safras_prospeccao (
  id bigint generated always as identity primary key,
  criado_em timestamptz not null default now(),
  tipo text,
  quantidade int,
  bairro text,
  instancia text,
  enviado_por text,
  formulario jsonb,
  status text not null default 'previa' check (status in ('previa', 'enviando', 'concluida', 'cancelada')),
  total int,
  resumo jsonb,
  finalizada_em timestamptz
);

alter table public.safras_prospeccao enable row level security;
drop policy if exists "equipe interna vê safras" on public.safras_prospeccao;
create policy "equipe interna vê safras" on public.safras_prospeccao
  for select to authenticated
  using (exists (select 1 from public.equipe_interna where auth_user_id = (select auth.uid())));

-- Aplica o resultado de um lead da safra: atualiza o lead (etapa só avança) e grava
-- o histórico. Devolve a ação e se o n8n deve esperar antes do próximo envio.
create or replace function public.registrar_lead_safra(
  p_lead_id uuid,
  p_acao text,
  p_patch jsonb,
  p_tipo text,
  p_descricao text,
  p_esperar boolean
)
returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  etapas constant text[] := array['novo_lead', 'contato_feito', 'respondeu', 'demo_agendada', 'teste_gratis', 'fechado_ganho', 'perdido'];
begin
  update public.leads l set
    status = case
      when p_patch ? 'status'
        and array_position(etapas, p_patch->>'status') > array_position(etapas, l.status)
      then p_patch->>'status' else l.status end,
    proximo_passo = case when p_patch ? 'proximo_passo' then p_patch->>'proximo_passo' else l.proximo_passo end,
    data_proximo_passo = case when p_patch ? 'data_proximo_passo' then (p_patch->>'data_proximo_passo')::date else l.data_proximo_passo end,
    ultimo_contato = case when p_patch ? 'ultimo_contato' then (p_patch->>'ultimo_contato')::timestamptz else l.ultimo_contato end
  where l.id = p_lead_id;

  if p_descricao is not null then
    insert into public.lead_atividades (lead_id, tipo, descricao)
    values (p_lead_id, coalesce(p_tipo, 'nota'), p_descricao);
  end if;

  return jsonb_build_object('lead_id', p_lead_id, 'acao', p_acao, 'esperar', coalesce(p_esperar, false));
end;
$$;

revoke execute on function public.registrar_lead_safra(uuid, text, jsonb, text, text, boolean) from public, anon, authenticated;
grant execute on function public.registrar_lead_safra(uuid, text, jsonb, text, text, boolean) to service_role;
