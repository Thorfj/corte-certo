-- Retomar agendamento: até 3 mensagens em sequência, cada uma com seu tempo de espera
-- (contado a partir da anterior; a 1ª a partir da última resposta do cliente). Sem regra de horário.
-- (Aplicada no banco em 15/11/2026.)

alter table public.barbearias add column if not exists retomada_tempos integer[] default '{15,60,1440}';
update public.barbearias set retomada_tempos = array[retomada_minutos, 60, 1440];
alter table public.barbearias drop constraint if exists barbearias_retomada_minutos_check;
alter table public.barbearias drop column if exists retomada_minutos;
alter table public.barbearias drop constraint if exists barbearias_retomada_tempos_check;
alter table public.barbearias add constraint barbearias_retomada_tempos_check
  check (retomada_tempos is null or (array_length(retomada_tempos, 1) <= 3));

alter table public.sessoes add column if not exists retomada_qtd integer not null default 0;

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
  new.retomada_enviada_em := null;
  new.retomada_qtd := 0;
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
    when '00204' then E'Oi {nome}! Vi que a gente não terminou seu agendamento 😊\nQuer continuar? É só responder a última pergunta que eu sigo daqui.'
    when '00205' then E'Oi {nome}! Ainda dá tempo de garantir seu horário ✂️\nÉ só me responder aqui que eu continuo o seu agendamento.'
    when '00206' then E'Oi {nome}! Vou deixar seu agendamento em aberto por aqui. Quando quiser marcar, é só mandar um "oi" que eu te ajudo 💈'
    when '900' then E'Desculpe, não entendi 😅'
  end;
$$;

create or replace function public.seed_fluxo_mensagens_padrao(p_barbearia_id bigint)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  insert into public.fluxo_mensagens (barbearia_id, id_msg, etapa, mensagem, variaveis_captadas)
  select p_barbearia_id, m.id_msg, m.etapa, public.mensagem_padrao_fluxo(m.id_msg), m.variaveis
  from (values
    ('00101', 'Primeiro contato',        '{nome}'),
    ('00201', 'Escolha de Serviço',      '{SKU}'),
    ('00301', 'Escolha do profissional', '{ID_Prof}'),
    ('00401', 'Marcar o dia',            '{dia}'),
    ('00501', 'Marcar o Horário',        '{horario}'),
    ('00202', 'Atendimento humano',      null),
    ('00601', 'Pede o Email',            '{E-mail}'),
    ('00701', 'Aviso um dia antes',      null),
    ('00801', 'Aviso uma hora antes',    null),
    ('00901', 'NPS atendimento',         '{nps}'),
    ('00203', 'Remarcar após falta',     null),
    ('00204', 'Retomar agendamento 1',   null),
    ('00205', 'Retomar agendamento 2',   null),
    ('00206', 'Retomar agendamento 3',   null),
    ('900',   'Não entendi a resposta',  null)
  ) as m(id_msg, etapa, variaveis)
  on conflict do nothing;
end;
$function$;

update public.fluxo_mensagens set etapa = 'Retomar agendamento 1' where etapa = 'Retomar agendamento';
insert into public.fluxo_mensagens (barbearia_id, id_msg, etapa, mensagem, variaveis_captadas)
select b.id, m.id_msg, m.etapa, public.mensagem_padrao_fluxo(m.id_msg), null
from public.barbearias b
cross join (values ('00205', 'Retomar agendamento 2'), ('00206', 'Retomar agendamento 3')) as m(id_msg, etapa)
where not exists (select 1 from public.fluxo_mensagens f where f.barbearia_id = b.id and f.etapa = m.etapa);

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
  select s.id, s.barbearia_id, s.id_cliente, s.etapa_atual,
         c.telefone, c.nome, b.whatsapp_barbearia, s.retomada_qtd + 1,
         coalesce(nullif(trim(f.mensagem), ''), public.mensagem_padrao_fluxo('0020' || (s.retomada_qtd + 4)::text))
  from public.sessoes s
  join public.barbearias b on b.id = s.barbearia_id
  join public.clientes c on c.id = s.id_cliente
  left join public.fluxo_mensagens f
    on f.barbearia_id = s.barbearia_id and f.etapa = 'Retomar agendamento ' || (s.retomada_qtd + 1)
  where s.aguardando_resposta
    and coalesce(s.etapa_atual, '') <> 'concluido'
    and s.retomada_qtd < 3
    and b.retomada_tempos[s.retomada_qtd + 1] is not null
    and b.status_fluxo = 'Sim'
    and b.whatsapp_barbearia is not null
    and coalesce(c.status, '') not in ('falar_com_humano', 'perdido')
    and c.telefone is not null
    and coalesce(s.retomada_enviada_em, s.atualizado_em)
        <= now() - make_interval(mins => b.retomada_tempos[s.retomada_qtd + 1])
    and s.atualizado_em >= now() - interval '7 days';
$$;

revoke all on function public.sessoes_para_retomar() from public, anon, authenticated;
grant execute on function public.sessoes_para_retomar() to service_role;
