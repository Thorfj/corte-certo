-- Mensagens padrão do bot (o admin troca em CRM > Mensagens).
-- Substitui o texto-modelo "[Escreva aqui ...]" que era criado para cada barbearia nova.

create or replace function public.mensagem_padrao_fluxo(p_id_msg text)
returns text
language sql
immutable
set search_path = public
as $$
  -- As etapas 00201/00301/00501 completam a mensagem com a lista (serviços, profissionais, horários).
  -- {nome}, {data} e {horario} funcionam nos lembretes, no NPS e na remarcação após falta.
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
    ('900',   'Não entendi a resposta',  null)
  ) as m(id_msg, etapa, variaveis)
  on conflict do nothing;
end;
$function$;

-- Barbearias existentes: só onde ainda estava vazio ou com o texto-modelo
update public.fluxo_mensagens
set mensagem = public.mensagem_padrao_fluxo(id_msg)
where (mensagem is null or mensagem ~ '^\s*\[')
  and public.mensagem_padrao_fluxo(id_msg) is not null;
