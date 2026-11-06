-- Plano passa de R$ 69 para R$ 67/mês.
-- (A cobrança no Asaas sai da Edge Function criar-assinatura-asaas, VALOR_PLANO.)

-- MRR estimado do painel interno
create or replace view public.vw_saas_metricas as
 WITH base AS (
         SELECT barbearias.cliente,
            barbearias.trial_iniciado_em,
            COALESCE(barbearias.subscription_status, barbearias.status_assinatura) AS status_raw
           FROM barbearias
          WHERE (NOT barbearias.conta_interna)
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
    (count(*) FILTER (WHERE (categoria = 'ativo'::text)) * 67) AS mrr_estimado,
    round(((100.0 * (count(*) FILTER (WHERE (categoria = 'ativo'::text)))::numeric) / (NULLIF(count(*) FILTER (WHERE (categoria = ANY (ARRAY['ativo'::text, 'cancelado'::text]))), 0))::numeric), 1) AS taxa_conversao_pct
   FROM categorizado;

-- Roteiros de prospecção (Central interna)
update public.mensagens_prospeccao
set texto = regexp_replace(texto, 'R\$ ?69', 'R$ 67', 'g')
where texto ~ 'R\$ ?69';
