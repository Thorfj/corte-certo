-- CRM de prospecção da Central Interna (core/html/central.html).
-- Os leads vieram da planilha "BarboZap – Prospecção Curitiba"; as etapas do funil
-- passam a ser as mesmas da planilha: Novo, Contatado, Respondeu, Demo, Teste grátis,
-- Cliente e Perdido. "proposta_enviada" deixa de existir (vira Demo).
-- Os 100 leads da planilha foram importados direto no banco (origem = 'prospeccao');
-- os dados das barbearias não ficam no repositório.

alter table public.leads
  add column if not exists endereco text,
  add column if not exists tipo_telefone text,
  add column if not exists telefone_2 text,
  add column if not exists instagram text,
  add column if not exists fonte_url text,
  add column if not exists ultimo_contato timestamptz,
  add column if not exists proximo_passo text,
  add column if not exists data_proximo_passo date;

update public.leads set status = 'demo_agendada' where status = 'proposta_enviada';

alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads add constraint leads_status_check check (status in (
  'novo_lead', 'contato_feito', 'respondeu', 'demo_agendada', 'teste_gratis', 'fechado_ganho', 'perdido'
));

-- telefone guardado só com dígitos (5541999990000); evita lead duplicado
create unique index if not exists leads_telefone_unico on public.leads (telefone) where telefone is not null;
create index if not exists leads_data_proximo_passo on public.leads (data_proximo_passo) where data_proximo_passo is not null;

-- ---------------------------------------------------------------------------
-- Histórico do lead: mudanças de etapa (trigger), mensagens enviadas e notas
-- ---------------------------------------------------------------------------
create table if not exists public.lead_atividades (
  id bigint generated always as identity primary key,
  lead_id uuid not null references public.leads(id) on delete cascade,
  tipo text not null check (tipo in ('status', 'mensagem', 'nota')),
  descricao text,
  status_de text,
  status_para text,
  autor_id uuid references auth.users(id) default auth.uid(),
  criado_em timestamptz not null default now()
);
create index if not exists lead_atividades_lead on public.lead_atividades (lead_id, criado_em desc);

alter table public.lead_atividades enable row level security;
drop policy if exists "equipe interna gerencia atividades" on public.lead_atividades;
create policy "equipe interna gerencia atividades" on public.lead_atividades
  for all to authenticated
  using (exists (select 1 from public.equipe_interna where auth_user_id = (select auth.uid())))
  with check (exists (select 1 from public.equipe_interna where auth_user_id = (select auth.uid())));

create or replace function public.trg_lead_registra_status()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.status is distinct from old.status then
    insert into public.lead_atividades (lead_id, tipo, status_de, status_para)
    values (new.id, 'status', old.status, new.status);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lead_registra_status on public.leads;
create trigger trg_lead_registra_status
  after update of status on public.leads
  for each row execute function public.trg_lead_registra_status();

-- ---------------------------------------------------------------------------
-- Roteiros de WhatsApp do outbound (mesmos da aba "Mensagens" da planilha).
-- Variáveis: [barbearia], [bairro], [nome] (contato), [seu nome], [Google/Instagram].
-- Ao enviar pela Central: avança o lead até status_depois (nunca volta etapa) e,
-- se dias_proximo_passo estiver preenchido, agenda o próximo passo.
-- ---------------------------------------------------------------------------
create table if not exists public.mensagens_prospeccao (
  id bigint generated always as identity primary key,
  ordem int not null default 0,
  etapa text not null,
  quando_usar text,
  texto text not null,
  status_depois text,
  proximo_passo text,
  dias_proximo_passo int,
  atualizado_em timestamptz not null default now()
);

alter table public.mensagens_prospeccao enable row level security;
drop policy if exists "equipe interna gerencia mensagens" on public.mensagens_prospeccao;
create policy "equipe interna gerencia mensagens" on public.mensagens_prospeccao
  for all to authenticated
  using (exists (select 1 from public.equipe_interna where auth_user_id = (select auth.uid())))
  with check (exists (select 1 from public.equipe_interna where auth_user_id = (select auth.uid())));

