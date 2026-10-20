-- Relatórios de SaaS: tabela de onboarding por barbearia e contas internas fora das métricas.
-- conta_interna marca contas de teste da equipe (ex.: thorfj@gmail.com), que deixam de
-- contar em vw_saas_metricas, vw_novas_barbearias_por_mes e saas_onboarding().

alter table public.barbearias add column if not exists conta_interna boolean not null default false;

update public.barbearias set conta_interna = true where email = 'thorfj@gmail.com';

create or replace view public.vw_saas_metricas with (security_invoker = true) as
 WITH base AS (
         SELECT barbearias.cliente,
            barbearias.trial_iniciado_em,
            COALESCE(barbearias.subscription_status, barbearias.status_assinatura) AS status_raw
           FROM barbearias
          WHERE NOT barbearias.conta_interna
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

create or replace view public.vw_novas_barbearias_por_mes with (security_invoker = true) as
 SELECT to_char(date_trunc('month'::text, criado_em), 'YYYY-MM'::text) AS mes,
    count(*) AS total
   FROM barbearias
  WHERE NOT conta_interna
  GROUP BY (to_char(date_trunc('month'::text, criado_em), 'YYYY-MM'::text))
  ORDER BY (to_char(date_trunc('month'::text, criado_em), 'YYYY-MM'::text));

-- Mesmos passos do checklist "Primeiros passos" do app (crm-global.js). A conexão do
-- WhatsApp não fica no banco (é consultada ao vivo na Evolution), então não entra aqui.
-- security definer porque servicos/profissionais só são legíveis pela própria barbearia;
-- a função confere que quem chama é da equipe interna.
create or replace function public.saas_onboarding()
returns table (
  id bigint,
  email text,
  empresa text,
  whatsapp text,
  criado_em timestamptz,
  servicos bigint,
  profissionais bigint,
  horario_ajustado boolean,
  google_conectado boolean,
  bot_ligado boolean,
  trial_iniciado_em timestamptz,
  landing_publicada boolean,
  cliente boolean,
  status_assinatura text
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not exists (select 1 from equipe_interna e where e.auth_user_id = auth.uid()) then
    raise exception 'acesso restrito à equipe interna';
  end if;

  return query
  select b.id, b.email, b.empresa, b.whatsapp_barbearia, b.criado_em,
    (select count(*) from servicos s where s.barbearia_id = b.id),
    (select count(*) from profissionais p where p.barbearia_id = b.id and p.removido_em is null),
    b.horario_funcionamento is not null and b.horario_funcionamento <> '{"0": null, "1": ["09:00", "19:00"], "2": ["09:00", "19:00"], "3": ["09:00", "19:00"], "4": ["09:00", "19:00"], "5": ["09:00", "19:00"], "6": ["09:00", "19:00"]}'::jsonb,
    coalesce(b.google_calendar_status = 'conectado', false),
    coalesce(b.status_fluxo = 'Sim', false),
    b.trial_iniciado_em,
    coalesce(b.landing_publicada, false),
    coalesce(b.cliente, false),
    coalesce(b.subscription_status, b.status_assinatura)
  from barbearias b
  where not b.conta_interna
  order by b.criado_em desc;
end;
$$;

revoke execute on function public.saas_onboarding() from public, anon;
grant execute on function public.saas_onboarding() to authenticated;
