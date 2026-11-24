-- Agendamento direto pela landing page (/b/<link>).
-- O cliente escolhe serviços, dia, horário e (se quiser) o profissional,
-- informa nome, WhatsApp e e-mail (opcional), e o atendimento é criado na hora.
--
-- As regras de horário livre são as mesmas do bot (n8n, etapa 00501):
--   * horário de funcionamento da barbearia (padrão seg-sáb 09:00-19:00);
--   * passos de 30 min, o serviço precisa terminar até o fechamento;
--   * hoje, só a partir de agora + 30 min (horário de Brasília);
--   * bloqueios da agenda (únicos, períodos e recorrentes, gerais ou do profissional;
--     inclui os que vêm do Google Calendar pela sincronização);
--   * atendimentos já marcados do profissional (duração 0 conta como 30 min).

-- Pares (horário, profissional) livres. Interna: não é exposta para anon.
create or replace function public.pagina_slots_livres(p_barbearia bigint, p_duracao int, p_data date, p_prof bigint default null)
returns table (horario time, prof_id bigint, prof_nome text)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_faixa jsonb;
  v_horario jsonb;
  v_dow int := extract(dow from p_data)::int;
  v_agora timestamp := now() at time zone 'America/Sao_Paulo';
  v_ini int;
  v_fim int;
  v_t int;
  v_min_hoje int;
begin
  select coalesce(b.horario_funcionamento,
           '{"0":null,"1":["09:00","19:00"],"2":["09:00","19:00"],"3":["09:00","19:00"],"4":["09:00","19:00"],"5":["09:00","19:00"],"6":["09:00","19:00"]}'::jsonb)
    into v_horario
  from barbearias b where b.id = p_barbearia;

  v_faixa := v_horario -> v_dow::text;
  if v_faixa is null or jsonb_typeof(v_faixa) <> 'array' or jsonb_array_length(v_faixa) <> 2 then
    return;
  end if;

  v_ini := extract(epoch from (v_faixa ->> 0)::time)::int / 60;
  v_fim := extract(epoch from (v_faixa ->> 1)::time)::int / 60;
  v_min_hoje := extract(hour from v_agora)::int * 60 + extract(minute from v_agora)::int + 30;

  v_t := v_ini;
  while v_t + p_duracao <= v_fim loop
    if not (p_data = v_agora::date and v_t < v_min_hoje) and p_data >= v_agora::date then
      return query
        select make_time(v_t / 60, v_t % 60, 0), p.id, p.nome
        from profissionais p
        where p.barbearia_id = p_barbearia
          and p.removido_em is null
          and p.atende_clientes
          and (p_prof is null or p.id = p_prof)
          and not exists (
            select 1 from bloqueios_agenda bl
            where bl.barbearia_id = p_barbearia
              and (bl.id_prof is null or bl.id_prof = p.id)
              and (
                (bl.tipo = 'unico' and bl.data_inicio = p_data)
                or (bl.tipo = 'periodo' and p_data between bl.data_inicio and bl.data_fim)
                or (bl.tipo = 'recorrente' and bl.dia_semana = v_dow)
              )
              and (
                bl.horario_inicio is null or bl.horario_fim is null
                or (v_t < extract(epoch from bl.horario_fim)::int / 60
                    and v_t + p_duracao > extract(epoch from bl.horario_inicio)::int / 60)
              )
          )
          and not exists (
            select 1 from atendimentos a
            where a.id_prof = p.id
              and a.data_agend = p_data
              and v_t < extract(epoch from a.horario)::int / 60 + coalesce(nullif(a.duracao_atend, 0), 30)
              and v_t + p_duracao > extract(epoch from a.horario)::int / 60
          )
        order by p.nome;
    end if;
    v_t := v_t + 30;
  end loop;
end;
$$;
revoke execute on function public.pagina_slots_livres(bigint, int, date, bigint) from public, anon, authenticated;

-- Barbearia publicada + serviços válidos dela. Interna.
create or replace function public.pagina_contexto(p_slug text, p_servicos bigint[])
returns table (barbearia_id bigint, duracao int, total numeric, ok boolean)
language sql
stable
security definer
set search_path to 'public'
as $$
  with b as (
    select id from barbearias where slug = lower(p_slug) and landing_publicada
  ), s as (
    select s.* from servicos s, b
    where s.barbearia_id = b.id and s.id = any(coalesce(p_servicos, '{}'))
  )
  select b.id,
         coalesce((select sum(duracao_min) from s), 0)::int,
         coalesce((select sum(preco) from s), 0),
         (select count(*) from s) = coalesce(array_length(p_servicos, 1), 0)
           and coalesce(array_length(p_servicos, 1), 0) between 1 and 6
  from b;
$$;
revoke execute on function public.pagina_contexto(text, bigint[]) from public, anon, authenticated;