insert into public.mensagens_prospeccao (ordem, etapa, quando_usar, texto, status_depois, proximo_passo, dias_proximo_passo)
select * from (values
  (10, 'Primeiro contato – A (pergunta)',
   'Abertura curta, puxa conversa pela rotina do dono. Boa para quem tem celular como número principal.',
   $m$Oi, tudo bem? Aqui é o [seu nome], de Curitiba. Vi a [barbearia] no [Google/Instagram] e fiquei com uma dúvida: hoje quem responde o WhatsApp pra marcar horário é você mesmo, entre um corte e outro?$m$,
   'contato_feito', 'Follow-up dia 3', 3),
  (20, 'Primeiro contato – B (direto ao produto)',
   'Já apresenta o BarboZap e pede permissão pra mandar um vídeo.',
   $m$Oi! Sou o [seu nome], do BarboZap. A gente criou um sistema que agenda os clientes da barbearia sozinho pelo WhatsApp: o cliente escolhe o serviço, o barbeiro e um horário livre, confirma, e ainda recebe lembrete um dia antes e uma hora antes. Posso te mandar um vídeo de 1 minuto mostrando como ficaria na [barbearia]?$m$,
   'contato_feito', 'Follow-up dia 3', 3),
  (30, 'Primeiro contato – C (bairro)',
   'Abertura pelo bairro, com uma pergunta sobre cliente perdido. Boa para números fixos / WhatsApp Business.',
   $m$Oi, pessoal da [barbearia]! Estou conversando com algumas barbearias aqui do [bairro] sobre agendamento pelo WhatsApp. No sábado lotado, vocês chegam a perder cliente por demorar pra responder, ou dá conta tranquilo?$m$,
   'contato_feito', 'Follow-up dia 3', 3),
  (40, 'Resposta – "respondo na mão"',
   'Quando o dono diz que ele mesmo (ou a recepção) responde e marca os horários.',
   $m$Imaginei! Quase todo barbeiro com quem eu falo faz assim. O problema é que o cliente que fica esperando resposta acaba marcando em outro lugar. O BarboZap responde na hora no seu WhatsApp: pergunta o nome, mostra seus serviços, seus barbeiros e só os horários livres, e o cliente confirma sozinho. Você só vê o horário aparecer na agenda. Dá pra testar 14 dias grátis, sem cartão, e a configuração leva uns 5 minutos: barbozap.com.br/teste-gratis$m$,
   'respondeu', 'Ver se criou a conta de teste', 2),
  (50, 'Resposta – "quanto custa?"',
   'Quando perguntam o preço.',
   $m$É R$ 69 por mês, plano único: atendimentos e agenda ilimitados, quantos barbeiros você tiver, lembretes, follow-up, avaliação do atendimento e relatório de faturamento, tudo incluso. E você testa 14 dias grátis sem cadastrar cartão, então só paga se fizer sentido pra você. Um ou dois cortes a mais no mês já cobrem a mensalidade. Cria a conta aqui: barbozap.com.br/teste-gratis$m$,
   'respondeu', 'Ver se criou a conta de teste', 2),
  (60, 'Resposta – "já uso outro sistema"',
   'Quando já usam Trinks, Booksy, AppBarber ou outro sistema de agenda.',
   $m$Que bom, então você já sabe como faz diferença ter a agenda organizada. Uma pergunta: no sistema que você usa, o cliente marca direto na conversa do WhatsApp ou precisa abrir um link ou app? No BarboZap tudo acontece dentro do próprio WhatsApp, com lembrete automático e follow-up pra trazer o cliente de volta, por R$ 69/mês com barbeiros ilimitados. Se quiser comparar sem compromisso, o teste é grátis por 14 dias e não pede cartão: barbozap.com.br/teste-gratis$m$,
   'respondeu', 'Ver se criou a conta de teste', 3),
  (70, 'Resposta – "agora não"',
   'Quando dizem que não é o momento.',
   $m$Tranquilo, sem problema! Posso te chamar de novo daqui a umas três semanas? Se antes disso quiser dar uma olhada, o teste é grátis por 14 dias e não pede cartão: barbozap.com.br/teste-gratis. Bom trabalho aí!$m$,
   'respondeu', 'Chamar de novo', 21),
  (80, 'Follow-up – dia 3',
   '3 dias depois do primeiro contato, se não houve resposta.',
   $m$Oi, [nome]! Passando só pra minha mensagem não se perder no meio dos clientes 😄 Resumindo: o BarboZap marca horário sozinho no seu WhatsApp e manda lembrete pro cliente não faltar. Quer que eu te mande um vídeo curto mostrando como funciona?$m$,
   'contato_feito', 'Follow-up dia 7', 4),
  (90, 'Follow-up – dia 7',
   '7 dias depois do primeiro contato, se ainda não respondeu. Última mensagem.',
   $m$Oi, [nome], última mensagem, prometo! Se agendamento pelo WhatsApp não é prioridade agora, tudo bem. Se quiser ver funcionando na sua barbearia, dá pra testar 14 dias grátis, sem cartão, e configurar em uns 5 minutos: barbozap.com.br/teste-gratis. Qualquer dúvida é só responder aqui.$m$,
   'contato_feito', 'Sem resposta: marcar como Perdido', 4)
) as v(ordem, etapa, quando_usar, texto, status_depois, proximo_passo, dias_proximo_passo)
where not exists (select 1 from public.mensagens_prospeccao);
