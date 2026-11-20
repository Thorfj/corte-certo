-- Follow-up da Black Friday para barbearias que já criaram conta (ex.: Barbearia Matriz).
-- Fica na aba Mensagens da Central para ver e editar, e é usada no botão "Black Friday"
-- da aba Onboarding (abre o WhatsApp da barbearia com o texto pronto).

alter table public.mensagens_prospeccao drop constraint if exists mensagens_prospeccao_automacao_check;
alter table public.mensagens_prospeccao
  add constraint mensagens_prospeccao_automacao_check
  check (automacao is null or automacao in ('pitch_tempo', 'pitch_resposta', 'apresentacao', 'apresentacao_2', 'black_friday_conta'));

insert into public.mensagens_prospeccao (ordem, etapa, quando_usar, texto, status_depois, proximo_passo, dias_proximo_passo, automacao)
values (
  90,
  'Black Friday – Follow-up para quem já tem conta',
  'Para barbearias que já criaram conta no Barbozap. Mande pelo botão "Black Friday" da aba Onboarding. [barbearia] vira o nome da barbearia.',
  'Oi! Tudo bem? Aqui é o Thor, do Barbozap.

Vi que vocês já criaram a conta da [barbearia] no Barbozap. Estamos com uma condição de Black Friday e a conta de vocês já entrou nela: em vez de 14, são 30 dias grátis.

Pra garantir, é só deixar o bot rodando até 15/12: cadastrar pelo menos um serviço e ligar o bot na aba Mensagens. Os 30 dias contam a partir do dia em que o bot começa a rodar.

Se quiser, te ajudo a terminar a configuração agora. Leva uns 5 minutos.',
  null,
  null,
  null,
  'black_friday_conta'
);
