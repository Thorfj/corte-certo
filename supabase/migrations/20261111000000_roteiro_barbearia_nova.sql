-- Primeiro contato para barbearias abertas nos últimos 12 meses (CNPJ recente).
insert into public.mensagens_prospeccao (ordem, etapa, quando_usar, texto)
select 36,
  'Primeiro contato – E (barbearia nova)',
  'Barbearias abertas nos últimos 12 meses. O dono ainda está montando a rotina e não escolheu sistema: a mensagem parabeniza e mostra que é mais fácil começar organizado.',
  'Oi! Aqui é o Thor, do Barbozap 😊 Vi que a [barbearia] abriu há pouco tempo. Parabéns pela nova fase!

No começo é o dono que faz tudo, inclusive parar o corte pra responder o WhatsApp e marcar horário. O Barbozap faz essa parte sozinho: o cliente escolhe o serviço, o barbeiro e um horário livre na própria conversa, e recebe lembrete um dia antes e uma hora antes pra não faltar.

Começar já organizado é bem mais fácil do que mudar depois, quando a agenda estiver cheia. Custa R$ 67/mês, com barbeiros ilimitados, e dá pra testar 14 dias grátis, sem cartão: barbozap.com.br/teste-gratis

Quer que eu te mande um vídeo de 1 minuto mostrando como ficaria aí?'
where not exists (select 1 from public.mensagens_prospeccao where etapa = 'Primeiro contato – E (barbearia nova)');
