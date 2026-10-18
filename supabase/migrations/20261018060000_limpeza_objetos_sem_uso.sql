-- Já aplicada no banco em 18/10/2026 (rodada pelo SQL Editor).
-- Higienização: objetos que nada usa (CRM, site, painel interno /core,
-- Edge Functions, n8n, gatilhos, regras de acesso, cron e outras funções).
--   - atualizar_status_pagante(): versão antiga; o webhook do Asaas usa atualizar_status_pagantes()
--   - current_acesso() e minha_barbearia_id(): substituídas por e_admin() e current_barbearia_id()
--   - view status_financeiro_barbearias: ninguém consulta
--
-- Para recriar, as definições originais estão no fim deste arquivo.

drop view if exists public.status_financeiro_barbearias;
drop function if exists public.atualizar_status_pagante();
drop function if exists public.current_acesso();
drop function if exists public.minha_barbearia_id();

/* ---------- definições originais (backup) ----------

create or replace view public.status_financeiro_barbearias as
 SELECT b.id AS barbearia_id, b.empresa, b.nome, b.email, b.asaas_customer_id,
    cobranca.id AS cobranca_id, cobranca.asaas_payment_id, cobranca.descricao,
    cobranca.valor, cobranca.valor_liquido, cobranca.data_vencimento,
    cobranca.data_pagamento, cobranca.billing_type, cobranca.fatura_url,
    cobranca.status AS status_interno, cobranca.asaas_status,
        CASE
            WHEN (cobranca.id IS NULL) THEN 'Sem cobrança'::text
            WHEN (cobranca.asaas_status = ANY (ARRAY['RECEIVED'::text, 'CONFIRMED'::text])) THEN 'Pago'::text
            WHEN (cobranca.asaas_status = 'OVERDUE'::text) THEN 'Inadimplente'::text
            WHEN ((cobranca.asaas_status = 'PENDING'::text) AND (cobranca.data_vencimento < CURRENT_DATE)) THEN 'Inadimplente'::text
            WHEN (cobranca.asaas_status = 'PENDING'::text) THEN 'Pendente'::text
            WHEN (cobranca.asaas_status = ANY (ARRAY['REFUNDED'::text, 'CANCELLED'::text, 'DELETED'::text])) THEN 'Cancelado'::text
            ELSE 'Em análise'::text
        END AS situacao_financeira
   FROM (barbearias b
     LEFT JOIN LATERAL ( SELECT a.* FROM asaas a
          WHERE (a.barbearia_id = b.id)
          ORDER BY a.data_vencimento DESC NULLS LAST, a.id DESC
         LIMIT 1) cobranca ON (true));

create or replace function public.atualizar_status_pagante() returns void language sql as $$
  update public.asaas
  set status = case
      when asaas_status in ('RECEIVED','CONFIRMED') then 'pagante'
      when asaas_status = 'OVERDUE' and data_vencimento <= current_date - interval '7 days' then 'não pagante'
      else status
  end;
$$;

create or replace function public.current_acesso() returns text language sql stable security definer
set search_path to 'public' as $$
  select acesso from profissionais where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.minha_barbearia_id() returns bigint language sql stable security definer
set search_path to 'public' as $$
  select barbearia_id from profissionais where auth_user_id = auth.uid() limit 1;
$$;
*/
