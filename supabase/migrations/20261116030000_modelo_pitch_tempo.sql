-- Modelo do pitch do tempo de resposta na aba Mensagens da Central.
-- O n8n (fluxo "Pitch do tempo de resposta") lê este texto e a IA segue o modelo,
-- trocando [resposta ao cumprimento] e [tempo]. Não aparece nas listas de envio manual.
alter table public.mensagens_prospeccao drop constraint if exists mensagens_prospeccao_automacao_check;
alter table public.mensagens_prospeccao
  add constraint mensagens_prospeccao_automacao_check
  check (automacao is null or automacao in ('pitch_tempo', 'pitch_resposta'));

insert into public.mensagens_prospeccao (ordem, etapa, quando_usar, texto, automacao)
values (
  2,
  'Saudação – 2. Pitch do tempo (automático)',
  'Sai sozinho 12 minutos depois que uma pessoa responde a saudação. A IA troca [resposta ao cumprimento] e [tempo].',
  E'[resposta ao cumprimento] Sou o Thor, do Barbozap 😊\n\nRepara numa coisa: minha mensagem levou [tempo] pra ser respondida. Se eu fosse um cliente querendo marcar um horário, provavelmente já teria chamado outra barbearia.\n\nO Barbozap responde e agenda sozinho no WhatsApp da barbearia, na hora, até no meio de um corte ou de madrugada.\n\nPosso te mandar um vídeo de 1 minuto mostrando como funciona?',
  'pitch_resposta'
);
