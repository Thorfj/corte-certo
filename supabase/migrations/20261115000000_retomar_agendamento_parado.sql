-- Retomar agendamento parado: se o cliente começa a marcar pelo WhatsApp e para de responder,
-- depois de X minutos (a barbearia escolhe em Mensagens > Mensagens Automáticas) o bot manda
-- a mensagem "Retomar agendamento" para ele continuar. Uma vez por parada, só das 8h às 21h.
-- Envio: workflow n8n "Barbozap - Retomar agendamento parado" (a cada 5 min, rpc sessoes_para_retomar).
-- (Aplicada no banco em 15/11/2026.)

alter table public.barbearias
  add column if not exists retomada_minutos integer default 15;
alter table public.barbearias drop constraint if exists barbearias_retomada_minutos_check;
alter table public.barbearias add constraint barbearias_retomada_minutos_check
  check (retomada_minutos is null or retomada_minutos between 5 and 1440);

alter table public.sessoes add column if not exists retomada_enviada_em timestamptz;

-- atualizado_em passa a marcar o último passo da conversa; a conversa andou = retomada zera
create or replace function public.sessoes_marca_atividade()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.retomada_enviada_em is distinct from old.retomada_enviada_em then
    return new;
  end if;
  new.atualizado_em := now();
  new.retomada_enviada_em := null;
  return new;
end;
$$;

drop trigger if exists trg_sessoes_marca_atividade on public.sessoes;
create trigger trg_sessoes_marca_atividade
  before update on public.sessoes
  for each row execute function public.sessoes_marca_atividade();

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
    ('00204', 'Retomar agendamento',     null),
    ('900',   'Não entendi a resposta',  null)
  ) as m(id_msg, etapa, variaveis)
  on conflict do nothing;
end;
$function$;

insert into public.fluxo_mensagens (barbearia_id, id_msg, etapa, mensagem, variaveis_captadas)
select b.id, '00204', 'Retomar agendamento', public.mensagem_padrao_fluxo('00204'), null
from public.barbearias b
where not exists (select 1 from public.fluxo_mensagens f where f.barbearia_id = b.id and f.etapa = 'Retomar agendamento');

create or replace function public.sessoes_para_retomar()
returns table (
  sessao_id bigint, barbearia_id bigint, id_cliente bigint, etapa_atual text,
  telefone text, nome text, instancia text, mensagem text
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.barbearia_id, s.id_cliente, s.etapa_atual,
         c.telefone, c.nome, b.whatsapp_barbearia,
         coalesce(nullif(trim(f.mensagem), ''), public.mensagem_padrao_fluxo('00204'))
  from public.sessoes s
  join public.barbearias b on b.id = s.barbearia_id
  join public.clientes c on c.id = s.id_cliente
  left join public.fluxo_mensagens f on f.barbearia_id = s.barbearia_id and f.etapa = 'Retomar agendamento'
  where s.aguardando_resposta
    and coalesce(s.etapa_atual, '') <> 'concluido'
    and s.retomada_enviada_em is null
    and b.status_fluxo = 'Sim'
    and b.whatsapp_barbearia is not null
    and b.retomada_minutos is not null
    and coalesce(c.status, '') not in ('falar_com_humano', 'perdido')
    and c.telefone is not null
    and s.atualizado_em <= now() - make_interval(mins => b.retomada_minutos)
    and s.atualizado_em >= now() - interval '24 hours'
    and extract(hour from now() at time zone 'America/Sao_Paulo') between 8 and 20;
$$;

revoke all on function public.sessoes_para_retomar() from public, anon, authenticated;
grant execute on function public.sessoes_para_retomar() to service_role;
