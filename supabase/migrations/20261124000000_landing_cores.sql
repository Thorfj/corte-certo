-- Landing page: o dono escolhe a cor do fundo e a cor de destaque (botão,
-- preços, links). As cores de texto são calculadas na página (lp-cores.js)
-- para manter o contraste. Nulo = cores padrão do Barbozap.

alter table public.barbearias add column if not exists landing_cor_fundo text;
alter table public.barbearias add column if not exists landing_cor_destaque text;

alter table public.barbearias drop constraint if exists barbearias_landing_cor_fundo_formato;
alter table public.barbearias add constraint barbearias_landing_cor_fundo_formato
  check (landing_cor_fundo is null or landing_cor_fundo ~ '^#[0-9a-fA-F]{6}$');
alter table public.barbearias drop constraint if exists barbearias_landing_cor_destaque_formato;
alter table public.barbearias add constraint barbearias_landing_cor_destaque_formato
  check (landing_cor_destaque is null or landing_cor_destaque ~ '^#[0-9a-fA-F]{6}$');

create or replace function public.pagina_publica(p_slug text)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select jsonb_build_object(
    'slug', b.slug,
    'empresa', b.empresa,
    'descricao', b.landing_descricao,
    'endereco', b.endereco,
    'instagram', b.instagram,
    'whatsapp', b.whatsapp_barbearia,
    'horario_funcionamento', b.horario_funcionamento,
    'cor_fundo', b.landing_cor_fundo,
    'cor_destaque', b.landing_cor_destaque,
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
$function$;
