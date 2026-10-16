-- Colunas e tabela usadas pelos workflows do n8n (bot de WhatsApp, lembretes,
-- follow-up e Google Calendar). Só adições: nada existente é alterado.

-- Bot: indica se a etapa atual já fez a pergunta e espera a resposta do cliente
alter table public.sessoes
  add column if not exists aguardando_resposta boolean not null default false;

-- Agendador: evita reenviar lembretes e pedido de NPS
alter table public.atendimentos
  add column if not exists aviso_1dia_enviado boolean not null default false,
  add column if not exists aviso_1hora_enviado boolean not null default false,
  add column if not exists nps_solicitado boolean not null default false;

-- Agendador: controle do ciclo de follow-up por cliente
alter table public.clientes
  add column if not exists ciclo_followup_atual integer not null default 0,
  add column if not exists recorrencia_followup integer,
  add column if not exists data_proximo_followup date;

create index if not exists clientes_followup_idx
  on public.clientes (status, data_proximo_followup);

-- Google Calendar: tokens OAuth por barbearia (lidos só pelo n8n com service role)
create table if not exists public.google_calendar_tokens (
  id bigint generated always as identity primary key,
  barbearia_id bigint not null unique references public.barbearias (id) on delete cascade,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- RLS ligado e sem políticas: nenhum usuário do CRM lê os tokens; o service role ignora RLS
alter table public.google_calendar_tokens enable row level security;
