-- Etapa 00501: o cliente responde com o horário (ex: 14:30), não com o número
-- da opção ("13" confundia: opção 13 ou 13h?). Troca o texto padrão e atualiza
-- as barbearias que ainda usam o texto antigo (quem personalizou fica como está).
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
    when '00501' then E'Esses são os horários livres ⏰ Responda com o horário que preferir (ex: 14:30):'
    when '00202' then E'Certo! Já avisei a equipe e logo alguém te responde por aqui. 🙂'
    when '00601' then E'Qual é o seu e-mail? Vamos usar só para enviar a confirmação do seu horário.'
    when '00701' then E'Oi {nome}! Passando para lembrar do seu horário amanhã ({data}) às {horario}. 💈\nSe precisar, é só responder "remarcar" ou "cancelar".'
    when '00801' then E'Oi {nome}! Seu horário é daqui a pouco, às {horario}. Te esperamos! 💈'
    when '00901' then E'Oi {nome}! Obrigado pela visita hoje 🙏\nDe 1 a 5, que nota você dá para o seu atendimento? Responda só com o número.'
    when '00203' then E'Oi {nome}, sentimos sua falta hoje! 😕\nQuer marcar um novo horário? É só responder "oi" que eu te ajudo.'
    when '900' then E'Desculpe, não entendi 😅'
  end;
$$;

update public.fluxo_mensagens
set mensagem = public.mensagem_padrao_fluxo('00501')
where id_msg = '00501'
  and mensagem = E'Esses são os horários livres ⏰ Responda com o número da opção:';
