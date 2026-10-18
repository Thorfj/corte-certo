-- Nem todo usuário do CRM atende clientes (ex.: o dono que só administra,
-- a recepção). Quem tem atende_clientes = false continua entrando no CRM,
-- mas não aparece no bot, na agenda, na escolha de profissional nem na
-- landing page. Os atendimentos antigos dele continuam nos relatórios.
alter table public.profissionais
  add column if not exists atende_clientes boolean not null default true;

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
      from public.profissionais p
      where p.barbearia_id = b.id and p.removido_em is null and p.atende_clientes
    ), '[]'::jsonb)
  )
  from public.barbearias b
  where b.slug = lower(p_slug) and b.landing_publicada;
$$;
grant execute on function public.pagina_publica(text) to anon, authenticated;
