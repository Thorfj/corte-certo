-- Retomar agendamento: a barbearia adiciona e exclui mensagens (até 10). Continua uma por parada:
-- 1ª parada → 1ª mensagem, 2ª → 2ª... Depois da última, nada. (Aplicada no banco em 15/11/2026.)

alter table public.barbearias drop constraint if exists barbearias_retomada_tempos_check;
alter table public.barbearias add constraint barbearias_retomada_tempos_check
  check (retomada_tempos is null or coalesce(array_length(retomada_tempos, 1), 0) <= 10);

-- Salva a lista inteira de uma vez (renumera ao excluir do meio). Só o admin da própria barbearia.
create or replace function public.salvar_retomada(p_tempos integer[], p_mensagens text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_barb bigint := public.current_barbearia_id();
  v_n int := coalesce(array_length(p_mensagens, 1), 0);
  i int;
begin
  if v_barb is null or not public.e_admin() then
    raise exception 'Só o administrador da barbearia pode alterar essas mensagens.' using errcode = '42501';
  end if;
  if v_n <> coalesce(array_length(p_tempos, 1), 0) then
    raise exception 'Cada mensagem precisa de um tempo (ou desligada).';
  end if;
  if v_n > 10 then
    raise exception 'No máximo 10 mensagens de retomada.';
  end if;
  for i in 1..v_n loop
    if coalesce(trim(p_mensagens[i]), '') = '' then
      raise exception 'A % ª mensagem está vazia.', i;
    end if;
    if p_tempos[i] is not null and (p_tempos[i] < 1 or p_tempos[i] > 10080) then
      raise exception 'Tempo inválido na % ª mensagem.', i;
    end if;
  end loop;

  delete from public.fluxo_mensagens where barbearia_id = v_barb and etapa like 'Retomar agendamento %';
  insert into public.fluxo_mensagens (barbearia_id, id_msg, etapa, mensagem, variaveis_captadas)
  select v_barb, 'R' || lpad(n::text, 2, '0'), 'Retomar agendamento ' || n, trim(p_mensagens[n]), null
  from generate_series(1, v_n) n;

  update public.barbearias set retomada_tempos = coalesce(p_tempos, '{}') where id = v_barb;
end;
$$;

revoke all on function public.salvar_retomada(integer[], text[]) from public, anon;
grant execute on function public.salvar_retomada(integer[], text[]) to authenticated;

drop function if exists public.sessoes_para_retomar();
create function public.sessoes_para_retomar()
returns table (
  sessao_id bigint, barbearia_id bigint, id_cliente bigint, etapa_atual text,
  telefone text, nome text, instancia text, numero_retomada integer, mensagem text
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select s.*, b.retomada_tempos, b.whatsapp_barbearia, c.telefone, c.nome,
           (select min(i) from generate_series(s.retomada_qtd + 1, coalesce(array_length(b.retomada_tempos, 1), 0)) i
             where b.retomada_tempos[i] is not null) as prox
    from public.sessoes s
    join public.barbearias b on b.id = s.barbearia_id
    join public.clientes c on c.id = s.id_cliente
    where s.aguardando_resposta
      and coalesce(s.etapa_atual, '') <> 'concluido'
      and (s.retomada_enviada_em is null or s.retomada_enviada_em < s.atualizado_em)
      and b.status_fluxo = 'Sim'
      and b.whatsapp_barbearia is not null
      and coalesce(c.status, '') not in ('falar_com_humano', 'perdido')
      and c.telefone is not null
      and s.atualizado_em >= now() - interval '7 days'
  )
  select x.id, x.barbearia_id, x.id_cliente, x.etapa_atual, x.telefone, x.nome, x.whatsapp_barbearia, x.prox, f.mensagem
  from base x
  join public.fluxo_mensagens f on f.barbearia_id = x.barbearia_id and f.etapa = 'Retomar agendamento ' || x.prox
  where x.prox is not null
    and nullif(trim(f.mensagem), '') is not null
    and x.atualizado_em <= now() - make_interval(mins => x.retomada_tempos[x.prox]);
$$;

revoke all on function public.sessoes_para_retomar() from public, anon, authenticated;
grant execute on function public.sessoes_para_retomar() to service_role;
