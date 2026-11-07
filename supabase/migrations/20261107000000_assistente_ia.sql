-- Assistente de IA do dono no WhatsApp (fluxo "Assistente do dono" no n8n).
--
-- O n8n identifica a barbearia pelo número de quem mandou a mensagem
-- (assistente_identificar) e chama as consultas abaixo SEMPRE com esse
-- barbearia_id; a IA só escolhe qual consulta e quais datas. Tudo é só
-- leitura e só a service role (n8n) executa.
--
-- Regras de número (as mesmas da tela Financeiro):
--   realizado = horário já passou e o cliente não faltou
--   recebido  = realizado e pago | a receber = realizado e pendente
--   previsto  = ainda vai acontecer | falta = compareceu = false

create or replace function public.assistente_hoje()
returns date
language sql
stable
as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

-- Quem está falando: o WhatsApp do dono cadastrado na barbearia
create or replace function public.assistente_identificar(p_telefone text)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'barbearia_id', b.id,
    'empresa', b.empresa,
    'nome_dono', (select p.nome from profissionais p
                  where p.barbearia_id = b.id and p.acesso = 'admin' and p.removido_em is null
                  order by p.id limit 1),
    'hoje', public.assistente_hoje()
  )
  from barbearias b
  -- compara DDD + 8 últimos dígitos: o WhatsApp às vezes manda o celular sem o 9
  where right(regexp_replace(b.whatsapp, '\D', '', 'g'), 8) = right(regexp_replace(p_telefone, '\D', '', 'g'), 8)
    and substr(regexp_replace(regexp_replace(b.whatsapp, '\D', '', 'g'), '^55', ''), 1, 2)
      = substr(regexp_replace(regexp_replace(p_telefone, '\D', '', 'g'), '^55', ''), 1, 2)
  order by b.id desc
  limit 1;
$$;

-- Números do período: faturamento, recebido, a receber, faltas, por profissional,
-- por serviço e por forma de pagamento
create or replace function public.assistente_resumo(p_barbearia_id bigint, p_inicio date, p_fim date)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  with a as (
    select at.*,
      case
        when at.compareceu = false then 'falta'
        when (at.data_agend + coalesce(at.horario, '00:00')) <= (now() at time zone 'America/Sao_Paulo') then 'realizado'
        else 'previsto'
      end as situacao
    from atendimentos at
    where at.barbearia_id = p_barbearia_id
      and at.data_agend between p_inicio and p_fim
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('inicio', p_inicio, 'fim', p_fim),
    'atendimentos_realizados', (select count(*) from a where situacao = 'realizado'),
    'faturamento', (select coalesce(sum(custo), 0) from a where situacao = 'realizado'),
    'recebido', (select coalesce(sum(custo), 0) from a where situacao = 'realizado' and pagamento = 'pago'),
    'a_receber', (select coalesce(sum(custo), 0) from a where situacao = 'realizado' and pagamento = 'pendente'),
    'ticket_medio', (select round(avg(custo), 2) from a where situacao = 'realizado'),
    'previstos', (select count(*) from a where situacao = 'previsto'),
    'valor_previsto', (select coalesce(sum(custo), 0) from a where situacao = 'previsto'),
    'faltas', (select count(*) from a where situacao = 'falta'),
    'nps_medio', (select round(avg(nps), 1) from a where nps is not null),
    'por_profissional', coalesce((
      select jsonb_agg(x order by x->>'faturamento' desc) from (
        select jsonb_build_object(
          'profissional', p.nome,
          'atendimentos', count(*) filter (where a.situacao = 'realizado'),
          'faturamento', coalesce(sum(a.custo) filter (where a.situacao = 'realizado'), 0),
          'faltas', count(*) filter (where a.situacao = 'falta'),
          'nps_medio', round(avg(a.nps), 1)
        ) as x
        from a join profissionais p on p.id = a.id_prof
        group by p.nome
      ) t
    ), '[]'::jsonb),
    'por_servico', coalesce((
      select jsonb_agg(jsonb_build_object('servico', nome, 'quantidade', qtd, 'faturamento', total) order by total desc)
      from (
        select s.nome, count(*) as qtd, coalesce(sum(ats.preco_cobrado), 0) as total
        from a
        join atendimento_servicos ats on ats.id_atend = a.id
        join servicos s on s.id = ats.servico_id
        where a.situacao = 'realizado'
        group by s.nome
      ) t
    ), '[]'::jsonb),
    'por_forma_pagamento', coalesce((
      select jsonb_agg(jsonb_build_object('forma', forma, 'valor', total) order by total desc)
      from (
        select coalesce(forma_pagamento, 'não informada') as forma, sum(custo) as total
        from a where situacao = 'realizado' and pagamento = 'pago'
        group by 1
      ) t
    ), '[]'::jsonb)
  );
