-- Encerramento do follow-up (fluxo_followup.id_msg = '101'): mensagem que o bot
-- manda quando o cliente em follow-up pede para parar ("parar", "não quero mais"...).
-- Só a barbearia 1 tinha a linha (e vazia); o CRM não conseguia salvar nas outras.
create or replace function public.seed_encerramento_followup(p_barbearia_id bigint)
returns void
language sql
security definer
set search_path to 'public'
as $$
  insert into public.fluxo_followup (barbearia_id, id_msg, etapa, mensagem)
  select p_barbearia_id, '101', 'Encerramento do follow-up',
         E'Tudo bem! Você não vai mais receber nossos lembretes. 🙂\nQuando quiser agendar de novo, é só mandar um "oi" por aqui. 💈'
  where not exists (
    select 1 from public.fluxo_followup where barbearia_id = p_barbearia_id and id_msg = '101'
  );
$$;

-- barbearia nova já nasce com a mensagem (junto com as mensagens do bot)
create or replace function public.trg_seed_fluxo_mensagens()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform public.seed_fluxo_mensagens_padrao(new.id);
  perform public.seed_encerramento_followup(new.id);
  return new;
end;
$$;

-- barbearias existentes
select public.seed_encerramento_followup(id) from public.barbearias;

update public.fluxo_followup
set mensagem = E'Tudo bem! Você não vai mais receber nossos lembretes. 🙂\nQuando quiser agendar de novo, é só mandar um "oi" por aqui. 💈',
    etapa = coalesce(etapa, 'Encerramento do follow-up')
where id_msg = '101' and (mensagem is null or btrim(mensagem) = '' or mensagem like '[%');
