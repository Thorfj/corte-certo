-- Telefones padronizados, horário de funcionamento por barbearia,
-- registro de falhas do n8n e métrica de MRR com o preço real (R$ 69).

-- 1) Telefones: só dígitos e com DDI 55 (instância da Evolution = whatsapp_barbearia)
create or replace function public.normalizar_telefone(p text)
returns text
language sql
immutable
set search_path = public
as $$
  -- Só dígitos; número brasileiro sem DDI (10 ou 11 dígitos) ganha o 55 na frente.
  select case
    when nullif(regexp_replace(coalesce(p, ''), '\D', '', 'g'), '') is null then null
    when length(regexp_replace(p, '\D', '', 'g')) in (10, 11) then '55' || regexp_replace(p, '\D', '', 'g')
    else regexp_replace(p, '\D', '', 'g')
  end;
$$;

create or replace function public.normalizar_telefones_barbearia()
returns trigger language plpgsql set search_path = public as $$
begin
  new.whatsapp_barbearia := public.normalizar_telefone(new.whatsapp_barbearia);
  new.whatsapp := public.normalizar_telefone(new.whatsapp);
  return new;
end; $$;

create or replace function public.normalizar_telefone_cliente()
returns trigger language plpgsql set search_path = public as $$
begin
  new.telefone := public.normalizar_telefone(new.telefone);
  return new;
end; $$;

revoke execute on function public.normalizar_telefones_barbearia() from public, anon, authenticated;
revoke execute on function public.normalizar_telefone_cliente() from public, anon, authenticated;

create trigger trg_normalizar_telefones_barbearia
  before insert or update of whatsapp_barbearia, whatsapp on public.barbearias
  for each row execute function public.normalizar_telefones_barbearia();
create trigger trg_normalizar_telefone_cliente
  before insert or update of telefone on public.clientes
  for each row execute function public.normalizar_telefone_cliente();

update public.barbearias set whatsapp_barbearia = whatsapp_barbearia, whatsapp = whatsapp
  where whatsapp_barbearia is distinct from public.normalizar_telefone(whatsapp_barbearia)
     or whatsapp is distinct from public.normalizar_telefone(whatsapp);
update public.clientes set telefone = telefone
  where telefone is distinct from public.normalizar_telefone(telefone);

-- Cadastro: compara o WhatsApp já normalizado
create or replace function public.whatsapp_barbearia_disponivel(p_whatsapp_barbearia text)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select not exists (
    select 1 from barbearias where whatsapp_barbearia = public.normalizar_telefone(p_whatsapp_barbearia)
  );
$function$;

create or replace function public.finalizar_cadastro_barbearia(p_empresa text, p_nome text, p_whatsapp text, p_email text, p_whatsapp_barbearia text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_existing_id bigint;
  v_barbearia_id bigint;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'nao_autenticado');
  end if;

  -- checagem definitiva (o Step 2 já avisou antes, isso aqui é a trava real)
  select id into v_existing_id
  from barbearias
  where whatsapp_barbearia = public.normalizar_telefone(p_whatsapp_barbearia);

  if v_existing_id is not null then
    return jsonb_build_object('ok', false, 'reason', 'duplicado');
  end if;

  -- os telefones são normalizados (só dígitos + 55) pelo trigger da tabela
  insert into barbearias (empresa, email, whatsapp, whatsapp_barbearia, tipo)
  values (p_empresa, p_email, p_whatsapp, p_whatsapp_barbearia, 'Barbearia')
  returning id into v_barbearia_id;

  -- quem se cadastra pelo teste grátis vira admin da própria barbearia
  insert into profissionais (barbearia_id, auth_user_id, nome, email, acesso)
  values (v_barbearia_id, v_uid, p_nome, p_email, 'admin');

  return jsonb_build_object('ok', true);

exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'duplicado');
end;
$function$;

-- 2) Horário de funcionamento (CRM > Configurações; lido pelo bot na etapa 00501)
alter table public.barbearias add column if not exists horario_funcionamento jsonb not null
  default '{"0": null, "1": ["09:00","19:00"], "2": ["09:00","19:00"], "3": ["09:00","19:00"], "4": ["09:00","19:00"], "5": ["09:00","19:00"], "6": ["09:00","19:00"]}'::jsonb;
comment on column public.barbearias.horario_funcionamento is 'Horário por dia da semana (0 = domingo ... 6 = sábado): ["HH:MM","HH:MM"] ou null quando fechado. Usado pelo bot (etapa 00501) para oferecer horários.';

-- 3) Falhas dos workflows do n8n (gravadas pelo workflow "Barbozap - Alerta de erro")
create table if not exists public.n8n_erros (
  id bigint generated always as identity primary key,
  criado_em timestamptz not null default now(),
  workflow text,
  no text,
  mensagem text,
  execucao_url text,
  modo text
);
alter table public.n8n_erros enable row level security;
comment on table public.n8n_erros is 'Falhas dos workflows do n8n, gravadas pelo workflow "Barbozap - Alerta de erro". Sem políticas: só o service role lê/escreve.';

-- 4) Métricas da área interna com o preço real do plano
create or replace view public.vw_saas_metricas with (security_invoker = true) as
 WITH base AS (
         SELECT barbearias.cliente,
            barbearias.trial_iniciado_em,
            COALESCE(barbearias.subscription_status, barbearias.status_assinatura) AS status_raw
           FROM barbearias
        ), categorizado AS (
         SELECT
                CASE
                    WHEN (base.status_raw ~~* '%cancel%'::text) THEN 'cancelado'::text
                    WHEN (base.cliente = true) THEN 'ativo'::text
                    WHEN (base.trial_iniciado_em IS NOT NULL) THEN 'teste_gratis'::text
                    ELSE 'sem_config'::text
                END AS categoria
           FROM base
        )
 SELECT count(*) FILTER (WHERE (categoria = 'ativo'::text)) AS barbearias_ativas,
    count(*) FILTER (WHERE (categoria = 'teste_gratis'::text)) AS em_teste_gratis,
    count(*) FILTER (WHERE (categoria = 'cancelado'::text)) AS canceladas,
    (count(*) FILTER (WHERE (categoria = 'ativo'::text)) * 69) AS mrr_estimado,
    round(((100.0 * (count(*) FILTER (WHERE (categoria = 'ativo'::text)))::numeric) / (NULLIF(count(*) FILTER (WHERE (categoria = ANY (ARRAY['ativo'::text, 'cancelado'::text]))), 0))::numeric), 1) AS taxa_conversao_pct
   FROM categorizado;
