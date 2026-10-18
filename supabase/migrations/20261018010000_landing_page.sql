-- Landing page pública de cada barbearia: barbozap.com.br/b/<slug>
-- Sem foto por enquanto. A página só lê o que a função pagina_publica()
-- devolve (nada de clientes, e-mails ou dados internos).

alter table public.barbearias add column if not exists slug text;
alter table public.barbearias add column if not exists landing_publicada boolean not null default false;
alter table public.barbearias add column if not exists landing_descricao text;
alter table public.barbearias add column if not exists endereco text;
alter table public.barbearias add column if not exists instagram text;

alter table public.barbearias add constraint barbearias_slug_formato
  check (slug is null or slug ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$');
create unique index if not exists barbearias_slug_unico on public.barbearias (slug) where slug is not null;

-- Endereços que não podem virar link de barbearia
create or replace function public.slug_reservado(p_slug text)
returns boolean
language sql
immutable
as $$
  select p_slug in ('app', 'admin', 'api', 'blog', 'b', 'barbozap', 'teste-gratis', 'privacidade',
                    'termos-de-uso', 'oauth', 'assets', 'login', 'suporte', 'contato', 'www');
$$;

-- CRM: "esse link está livre?" (ignora a própria barbearia)
create or replace function public.slug_disponivel(p_slug text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select p_slug ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$'
     and not public.slug_reservado(p_slug)
     and not exists (
       select 1 from public.barbearias b
       where b.slug = p_slug and b.id is distinct from public.current_barbearia_id()
     );
$$;
grant execute on function public.slug_disponivel(text) to authenticated;

-- Página pública: só barbearias publicadas, só dados de vitrine
create or replace function public.pagina_publica(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'slug', b.slug,
    'empresa', b.empresa,
    'descricao', b.landing_descricao,
    'endereco', b.endereco,
    'instagram', b.instagram,
    'whatsapp', b.whatsapp_barbearia,
    'horario_funcionamento', b.horario_funcionamento,
    'agendamento_online', (b.status_fluxo = 'Sim' and b.whatsapp_barbearia is not null),
    'servicos', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome, 'preco', s.preco, 'duracao_min', s.duracao_min) order by s.nome)
      from public.servicos s where s.barbearia_id = b.id
    ), '[]'::jsonb),
    'profissionais', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome) order by p.nome)
      from public.profissionais p where p.barbearia_id = b.id and p.removido_em is null
    ), '[]'::jsonb)
  )
  from public.barbearias b
  where b.slug = lower(p_slug) and b.landing_publicada;
$$;
grant execute on function public.pagina_publica(text) to anon, authenticated;
