-- Renomeia o roteiro do fluxo da saudação (a Central ainda acha "primeiro contato" no nome para os leads novos)
update public.mensagens_prospeccao
set etapa = 'Saudação – 1. Primeiro contato', atualizado_em = now()
where etapa = 'Primeiro contato – Saudação';
