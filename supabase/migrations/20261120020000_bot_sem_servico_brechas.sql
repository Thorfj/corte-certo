-- Bot ligado sem serviço: fecha as brechas que deixaram a Barbearia Matriz com o bot ligado e 0 serviços.
-- 1) A trava valia só para UPDATE: agora vale também para INSERT.
-- 2) Apagar o último serviço com o bot ligado deixava o bot ligado sem serviço: agora é bloqueado.
-- 3) A Matriz ligou o bot (17/11 14:49) antes de a trava existir: o bot é desligado e a contagem do
--    teste volta a zero. Os dias (30, pela Black Friday, se ligar até 15/12) começam quando ela
--    cadastrar um serviço e ligar o bot de verdade.

drop trigger if exists trg_bot_exige_servico on public.barbearias;

create or replace function public.bot_exige_servico()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.status_fluxo = 'Sim'
     and (tg_op = 'INSERT' or old.status_fluxo is distinct from 'Sim')
     and not exists (select 1 from public.servicos s where s.barbearia_id = new.id) then
    raise exception 'Cadastre pelo menos um serviço antes de ligar o bot.'
      using errcode = 'P0001', hint = 'sem_servicos';
  end if;
  return new;
end;
$$;

create trigger trg_bot_exige_servico
  before insert or update of status_fluxo on public.barbearias
  for each row execute function public.bot_exige_servico();

-- não deixa apagar (ou mover) o último serviço enquanto o bot está ligado
create or replace function public.servico_ultimo_com_bot_ligado()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if tg_op = 'UPDATE' and new.barbearia_id is not distinct from old.barbearia_id then
    return new;
  end if;
  if exists (select 1 from public.barbearias b where b.id = old.barbearia_id and b.status_fluxo = 'Sim')
     and not exists (select 1 from public.servicos s where s.barbearia_id = old.barbearia_id and s.id <> old.id) then
    raise exception 'Esse é o único serviço cadastrado e o bot está ligado. Cadastre outro serviço ou desligue o bot antes de excluir.'
      using errcode = 'P0001', hint = 'ultimo_servico';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_servico_ultimo_com_bot on public.servicos;
create trigger trg_servico_ultimo_com_bot
  before delete or update of barbearia_id on public.servicos
  for each row execute function public.servico_ultimo_com_bot_ligado();

-- corrige quem já está com o bot ligado e nenhum serviço (hoje só a Barbearia Matriz)
update public.barbearias b
set status_fluxo = 'Não',
    trial_iniciado_em = null,
    config_concluida = false
where b.status_fluxo = 'Sim'
  and not coalesce(b.cliente, false)
  and not exists (select 1 from public.servicos s where s.barbearia_id = b.id);
