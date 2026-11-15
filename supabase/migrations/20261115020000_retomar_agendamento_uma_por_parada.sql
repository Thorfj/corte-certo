-- Retomar agendamento, regra final: cada vez que o cliente para de responder no mesmo agendamento
-- ele recebe UMA mensagem: 1ª parada → 1ª mensagem, 2ª parada → 2ª, 3ª parada → 3ª; da 4ª em diante, nada.
-- Cada mensagem espera o seu tempo desde a última resposta do cliente. A contagem zera quando
-- o agendamento termina (ou o fluxo recomeça do primeiro contato). Mensagem desligada: a parada
-- seguinte recebe a próxima ligada. (Aplicada no banco em 15/11/2026.)

alter table public.barbearias alter column retomada_tempos set default '{15,15,15}';
update public.barbearias set retomada_tempos = '{15,15,15}' where retomada_tempos = '{15,60,1440}';

create or replace function public.sessoes_marca_atividade()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.retomada_enviada_em is distinct from old.retomada_enviada_em
     or new.retomada_qtd is distinct from old.retomada_qtd then
    return new;
  end if;
  new.atualizado_em := now();
  if new.etapa_atual = 'concluido'
     or (new.etapa_atual = '00101' and old.etapa_atual is distinct from '00101') then
    new.retomada_qtd := 0;
    new.retomada_enviada_em := null;
  end if;
  return new;
end;
$$;

create or replace function public.mensagem_padrao_fluxo(p_id_msg text)
returns text
language sql
immutable
set search_path = public
as $$
  select case p_id_msg
    when '00101' then E'Olá! 👋 Que bom ter você por aqui.\nEu sou o assistente de agendamentos e vou te ajudar a marcar seu horário em poucos passos.\n\nPara começar, qual é o seu nome?'
    when '00201' then E'Qual serviço você quer agendar? ✂️\nResponda com o número (se quiser mais de um, separe por vírgula, ex: 1, 2):'
    when '00301' then E'Com quem você prefere ser atendido? Responda com o número:'
    when '00401' then E'Para qual dia você quer agendar? 📅\nPode responder com a data (ex: 25/10), "hoje", "amanhã" ou o dia da semana.'
    when '00501' then E'Esses são os horários livres ⏰ Responda com o número da opção:'
    when '00202' then E'Certo! Já avisei a equipe e logo alguém te responde por aqui. 🙂'
    when '00601' then E'Qual é o seu e-mail? Vamos usar só para enviar a confirmação do seu horário.'
    when '00701' then E'Oi {nome}! Passando para lembrar do seu horário amanhã ({data}) às {horario}. 💈\nSe precisar, é só responder "remarcar" ou "cancelar".'
    when '00801' then E'Oi {nome}! Seu horário é daqui a pouco, às {horario}. Te esperamos! 💈'
    when '00901' then E'Oi {nome}! Obrigado pela visita hoje 🙏\nDe 1 a 5, que nota você dá para o seu atendimento? Responda só com o número.'
    when '00203' then E'Oi {nome}, sentimos sua falta hoje! 😕\nQuer marcar um novo horário? É só responder "oi" que eu te ajudo.'
    when '00204' then E'Oi {nome}! Vi que a gente não terminou seu agendamento 😊\nÉ só responder a última pergunta que eu sigo daqui.'
    when '00205' then E'{nome}, falta pouco pra garantir seu horário! ✂️\nMe responde aqui que eu continuo.'
    when '00206' then E'Oi {nome}! Seu agendamento está quase pronto, só falta confirmar 💈\nMe responde aqui pra garantir o horário.'
    when '900' then E'Desculpe, não entendi 😅'
  end;
$$;

update public.fluxo_mensagens set mensagem = public.mensagem_padrao_fluxo('00204')
 where etapa = 'Retomar agendamento 1' and mensagem = E'Oi {nome}! Vi que a gente não terminou seu agendamento 😊\nQuer continuar? É só responder a última pergunta que eu sigo daqui.';
update public.fluxo_mensagens set mensagem = public.mensagem_padrao_fluxo('00205')
 where etapa = 'Retomar agendamento 2' and mensagem = E'Oi {nome}! Ainda dá tempo de garantir seu horário ✂️\nÉ só me responder aqui que eu continuo o seu agendamento.';
update public.fluxo_mensagens set mensagem = public.mensagem_padrao_fluxo('00206')
 where etapa = 'Retomar agendamento 3' and mensagem = E'Oi {nome}! Vou deixar seu agendamento em aberto por aqui. Quando quiser marcar, é só mandar um "oi" que eu te ajudo 💈';

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
           (select min(i) from generate_series(s.retomada_qtd + 1, 3) i
             where b.retomada_tempos[i] is not null) as prox
    from public.sessoes s
    join public.barbearias b on b.id = s.barbearia_id
    join public.clientes c on c.id = s.id_cliente
    where s.aguardando_resposta
      and coalesce(s.etapa_atual, '') <> 'concluido'
      and s.retomada_qtd < 3
      and (s.retomada_enviada_em is null or s.retomada_enviada_em < s.atualizado_em)
      and b.status_fluxo = 'Sim'
      and b.whatsapp_barbearia is not null
      and coalesce(c.status, '') not in ('falar_com_humano', 'perdido')
      and c.telefone is not null
      and s.atualizado_em >= now() - interval '7 days'
  )
  select x.id, x.barbearia_id, x.id_cliente, x.etapa_atual, x.telefone, x.nome, x.whatsapp_barbearia, x.prox,
         coalesce(nullif(trim(f.mensagem), ''), public.mensagem_padrao_fluxo('0020' || (x.prox + 3)::text))
  from base x
  left join public.fluxo_mensagens f on f.barbearia_id = x.barbearia_id and f.etapa = 'Retomar agendamento ' || x.prox
  where x.prox is not null
    and x.atualizado_em <= now() - make_interval(mins => x.retomada_tempos[x.prox]);
$$;

revoke all on function public.sessoes_para_retomar() from public, anon, authenticated;
grant execute on function public.sessoes_para_retomar() to service_role;
