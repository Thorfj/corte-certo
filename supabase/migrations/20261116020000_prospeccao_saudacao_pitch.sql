-- Fluxo novo de prospecção: a safra manda só "Bom dia/Boa tarde/Boa noite, tudo bem?".
-- Quando uma pessoa responde, 12 minutos depois sai sozinho um pitch que usa o tempo que a
-- barbearia levou para responder ("se eu fosse cliente, já teria marcado em outra barbearia").
-- Se quem respondeu foi um robô ou IA de atendimento, o fluxo termina e o lead vira Perdido.

-- 1. Roteiro com automação
alter table public.mensagens_prospeccao
  add column if not exists automacao text
  check (automacao is null or automacao in ('pitch_tempo'));

comment on column public.mensagens_prospeccao.automacao is
  'pitch_tempo: a safra troca [saudação] por bom dia/boa tarde/boa noite na hora do envio e, quando o lead responde, manda o pitch do tempo de resposta 12 min depois.';

insert into public.mensagens_prospeccao (ordem, etapa, quando_usar, texto, status_depois, proximo_passo, dias_proximo_passo, automacao)
values (
  1,
  'Primeiro contato – Saudação',
  'Só o cumprimento. [saudação] vira Bom dia, Boa tarde ou Boa noite na hora em que cada mensagem sai. Quando uma pessoa responde, o pitch com o tempo de resposta sai sozinho 12 minutos depois. Se responder um robô ou IA, o fluxo termina.',
  '[saudação], tudo bem?',
  'contato_feito',
  'Aguardando resposta',
  null,
  'pitch_tempo'
);

-- 2. Controle do pitch por lead
create table if not exists public.prospeccao_pitch (
  lead_id uuid primary key references public.leads (id) on delete cascade,
  telefone text not null,
  saudacao_enviada_em timestamptz not null default now(),
  respondida_em timestamptz,
  status text not null default 'aguardando'
    check (status in ('aguardando', 'agendado', 'enviando', 'enviado', 'encerrado_ia', 'cancelado', 'erro')),
  enviar_em timestamptz,
  pitch text,
  enviado_em timestamptz,
  observacao text,
  atualizado_em timestamptz not null default now()
);

comment on table public.prospeccao_pitch is
  'Fluxo da saudação: aguardando (esperando resposta) → agendado (pessoa respondeu, pitch em enviar_em) → enviando → enviado. encerrado_ia: respondeu robô/IA. cancelado: Thor respondeu antes ou a IA decidiu não mandar.';

create index if not exists prospeccao_pitch_agendado_idx
  on public.prospeccao_pitch (enviar_em) where status = 'agendado';

alter table public.prospeccao_pitch enable row level security;

drop policy if exists "equipe interna le o pitch" on public.prospeccao_pitch;
create policy "equipe interna le o pitch" on public.prospeccao_pitch
  for select to authenticated
  using (exists (select 1 from public.equipe_interna e where e.auth_user_id = auth.uid()));

-- mesmo número? (últimos 8 dígitos, como o lead_por_telefone)
create or replace function public.mesmo_telefone(a text, b text)
returns boolean
language sql immutable
set search_path to 'public'
as $$
  select length(regexp_replace(coalesce(a, ''), '\D', '', 'g')) >= 8
     and right(regexp_replace(coalesce(a, ''), '\D', '', 'g'), 8) = right(regexp_replace(coalesce(b, ''), '\D', '', 'g'), 8);
$$;

-- 3. Chamado pelo fluxo de respostas depois que a IA lê a resposta
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
    -- a primeira mensagem de gente depois da saudação (respostas automáticas ficam como "ignorada")
    select min(pr.recebida_em) into v_resp
    from public.prospeccao_respostas pr
    where public.mesmo_telefone(pr.telefone, r.telefone)
      and pr.recebida_em > r.saudacao_enviada_em
      and pr.status <> 'ignorada';
    v_resp := coalesce(v_resp, now());

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
      'Fluxo da saudação encerrado: a barbearia respondeu com robô ou IA de atendimento. Lead marcado como Perdido.',
      v_status, 'perdido');
    return 'encerrado_ia';
  end if;

  -- aviso de ausência ("responderemos em breve"): continua esperando uma pessoa
  return 'aguardando';
end;
$$;

-- 4. O Thor respondeu na mão antes do pitch sair: cancela o pitch
create or replace function public.pitch_cancelar_por_telefone(p_telefone text)
returns integer
language sql
security definer
set search_path to 'public'
as $$
  with c as (
    update public.prospeccao_pitch
    set status = 'cancelado', observacao = 'O Thor respondeu antes do pitch automático', atualizado_em = now()
    where status = 'agendado' and public.mesmo_telefone(telefone, p_telefone)
    returning 1
  )
  select count(*)::int from c;