-- Página: horários livres de um dia, com quem está livre em cada horário.
create or replace function public.pagina_horarios(p_slug text, p_servicos bigint[], p_data date)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  c record;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select * into c from pagina_contexto(p_slug, p_servicos);
  if c.barbearia_id is null then
    return jsonb_build_object('ok', false, 'reason', 'pagina_nao_encontrada');
  end if;
  if not c.ok then
    return jsonb_build_object('ok', false, 'reason', 'servicos_invalidos');
  end if;
  if p_data is null or p_data < v_hoje or p_data > v_hoje + 60 then
    return jsonb_build_object('ok', false, 'reason', 'data_invalida');
  end if;

  return jsonb_build_object(
    'ok', true,
    'data', p_data,
    'duracao', c.duracao,
    'horarios', coalesce((
      select jsonb_agg(jsonb_build_object('horario', to_char(x.horario, 'HH24:MI'), 'profissionais', x.profs) order by x.horario)
      from (
        select horario, jsonb_agg(jsonb_build_object('id', prof_id, 'nome', prof_nome) order by prof_nome) profs
        from pagina_slots_livres(c.barbearia_id, c.duracao, p_data, null)
        group by horario
      ) x
    ), '[]'::jsonb)
  );
end;
$$;
grant execute on function public.pagina_horarios(text, bigint[], date) to anon, authenticated;

-- Página: cria o agendamento.
create or replace function public.pagina_agendar(
  p_slug text, p_servicos bigint[], p_data date, p_horario text, p_prof bigint, p_nome text, p_telefone text,
  p_email text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare
  c record;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_horario time;
  v_nome text := left(btrim(regexp_replace(coalesce(p_nome, ''), '\s+', ' ', 'g')), 60);
  v_tel text := public.normalizar_telefone(p_telefone);
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_slot record;
  v_cliente bigint;
  v_atend bigint;
  v_futuros int;
begin
  select * into c from pagina_contexto(p_slug, p_servicos);
  if c.barbearia_id is null then
    return jsonb_build_object('ok', false, 'reason', 'pagina_nao_encontrada');
  end if;
  if not c.ok then
    return jsonb_build_object('ok', false, 'reason', 'servicos_invalidos');
  end if;
  if p_data is null or p_data < v_hoje or p_data > v_hoje + 60 or coalesce(p_horario, '') !~ '^\d{2}:\d{2}$' then
    return jsonb_build_object('ok', false, 'reason', 'data_invalida');
  end if;
  if length(v_nome) < 2 then
    return jsonb_build_object('ok', false, 'reason', 'nome_invalido');
  end if;
  if v_tel is null or v_tel !~ '^55\d{10,11}$' then
    return jsonb_build_object('ok', false, 'reason', 'telefone_invalido');
  end if;
  if v_email is not null and (length(v_email) > 120 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    return jsonb_build_object('ok', false, 'reason', 'email_invalido');
  end if;
  v_horario := p_horario::time;

  -- uma reserva por vez na barbearia: dois clientes não pegam o mesmo horário
  perform pg_advisory_xact_lock(hashtext('pagina_agendar'), c.barbearia_id::int);

  select * into v_slot
  from pagina_slots_livres(c.barbearia_id, c.duracao, p_data, p_prof)
  where horario = v_horario
  order by prof_nome
  limit 1;
  if v_slot.prof_id is null then
    return jsonb_build_object('ok', false, 'reason', 'horario_ocupado');
  end if;

  insert into clientes (barbearia_id, telefone, nome, email, data_primeiro_contato)
  values (c.barbearia_id, v_tel, v_nome, v_email, v_hoje)
  on conflict (barbearia_id, telefone) do update
    set nome = coalesce(nullif(clientes.nome, ''), excluded.nome),
        email = coalesce(excluded.email, clientes.email)
  returning id into v_cliente;

  -- evita reservas em massa pelo mesmo número
  select count(*) into v_futuros from atendimentos where id_cliente = v_cliente and data_agend >= v_hoje;
  if v_futuros >= 3 then
    return jsonb_build_object('ok', false, 'reason', 'limite');
  end if;

  insert into atendimentos (barbearia_id, id_cliente, id_prof, data_agend, horario)
  values (c.barbearia_id, v_cliente, v_slot.prof_id, p_data, v_horario)
  returning id into v_atend;

  insert into atendimento_servicos (id_atend, servico_id, preco_cobrado, duracao_cobrada)
  select v_atend, s.id, s.preco, s.duracao_min
  from servicos s
  where s.barbearia_id = c.barbearia_id and s.id = any(p_servicos);

  update clientes
  set status = 'agendado',
      data_ult_agend = p_data,
      data_primeiro_agend = coalesce(data_primeiro_agend, p_data)
  where id = v_cliente;

  return jsonb_build_object(
    'ok', true,
    'data', p_data,
    'horario', to_char(v_horario, 'HH24:MI'),
    'profissional', v_slot.prof_nome,
    'duracao', c.duracao,
    'total', c.total
  );
end;
$$;
grant execute on function public.pagina_agendar(text, bigint[], date, text, bigint, text, text, text) to anon, authenticated;
