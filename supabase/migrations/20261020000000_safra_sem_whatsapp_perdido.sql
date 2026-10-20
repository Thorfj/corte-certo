-- Lead sem WhatsApp vira Perdido (motivo "Sem WhatsApp").
-- O workflow "Barbozap - Safra pela Central" passa a mandar status/motivo_perda no
-- patch; registrar_lead_safra agora grava motivo_perda. Os leads que as safras já
-- tinham marcado com o próximo passo "Sem WhatsApp: ..." foram convertidos.

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
    motivo_perda = case when p_patch ? 'motivo_perda' then p_patch->>'motivo_perda' else l.motivo_perda end,
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

update public.leads
set status = 'perdido', motivo_perda = 'Sem WhatsApp', proximo_passo = null, data_proximo_passo = null
where proximo_passo ilike 'Sem WhatsApp%';
