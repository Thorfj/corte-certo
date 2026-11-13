-- Reduz risco de restrição do WhatsApp na prospecção:
-- 1) primeiro contato sem link; 2) saída fácil (opt-out) no 1º contato e nos follow-ups.

-- 1. Primeiro contato – E (barbearia nova): troca o link por oferta de mandar o vídeo/link.
update public.mensagens_prospeccao
   set texto = regexp_replace(
         texto,
         ', e dá pra testar 14 dias grátis, sem cartão: (https?://)?(www\.)?barbozap\.com\.br/teste-gratis',
         '. E dá pra testar 14 dias grátis, sem cartão',
         'g'),
       atualizado_em = now()
 where etapa = 'Primeiro contato – E (barbearia nova)';

update public.mensagens_prospeccao
   set texto = replace(texto,
         'Quer que eu te mande um vídeo de 1 minuto mostrando como ficaria aí?',
         'Quer que eu te mande um vídeo de 1 minuto mostrando como ficaria aí, ou o link pra testar?'),
       atualizado_em = now()
 where etapa = 'Primeiro contato – E (barbearia nova)'
   and texto not like '%ou o link pra testar?%';

-- Rede de segurança para os demais roteiros de primeiro contato e o convite da parceria:
-- qualquer URL restante vira uma oferta de mandar o link.
update public.mensagens_prospeccao
   set texto = regexp_replace(
         texto,
         ':?\s*(https?://)?(www\.)?barbozap\.com\.br[^\s]*',
         ' (se quiser, te mando o link)',
         'g'),
       atualizado_em = now()
 where (etapa like 'Primeiro contato –%' or etapa = 'Parceria escola – 1. Convite')
   and texto ~ 'barbozap\.com\.br|https?://';

-- 2. Opt-out no fim do 1º contato e dos follow-ups (não nas "Resposta – ...").
update public.mensagens_prospeccao
   set texto = rtrim(texto) || E'\n\n' || 'Se não fizer sentido pra vocês, é só me avisar que não te chamo mais 🙂',
       atualizado_em = now()
 where (etapa like 'Primeiro contato –%'
        or etapa in ('Follow-up – dia 3', 'Follow-up – dia 7', 'Follow-up – cobrar retorno',
                     'Parceria escola – 1. Convite', 'Parceria escola – 3. Follow-up'))
   and texto not ilike '%não te chamo mais%';
