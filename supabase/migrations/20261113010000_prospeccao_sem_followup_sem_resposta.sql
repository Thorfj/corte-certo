-- O número da prospecção caiu como spam: não há mais follow-up para quem não respondeu.
-- Só quem responde volta a receber mensagem. Primeiro contato sem link e com saída fácil.
-- (Aplicada no banco em 13/11/2026.)

-- 1. Textos do primeiro contato: sem link e com opt-out
update public.mensagens_prospeccao set texto = 'Oi! Sou o [seu nome], do BarboZap. Fizemos um sistema que marca horário sozinho no WhatsApp da [barbearia]: o cliente escolhe serviço, barbeiro e horário, e recebe lembrete pra não faltar. Dá pra testar 14 dias grátis, sem cartão. Quer que eu te mande o link?', atualizado_em = now()
 where etapa = 'Primeiro contato – D (direto ao teste)';

update public.mensagens_prospeccao set texto = replace(texto,
    ', e dá pra testar 14 dias grátis, sem cartão: barbozap.com.br/teste-gratis',
    '. Dá pra testar 14 dias grátis, sem cartão.'), atualizado_em = now()
 where etapa = 'Primeiro contato – E (barbearia nova)';

update public.mensagens_prospeccao
   set texto = rtrim(texto) || E'\n\nSe não fizer sentido pra vocês, é só me avisar que não te chamo mais 🙂', atualizado_em = now()
 where (etapa like 'Primeiro contato –%' or etapa = 'Parceria escola – 1. Convite')
   and texto not ilike '%não te chamo mais%';

-- 2. Depois do primeiro contato o lead fica aguardando resposta, sem data de follow-up
update public.mensagens_prospeccao
   set proximo_passo = 'Aguardando resposta', dias_proximo_passo = null, atualizado_em = now()
 where etapa like 'Primeiro contato –%' or etapa = 'Parceria escola – 1. Convite';

-- 3. Leads contatados que não responderam: sai o follow-up agendado
update public.leads
   set proximo_passo = 'Aguardando resposta', data_proximo_passo = null
 where status = 'contato_feito' and data_proximo_passo is not null;

-- 4. Leads presos em "Na fila do n8n" sem safra rodando voltam a ficar disponíveis
update public.leads l
   set proximo_passo = null
 where l.status = 'novo_lead' and l.proximo_passo = 'Na fila do n8n'
   and not exists (select 1 from public.safras_prospeccao s where s.status in ('na_fila', 'enviando'));
