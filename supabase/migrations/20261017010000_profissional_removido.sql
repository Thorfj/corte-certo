-- Exclusão de usuários pelo CRM (Edge Function excluir-usuario).
-- Quem não tem atendimentos é apagado de vez; quem tem histórico fica com
-- removido_em preenchido (some do CRM e do bot, mas os relatórios continuam
-- mostrando quem fez cada atendimento).
alter table public.profissionais add column if not exists removido_em timestamptz;
