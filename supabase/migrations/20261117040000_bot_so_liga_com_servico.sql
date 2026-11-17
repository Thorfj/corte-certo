-- O bot só pode ser ligado (status_fluxo = 'Sim') se a barbearia tiver pelo menos um serviço cadastrado.
-- Sem serviço o bot não tem o que oferecer ao cliente (caso Barbearia Matriz, 17/11).
-- Vale para qualquer caminho (CRM, API). Barbearias que já estão ligadas continuam ligadas;
-- se ficarem sem serviço, o bot avisa o cliente e o dono (n8n, Etapa 00201).

create or replace function public.bot_exige_servico()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.status_fluxo = 'Sim'
     and old.status_fluxo is distinct from 'Sim'
     and not exists (select 1 from public.servicos s where s.barbearia_id = new.id) then
    raise exception 'Cadastre pelo menos um serviço antes de ligar o bot.'
      using errcode = 'P0001', hint = 'sem_servicos';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bot_exige_servico on public.barbearias;
create trigger trg_bot_exige_servico
  before update of status_fluxo on public.barbearias
  for each row execute function public.bot_exige_servico();
