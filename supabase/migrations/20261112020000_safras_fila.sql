-- Fila de safras: a safra nova nasce 'na_fila' e o n8n só começa a enviar quando
-- não há safra mais antiga enviando ou na fila (duas safras nunca saem juntas).
alter table public.safras_prospeccao drop constraint if exists safras_prospeccao_status_check;
alter table public.safras_prospeccao add constraint safras_prospeccao_status_check
  check (status = any (array['previa', 'na_fila', 'enviando', 'concluida', 'cancelada']));