$$;

-- Agenda de um dia: horário de funcionamento, bloqueios e atendimentos marcados
create or replace function public.assistente_agenda(p_barbearia_id bigint, p_data date)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'data', p_data,
    'dia_da_semana', (array['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'])[extract(dow from p_data)::int + 1],
    'funcionamento', (select b.horario_funcionamento -> (extract(dow from p_data)::int)::text
                      from barbearias b where b.id = p_barbearia_id),
    'bloqueios', coalesce((
      select jsonb_agg(jsonb_build_object(
        'profissional', coalesce(p.nome, 'todos'),
        'inicio', bl.horario_inicio, 'fim', bl.horario_fim, 'motivo', bl.motivo))
      from bloqueios_agenda bl
      left join profissionais p on p.id = bl.id_prof
      where bl.barbearia_id = p_barbearia_id
        and ((bl.tipo = 'unico' and bl.data_inicio = p_data)
          or (bl.tipo = 'periodo' and p_data between bl.data_inicio and bl.data_fim)
          or (bl.tipo = 'recorrente' and bl.dia_semana = extract(dow from p_data)::int))
    ), '[]'::jsonb),
    'atendimentos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'horario', to_char(at.horario, 'HH24:MI'),
        'duracao_min', at.duracao_atend,
        'cliente', coalesce(c.nome, c.telefone),
        'profissional', p.nome,
        'servicos', (select string_agg(s.nome, ', ') from atendimento_servicos ats
                     join servicos s on s.id = ats.servico_id where ats.id_atend = at.id),
        'valor', at.custo,
        'pagamento', at.pagamento,
        'faltou', at.compareceu = false
      ) order by at.horario)
      from atendimentos at
      left join clientes c on c.id = at.id_cliente
      left join profissionais p on p.id = at.id_prof
      where at.barbearia_id = p_barbearia_id and at.data_agend = p_data
    ), '[]'::jsonb),
    'profissionais_que_atendem', coalesce((
      select jsonb_agg(p.nome order by p.nome) from profissionais p
      where p.barbearia_id = p_barbearia_id and p.removido_em is null and p.atende_clientes
    ), '[]'::jsonb)
  );
$$;

-- Quem ainda não pagou (atendimentos já realizados com pagamento pendente)
create or replace function public.assistente_pendentes(p_barbearia_id bigint)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  with pend as (
    select at.data_agend, at.horario, at.custo, c.nome as cliente, c.telefone, p.nome as profissional
    from atendimentos at
    left join clientes c on c.id = at.id_cliente
    left join profissionais p on p.id = at.id_prof
    where at.barbearia_id = p_barbearia_id
      and at.pagamento = 'pendente'
      and at.compareceu is distinct from false
      and (at.data_agend + coalesce(at.horario, '00:00')) <= (now() at time zone 'America/Sao_Paulo')
  )
  select jsonb_build_object(
    'quantidade', (select count(*) from pend),
    'total', (select coalesce(sum(custo), 0) from pend),
    'lista', coalesce((
      select jsonb_agg(jsonb_build_object(
        'cliente', coalesce(cliente, telefone), 'telefone', telefone, 'data', data_agend,
        'valor', custo, 'profissional', profissional) order by data_agend)
      from (select * from pend order by data_agend limit 30) t
    ), '[]'::jsonb)
  );
$$;

