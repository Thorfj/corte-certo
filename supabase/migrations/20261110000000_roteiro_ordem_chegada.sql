-- Roteiro para barbearias que atendem por ordem de chegada ou têm site/link de agendamento que ninguém usa.
insert into public.mensagens_prospeccao (ordem, etapa, quando_usar, texto)
select 65,
  'Resposta – "ordem de chegada / temos site"',
  'Quando a barbearia diz que atende por ordem de chegada ou que já tem site/link de agendamento que ninguém usa. Mostra por que agendar pelo WhatsApp funciona melhor que o site.',
  'Entendi! Faz sentido, muita barbearia trabalha por ordem de chegada 😊

Vi que vocês até têm um site, mas na prática quase ninguém usa, né? O cliente já está no WhatsApp e não quer abrir link, fazer cadastro ou procurar horário em outra página.

O Barbozap funciona direto na conversa do WhatsApp da [barbearia]: o cliente manda um "oi", escolhe o serviço, o barbeiro e um horário livre, e pronto. Ninguém precisa parar o corte pra responder, e o cliente ainda recebe lembrete um dia antes e uma hora antes, o que diminui as faltas.

E não precisa largar a ordem de chegada: dá pra oferecer horário marcado só pra quem prefere não esperar, e ver como funciona.

São 14 dias grátis, sem cartão: barbozap.com.br/teste-gratis
Se quiser, te mando um vídeo de 1 minuto mostrando como ficaria aí.'
where not exists (select 1 from public.mensagens_prospeccao where etapa = 'Resposta – "ordem de chegada / temos site"');
