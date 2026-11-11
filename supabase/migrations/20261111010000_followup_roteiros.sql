-- Aba Follow-up da Central: roteiro para cobrar retorno de quem já respondeu,
-- e o que acontece depois do envio nos roteiros criados em novembro.
insert into public.mensagens_prospeccao (ordem, etapa, quando_usar, texto, proximo_passo, dias_proximo_passo)
select 95,
  'Follow-up – cobrar retorno',
  'Para quem já respondeu (ou recebeu proposta) e parou de falar. Retoma a conversa sem pressão.',
  'Oi, [nome]! Tudo bem? Aqui é o Thor, do Barbozap 😊

Passando pra saber se você conseguiu pensar no que conversamos. Ficou alguma dúvida? Se quiser, te mostro rapidinho como ficaria na [barbearia], ou você mesmo testa 14 dias grátis, sem cartão: barbozap.com.br/teste-gratis',
  'Cobrar retorno de novo', 4
where not exists (select 1 from public.mensagens_prospeccao where etapa = 'Follow-up – cobrar retorno');

update public.mensagens_prospeccao set status_depois = 'contato_feito', proximo_passo = 'Follow-up dia 3', dias_proximo_passo = 3
 where etapa = 'Primeiro contato – E (barbearia nova)';
update public.mensagens_prospeccao set status_depois = 'respondeu', proximo_passo = 'Ver se criou a conta de teste', dias_proximo_passo = 3
 where etapa = 'Resposta – "ordem de chegada / temos site"';
