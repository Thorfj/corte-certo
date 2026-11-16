-- Robô ou IA de atendimento encerra o fluxo de abertura mesmo que apareça depois de uma resposta,
-- enquanto o pitch ainda não saiu (aguardando ou agendado). Robô tem prioridade sobre "pessoa respondeu".
create or replace function public.pitch_registrar_resposta(p_lead_id uuid, p_humano boolean, p_robo boolean)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  r public.prospeccao_pitch;
  v_resp timestamptz;
  v_status text;
begin
  select * into r from public.prospeccao_pitch where lead_id = p_lead_id for update;
  if not found or r.status not in ('aguardando', 'agendado') then
    return 'nada';
  end if;

  if coalesce(p_robo, false) then
    update public.prospeccao_pitch
    set status = 'encerrado_ia', observacao = 'Respondeu com robô ou IA de atendimento', atualizado_em = now()
    where lead_id = p_lead_id;

    select status into v_status from public.leads where id = p_lead_id;
    update public.leads
    set status = 'perdido', motivo_perda = 'Já tem robô/IA de atendimento', proximo_passo = null, data_proximo_passo = null
    where id = p_lead_id and status in ('novo_lead', 'contato_feito', 'respondeu');

    insert into public.lead_atividades (lead_id, tipo, descricao, status_de, status_para)
    values (p_lead_id, 'nota',
      'Fluxo ' || case when r.fluxo = 'apresentacao' then 'da apresentação' else 'da saudação' end
        || ' encerrado: a barbearia respondeu com robô ou IA de atendimento. Lead marcado como Perdido.',
      v_status, 'perdido');
    return 'encerrado_ia';
  end if;

  -- pitch já agendado: novas mensagens de pessoa não mudam nada (o pitch lê a conversa toda na hora de sair).
  -- 'pitch_agendado' avisa o n8n para não mandar o alerta de lead quente (o pitch automático é quem responde).
  if r.status = 'agendado' then
    return 'pitch_agendado';
  end if;

  if coalesce(p_humano, false) then
    select min(pr.recebida_em) into v_resp
    from public.prospeccao_respostas pr
    where public.mesmo_telefone(pr.telefone, r.telefone)
      and pr.recebida_em > r.saudacao_enviada_em
      and pr.status <> 'ignorada';
    v_resp := coalesce(v_resp, now());

    if r.fluxo = 'apresentacao' then
      update public.prospeccao_pitch
      set status = 'respondido', respondida_em = v_resp, atualizado_em = now()
      where lead_id = p_lead_id;
      return 'respondido';
    end if;

    update public.prospeccao_pitch
    set status = 'agendado', respondida_em = v_resp, enviar_em = v_resp + interval '12 minutes', atualizado_em = now()
    where lead_id = p_lead_id;
    return 'agendado';
  end if;

  return 'aguardando';
end;
$$;

revoke all on function public.pitch_registrar_resposta(uuid, boolean, boolean) from public, anon, authenticated;
grant execute on function public.pitch_registrar_resposta(uuid, boolean, boolean) to service_role;
