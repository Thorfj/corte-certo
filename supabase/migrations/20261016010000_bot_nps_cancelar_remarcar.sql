-- Bot: captura da nota de NPS e cancelamento/remarcação pelo WhatsApp.

-- Atendimento que o cliente está cancelando (aguardando o "SIM") ou remarcando.
alter table public.sessoes
  add column if not exists id_atend_alvo bigint;

-- clientes.media_nps passa a ser mantida pelo banco, venha a nota do bot ou do CRM.
create or replace function public.recalc_media_nps_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente bigint := coalesce(new.id_cliente, old.id_cliente);
begin
  update public.clientes c
  set media_nps = (select round(avg(a.nps)::numeric, 1) from public.atendimentos a where a.id_cliente = v_cliente and a.nps is not null)
  where c.id = v_cliente;
  if tg_op = 'UPDATE' and old.id_cliente is distinct from new.id_cliente then
    update public.clientes c
    set media_nps = (select round(avg(a.nps)::numeric, 1) from public.atendimentos a where a.id_cliente = old.id_cliente and a.nps is not null)
    where c.id = old.id_cliente;
  end if;
  return null;
end;
$$;

revoke execute on function public.recalc_media_nps_cliente() from public, anon, authenticated;

drop trigger if exists trg_media_nps on public.atendimentos;
create trigger trg_media_nps
  after insert or delete or update of nps, id_cliente on public.atendimentos
  for each row execute function public.recalc_media_nps_cliente();
