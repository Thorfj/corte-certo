-- Follow-up do dia 3 passa a levar o link do teste grátis.
update public.mensagens_prospeccao set texto = 'Oi, [nome]! Passando só pra minha mensagem não se perder no meio dos clientes 😄 Resumindo: o BarboZap marca horário sozinho no seu WhatsApp e manda lembrete pro cliente não faltar.

Se quiser ver funcionando, dá pra testar 14 dias grátis, sem cartão: barbozap.com.br/teste-gratis

Ou, se preferir, te mando um vídeo curto mostrando como funciona.'
where etapa = 'Follow-up – dia 3';
