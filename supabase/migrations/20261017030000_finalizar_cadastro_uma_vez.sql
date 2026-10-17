-- finalizar_cadastro_barbearia: uma conta = uma barbearia, e o e-mail gravado
-- é o da própria conta (senha ou Google), não o digitado no formulário.
create or replace function public.finalizar_cadastro_barbearia(p_empresa text, p_nome text, p_whatsapp text, p_email text, p_whatsapp_barbearia text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_email text := coalesce(nullif(auth.jwt() ->> 'email', ''), p_email);
  v_existing_id bigint;
  v_barbearia_id bigint;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'nao_autenticado');
  end if;

  if exists (select 1 from profissionais where auth_user_id = v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'ja_cadastrado');
  end if;

  select id into v_existing_id
  from barbearias
  where whatsapp_barbearia = public.normalizar_telefone(p_whatsapp_barbearia);

  if v_existing_id is not null then
    return jsonb_build_object('ok', false, 'reason', 'duplicado');
  end if;

  insert into barbearias (empresa, email, whatsapp, whatsapp_barbearia, tipo)
  values (p_empresa, v_email, p_whatsapp, p_whatsapp_barbearia, 'Barbearia')
  returning id into v_barbearia_id;

  insert into profissionais (barbearia_id, auth_user_id, nome, email, acesso)
  values (v_barbearia_id, v_uid, p_nome, v_email, 'admin');

  return jsonb_build_object('ok', true);

exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'duplicado');
end;
$function$;
