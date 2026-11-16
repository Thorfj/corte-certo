-- Fluxo "Apresentação": duas mensagens seguidas na safra.
-- 1) "[saudação], tudo bem? Aqui é o Thor, do Barbozap." (cumprimento pelo horário do envio)
-- 2) 60 segundos depois, o que é o Barbozap + se tem interesse (texto editável na aba Mensagens).
-- Sem pitch automático: a resposta vai para a aba Respostas. Se responder robô ou IA, o lead vira Perdido.

alter table public.mensagens_prospeccao drop constraint if exists mensagens_prospeccao_automacao_check;
alter table public.mensagens_prospeccao
  add constraint mensagens_prospeccao_automacao_check
  check (automacao is null or automacao in ('pitch_tempo', 'pitch_resposta', 'apresentacao', 'apresentacao_2'));

insert into public.mensagens_prospeccao (ordem, etapa, quando_usar, texto, status_depois, proximo_passo, dias_proximo_passo, automacao)
values
(
  3,
  'Apresentação – 1. Cumprimento',
  'Primeira mensagem do fluxo Apresentação. [saudação] vira Bom dia, Boa tarde ou Boa noite na hora do envio. A mensagem 2 sai sozinha 60 segundos depois.',
  '[saudação], tudo bem? Aqui é o Thor, do Barbozap.',
  'contato_feito',
  'Aguardando resposta',
  null,
  'apresentacao'
),
(
  4,
  'Apresentação – 2. O que é o Barbozap (automática)',
  'Sai sozinha 60 segundos depois da mensagem 1 do fluxo Apresentação.',
  E'O Barbozap é um sistema que atende e agenda os clientes da barbearia sozinho, direto no WhatsApp: o cliente escolhe o serviço, o barbeiro e o horário, e recebe lembrete pra não faltar. Ninguém precisa parar o corte pra responder.\n\nE depois do corte ele continua trabalhando: manda mensagem chamando o cliente de volta na hora de cortar de novo (em 30, 60 ou 90 dias, você escolhe).\n\nFaz sentido pra vocês? Se tiver interesse, te mostro melhor como funciona.\n\nSe não fizer sentido, é só me avisar que não te chamo mais.',
  null,
  null,
  null,
  'apresentacao_2'
);

-- o controle por lead passa a valer para os dois fluxos
alter table public.prospeccao_pitch
  add column if not exists fluxo text not null default 'saudacao'
  check (fluxo in ('saudacao', 'apresentacao'));

alter table public.prospeccao_pitch drop constraint if exists prospeccao_pitch_status_check;
alter table public.prospeccao_pitch
  add constraint prospeccao_pitch_status_check
  check (status in ('aguardando', 'agendado', 'enviando', 'enviado', 'respondido', 'encerrado_ia', 'cancelado', 'erro'));

comment on table public.prospeccao_pitch is
  'Fluxos de primeiro contato por lead. saudacao: aguardando → agendado (pitch em enviar_em) → enviando → enviado. apresentacao: aguardando → respondido (sem pitch). Nos dois: encerrado_ia quando responde robô/IA (lead vira Perdido); cancelado quando o Thor responde antes ou a IA decide não mandar.';

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
  if not found or r.status <> 'aguardando' then
    return 'nada';
  end if;

  if coalesce(p_humano, false) then
    select min(pr.recebida_em) into v_resp
    from public.prospeccao_respostas pr
    where public.mesmo_telefone(pr.telefone, r.telefone)
      and pr.recebida_em > r.saudacao_enviada_em
      and pr.status <> 'ignorada';
    v_resp := coalesce(v_resp, now());

    if r.fluxo = 'apresentacao' then
      -- sem pitch automático: a resposta fica na aba Respostas para o Thor
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

  return 'aguardando';
end;
$$;

revoke all on function public.pitch_registrar_resposta(uuid, boolean, boolean) from public, anon, authenticated;
grant execute on function public.pitch_registrar_resposta(uuid, boolean, boolean) to service_role;
