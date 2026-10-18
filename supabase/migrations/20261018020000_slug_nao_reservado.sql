-- O CRM grava o slug direto na tabela: garante no banco que ninguém
-- usa um endereço reservado do site (app, blog, teste-gratis...).
alter table public.barbearias add constraint barbearias_slug_nao_reservado
  check (slug is null or not public.slug_reservado(slug));
