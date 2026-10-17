-- proteger_campos_barbearia:
--   - ligar o fluxo pela primeira vez (Mensagens) também inicia os 14 dias,
--     como a Ajuda já dizia (antes ficava em "configurando" para sempre);
--   - "cliente" não muda mais pelo navegador; o cancelamento é pela Edge
--     Function cancelar-assinatura, que cancela no Asaas de verdade.
create or replace function public.proteger_campos_barbearia()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.status_assinatura is distinct from old.status_assinatura
     or new.subscription_status is distinct from old.subscription_status
     or new.asaas_customer_id is distinct from old.asaas_customer_id
     or new.asaas_subscription_id is distinct from old.asaas_subscription_id
     or new.proximo_vencimento is distinct from old.proximo_vencimento
     or new.trial_iniciado_em is distinct from old.trial_iniciado_em
     or new.config_concluida is distinct from old.config_concluida
     or new.google_calendar_status is distinct from old.google_calendar_status
     or new.google_calendar_email is distinct from old.google_calendar_email
     or new.criado_em is distinct from old.criado_em then
    raise exception 'Esse dado da barbearia só pode ser alterado pelo sistema.' using errcode = '42501';
  end if;

  if new.cliente is distinct from old.cliente then
    raise exception 'A assinatura só muda pelo sistema de pagamento.' using errcode = '42501';
  end if;

  if new.status_fluxo = 'Sim' and old.status_fluxo is distinct from 'Sim'
     and (select fase from public.status_teste()) in ('grace', 'bloqueado') then
    raise exception 'Seu período de teste acabou. Assine o plano para reativar o fluxo.' using errcode = '42501';
  end if;

  if new.status_fluxo = 'Sim' and old.status_fluxo is distinct from 'Sim'
     and old.trial_iniciado_em is null and not coalesce(old.cliente, false) then
    new.trial_iniciado_em := now();
    new.config_concluida := true;
  end if;

  return new;
end;
$function$;
