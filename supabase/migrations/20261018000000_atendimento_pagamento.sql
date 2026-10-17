-- Controle de pagamento do atendimento (pago x fiado).
-- Atendimentos antigos ficam com pagamento = null ("não informado");
-- os novos nascem 'pendente' até alguém marcar como pago.
alter table public.atendimentos add column if not exists pagamento text;
alter table public.atendimentos add column if not exists forma_pagamento text;
alter table public.atendimentos add column if not exists pago_em timestamptz;
alter table public.atendimentos alter column pagamento set default 'pendente';
alter table public.atendimentos add constraint atendimentos_pagamento_check
  check (pagamento is null or pagamento in ('pendente', 'pago'));
alter table public.atendimentos add constraint atendimentos_forma_pagamento_check
  check (forma_pagamento is null or forma_pagamento in ('dinheiro', 'pix', 'credito', 'debito', 'outro'));