-- Clientes: sumidos, mais frequentes, novos ou busca por nome/telefone
create or replace function public.assistente_clientes(
  p_barbearia_id bigint,
  p_tipo text,
  p_busca text default null,
  p_dias integer default 40
)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'tipo', p_tipo,
    'total_clientes', (select count(*) from clientes where barbearia_id = p_barbearia_id),
    'clientes', coalesce((
      select jsonb_agg(x) from (
        select jsonb_build_object(
          'nome', coalesce(c.nome, 'sem nome'),
          'telefone', c.telefone,
          'status', c.status,
          'ultimo_atendimento', c.data_ult_agend,
          'dias_sem_vir', public.assistente_hoje() - c.data_ult_agend,
          'atendimentos_realizados', c.atend_realizados,
          'nps_medio', c.media_nps,
          'primeiro_atendimento', c.data_primeiro_agend,
          'ultimos_atendimentos', case when p_tipo = 'busca' then (
            select jsonb_agg(jsonb_build_object('data', at.data_agend, 'valor', at.custo,
                     'profissional', p.nome, 'pagamento', at.pagamento) order by at.data_agend desc)
            from (select * from atendimentos where id_cliente = c.id order by data_agend desc limit 5) at
            left join profissionais p on p.id = at.id_prof
          ) end
        ) as x
        from clientes c
        where c.barbearia_id = p_barbearia_id
          and case p_tipo
            when 'sumidos' then c.data_ult_agend <= public.assistente_hoje() - greatest(coalesce(p_dias, 40), 1)
                                and c.status is distinct from 'agendado'
            when 'novos' then c.data_primeiro_agend >= public.assistente_hoje() - greatest(coalesce(p_dias, 30), 1)
            when 'mais_frequentes' then coalesce(c.atend_realizados, 0) > 0
            when 'busca' then p_busca is not null and length(trim(p_busca)) >= 2
                              and (c.nome ilike '%' || trim(p_busca) || '%'
                                   or c.telefone like '%' || regexp_replace(p_busca, '\D', '', 'g') || '%')
            else false
          end
        order by
          case when p_tipo = 'mais_frequentes' then -coalesce(c.atend_realizados, 0) end,
          case when p_tipo = 'sumidos' then c.data_ult_agend end,
          case when p_tipo = 'novos' then c.data_primeiro_agend end desc,
          c.nome
        limit 20
      ) t
    ), '[]'::jsonb)
  );
$$;

-- Cadastro: serviços, profissionais, horário, teste/assinatura, link da página
create or replace function public.assistente_info(p_barbearia_id bigint)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'empresa', b.empresa,
    'bot_ligado', b.status_fluxo = 'Sim',
    'assinatura', case when b.cliente then 'ativa' else b.status_assinatura end,
    -- 14 dias de teste + 7 de carência, contados de quando o bot foi ligado
    'teste_gratis', case when b.trial_iniciado_em is not null and not coalesce(b.cliente, false) then jsonb_build_object(
      'termina_em', (b.trial_iniciado_em + interval '14 days')::date,
      'carencia_ate', (b.trial_iniciado_em + interval '21 days')::date) end,
    'horario_funcionamento', b.horario_funcionamento,
    'landing_page', case when b.landing_publicada and b.slug is not null
                         then 'barbozap.com.br/b/' || b.slug end,
    'servicos', coalesce((
      select jsonb_agg(jsonb_build_object('nome', s.nome, 'preco', s.preco, 'duracao_min', s.duracao_min) order by s.nome)
      from servicos s where s.barbearia_id = b.id
    ), '[]'::jsonb),
    'profissionais', coalesce((
      select jsonb_agg(jsonb_build_object('nome', p.nome, 'acesso', p.acesso, 'atende_clientes', p.atende_clientes) order by p.nome)
      from profissionais p where p.barbearia_id = b.id and p.removido_em is null
    ), '[]'::jsonb)
  )
  from barbearias b
  where b.id = p_barbearia_id;
$$;

-- Só o n8n (service role) executa
revoke all on function public.assistente_identificar(text) from public, anon, authenticated;
revoke all on function public.assistente_resumo(bigint, date, date) from public, anon, authenticated;
revoke all on function public.assistente_agenda(bigint, date) from public, anon, authenticated;
revoke all on function public.assistente_pendentes(bigint) from public, anon, authenticated;
revoke all on function public.assistente_clientes(bigint, text, text, integer) from public, anon, authenticated;
revoke all on function public.assistente_info(bigint) from public, anon, authenticated;
grant execute on function public.assistente_identificar(text) to service_role;
grant execute on function public.assistente_resumo(bigint, date, date) to service_role;
grant execute on function public.assistente_agenda(bigint, date) to service_role;
grant execute on function public.assistente_pendentes(bigint) to service_role;
grant execute on function public.assistente_clientes(bigint, text, text, integer) to service_role;
grant execute on function public.assistente_info(bigint) to service_role;