$$;

-- 5. Pega os pitches que já passaram dos 12 minutos (e marca como "enviando" para não sair duas vezes)
create or replace function public.pitch_pendentes()
returns table (
  lead_id uuid, telefone text, saudacao_enviada_em timestamptz, respondida_em timestamptz,
  nome_barbearia text, nome_contato text, cidade text, bairro text, conversa text
)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- lead que saiu do funil (perdido, demo, teste...) enquanto esperava: cancela
  update public.prospeccao_pitch p
  set status = 'cancelado', observacao = 'O lead mudou de etapa antes do pitch', atualizado_em = now()
  from public.leads l
  where l.id = p.lead_id and p.status = 'agendado' and l.status not in ('contato_feito', 'respondeu');

  return query
  with alvo as (
    select p.lead_id from public.prospeccao_pitch p
    where p.status = 'agendado' and p.enviar_em <= now()
    order by p.enviar_em
    limit 5
    for update skip locked
  ), marcados as (
    update public.prospeccao_pitch p
    set status = 'enviando', atualizado_em = now()
    from alvo where p.lead_id = alvo.lead_id
    returning p.*
  )
  select m.lead_id, m.telefone, m.saudacao_enviada_em, m.respondida_em,
    l.nome_barbearia, l.nome_contato, l.cidade, l.bairro,
    (select string_agg(to_char(pr.recebida_em at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') || ' Lead: ' || pr.texto, E'\n' order by pr.recebida_em)
       from public.prospeccao_respostas pr
       where public.mesmo_telefone(pr.telefone, m.telefone) and pr.recebida_em > m.saudacao_enviada_em)
  from marcados m
  join public.leads l on l.id = m.lead_id;
end;
$$;

-- 6. Resultado do envio do pitch
create or replace function public.pitch_resultado(p_lead_id uuid, p_status text, p_texto text, p_obs text, p_tempo text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  r public.prospeccao_pitch;
  v_status text;
begin
  select * into r from public.prospeccao_pitch where lead_id = p_lead_id for update;
  if not found then
    return 'nada';
  end if;

  if p_status <> 'enviado' then
    update public.prospeccao_pitch
    set status = case when p_status = 'cancelado' then 'cancelado' else 'erro' end,
        observacao = left(p_obs, 500), atualizado_em = now()
    where lead_id = p_lead_id;
    return p_status;
  end if;

  update public.prospeccao_pitch
  set status = 'enviado', pitch = p_texto, enviado_em = now(), observacao = p_obs, atualizado_em = now()
  where lead_id = p_lead_id;

  -- a resposta do lead sai da aba Respostas: já foi respondida pelo pitch
  update public.prospeccao_respostas pr
  set resposta_enviada = case when pr.status = 'nova' then p_texto else pr.resposta_enviada end,
      status = 'respondida', tratada_em = now()
  where public.mesmo_telefone(pr.telefone, r.telefone) and pr.status in ('nova', 'agrupada');

  select status into v_status from public.leads where id = p_lead_id;
  update public.leads
  set status = case when status in ('novo_lead', 'contato_feito') then 'respondeu' else status end,
      ultimo_contato = now(),
      proximo_passo = 'Aguardando resposta do pitch',
      data_proximo_passo = null
  where id = p_lead_id;

  insert into public.lead_atividades (lead_id, tipo, descricao, status_de, status_para)
  values (p_lead_id, 'mensagem',
    'Pitch automático (respondeu a saudação em ' || coalesce(p_tempo, '?') || '): ' || left(p_texto, 1500),
    v_status, case when v_status in ('novo_lead', 'contato_feito') then 'respondeu' else v_status end);
  return 'enviado';
end;
$$;

revoke all on function public.pitch_registrar_resposta(uuid, boolean, boolean) from public, anon, authenticated;
revoke all on function public.pitch_cancelar_por_telefone(text) from public, anon, authenticated;
revoke all on function public.pitch_pendentes() from public, anon, authenticated;
revoke all on function public.pitch_resultado(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.pitch_registrar_resposta(uuid, boolean, boolean) to service_role;
grant execute on function public.pitch_cancelar_por_telefone(text) to service_role;
grant execute on function public.pitch_pendentes() to service_role;
grant execute on function public.pitch_resultado(uuid, text, text, text, text) to service_role;
