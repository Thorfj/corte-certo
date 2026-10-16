-- Regras de acesso por papel e proteção da cobrança.
--
-- Antes: cada tabela tinha várias políticas repetidas, e as mais permissivas
-- anulavam as restritas. Na prática o papel "usuario" (barbeiro) podia se
-- promover a admin, apagar atendimentos de outros e ver faturas, e qualquer
-- usuário logado podia marcar a própria barbearia como "pagante".
--
-- Agora:
--   admin   -> tudo na própria barbearia (menos campos de cobrança/sistema)
--   usuario -> vê a equipe, serviços e clientes; mexe só nos próprios
--              atendimentos e bloqueios de agenda
--   cobrança -> só o servidor (webhook da Asaas, service_role) altera
--
-- As políticas antigas foram desligadas com ALTER POLICY ... TO service_role
-- (service_role ignora RLS, então elas não valem para mais ninguém).

create or replace function public.e_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select acesso = 'admin' from public.profissionais where auth_user_id = auth.uid() limit 1), false);
$$;
revoke execute on function public.e_admin() from public, anon;
grant execute on function public.e_admin() to authenticated, service_role;

create or replace function public.proteger_campos_barbearia()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Só vale para quem chega pela API com a chave pública (CRM no navegador).
  -- Edge functions (service_role) e funções SECURITY DEFINER rodam com outro usuário e passam.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.status_assinatura is distinct from old.status_assinatura
     or new.subscription_status is distinct from old.subscription_status
     or new.asaas_customer_id is distinct from old.asaas_customer_id
     or new.asaas_subscription_id is distinct from old.asaas_subscription_id
     or new.proximo_vencimento is distinct from old.proximo_vencimento
     or new.trial_iniciado_em is distinct from old.trial_iniciado_em
     or new.config_concluida is distinct from old.config_concluida
     or new.google_calendar_status is distinct from old.google_calendar_status
     or new.google_calendar_email is distinct from old.google_calendar_email
     or new.criado_em is distinct from old.criado_em then
    raise exception 'Esse dado da barbearia só pode ser alterado pelo sistema.' using errcode = '42501';
  end if;

  -- "cliente" (plano ativo) só pode ser desligado pelo CRM (botão cancelar assinatura), nunca ligado
  if new.cliente is distinct from old.cliente and coalesce(new.cliente, false) then
    raise exception 'A assinatura só é ativada pela confirmação de pagamento.' using errcode = '42501';
  end if;

  -- Bot só pode ser ligado com teste ativo ou assinatura paga
  if new.status_fluxo = 'Sim' and old.status_fluxo is distinct from 'Sim'
     and (select fase from public.status_teste()) in ('grace', 'bloqueado') then
    raise exception 'Seu período de teste acabou. Assine o plano para reativar o fluxo.' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger trg_proteger_campos_barbearia
  before update on public.barbearias
  for each row execute function public.proteger_campos_barbearia();

-- Políticas novas
create policy "bz: equipe ve a propria barbearia" on public.barbearias for select to authenticated using (id = public.current_barbearia_id());
create policy "bz: admin edita a barbearia" on public.barbearias for update to authenticated using (id = public.current_barbearia_id() and public.e_admin()) with check (id = public.current_barbearia_id());
create policy "bz: admin ve as faturas" on public.asaas for select to authenticated using (barbearia_id = public.current_barbearia_id() and public.e_admin());
create policy "bz: atendimentos select (admin ou o proprio profissional)" on public.atendimentos for select to authenticated using (barbearia_id = public.current_barbearia_id() and (public.e_admin() or id_prof = public.current_prof_id()));
create policy "bz: atendimentos delete (admin ou o proprio profissional)" on public.atendimentos for delete to authenticated using (barbearia_id = public.current_barbearia_id() and (public.e_admin() or id_prof = public.current_prof_id()));
create policy "bz: atendimentos insert (admin ou o proprio profissional)" on public.atendimentos for insert to authenticated with check (barbearia_id = public.current_barbearia_id() and (public.e_admin() or id_prof = public.current_prof_id()));
create policy "bz: atendimentos update (admin ou o proprio profissional)" on public.atendimentos for update to authenticated using (barbearia_id = public.current_barbearia_id() and (public.e_admin() or id_prof = public.current_prof_id())) with check (barbearia_id = public.current_barbearia_id() and (public.e_admin() or id_prof = public.current_prof_id()));
create policy "bz: servicos do atendimento (segue o atendimento)" on public.atendimento_servicos for all to authenticated using (exists (select 1 from public.atendimentos a where a.id = id_atend and a.barbearia_id = public.current_barbearia_id() and (public.e_admin() or a.id_prof = public.current_prof_id()))) with check (exists (select 1 from public.atendimentos a where a.id = id_atend and a.barbearia_id = public.current_barbearia_id() and (public.e_admin() or a.id_prof = public.current_prof_id())));
create policy "bz: equipe ve os bloqueios" on public.bloqueios_agenda for select to authenticated using (barbearia_id = public.current_barbearia_id());
create policy "bz: bloqueios insert (admin ou a propria agenda)" on public.bloqueios_agenda for insert to authenticated with check (barbearia_id = public.current_barbearia_id() and (public.e_admin() or id_prof = public.current_prof_id()));
create policy "bz: bloqueios update (admin ou a propria agenda)" on public.bloqueios_agenda for update to authenticated using (barbearia_id = public.current_barbearia_id() and (public.e_admin() or id_prof = public.current_prof_id())) with check (barbearia_id = public.current_barbearia_id() and (public.e_admin() or id_prof = public.current_prof_id()));
create policy "bz: bloqueios delete (admin ou a propria agenda)" on public.bloqueios_agenda for delete to authenticated using (barbearia_id = public.current_barbearia_id() and (public.e_admin() or id_prof = public.current_prof_id()));
create policy "bz: equipe ve servicos" on public.servicos for select to authenticated using (barbearia_id = public.current_barbearia_id());
create policy "bz: admin insere servicos" on public.servicos for insert to authenticated with check (barbearia_id = public.current_barbearia_id() and public.e_admin());
create policy "bz: admin edita servicos" on public.servicos for update to authenticated using (barbearia_id = public.current_barbearia_id() and public.e_admin()) with check (barbearia_id = public.current_barbearia_id());
create policy "bz: admin apaga servicos" on public.servicos for delete to authenticated using (barbearia_id = public.current_barbearia_id() and public.e_admin());
create policy "bz: equipe ve profissionais" on public.profissionais for select to authenticated using (barbearia_id = public.current_barbearia_id());
create policy "bz: admin insere profissionais" on public.profissionais for insert to authenticated with check (barbearia_id = public.current_barbearia_id() and public.e_admin());
create policy "bz: admin edita profissionais" on public.profissionais for update to authenticated using (barbearia_id = public.current_barbearia_id() and public.e_admin()) with check (barbearia_id = public.current_barbearia_id());
create policy "bz: admin apaga profissionais" on public.profissionais for delete to authenticated using (barbearia_id = public.current_barbearia_id() and public.e_admin());
create policy "bz: equipe ve fluxo_mensagens" on public.fluxo_mensagens for select to authenticated using (barbearia_id = public.current_barbearia_id());
create policy "bz: admin insere fluxo_mensagens" on public.fluxo_mensagens for insert to authenticated with check (barbearia_id = public.current_barbearia_id() and public.e_admin());
create policy "bz: admin edita fluxo_mensagens" on public.fluxo_mensagens for update to authenticated using (barbearia_id = public.current_barbearia_id() and public.e_admin()) with check (barbearia_id = public.current_barbearia_id());
create policy "bz: admin apaga fluxo_mensagens" on public.fluxo_mensagens for delete to authenticated using (barbearia_id = public.current_barbearia_id() and public.e_admin());
create policy "bz: equipe ve fluxo_followup" on public.fluxo_followup for select to authenticated using (barbearia_id = public.current_barbearia_id());
create policy "bz: admin insere fluxo_followup" on public.fluxo_followup for insert to authenticated with check (barbearia_id = public.current_barbearia_id() and public.e_admin());
create policy "bz: admin edita fluxo_followup" on public.fluxo_followup for update to authenticated using (barbearia_id = public.current_barbearia_id() and public.e_admin()) with check (barbearia_id = public.current_barbearia_id());
create policy "bz: admin apaga fluxo_followup" on public.fluxo_followup for delete to authenticated using (barbearia_id = public.current_barbearia_id() and public.e_admin());
create policy "bz: equipe ve prazos_followup" on public.prazos_followup for select to authenticated using (barbearia_id = public.current_barbearia_id());
create policy "bz: admin insere prazos_followup" on public.prazos_followup for insert to authenticated with check (barbearia_id = public.current_barbearia_id() and public.e_admin());
create policy "bz: admin edita prazos_followup" on public.prazos_followup for update to authenticated using (barbearia_id = public.current_barbearia_id() and public.e_admin()) with check (barbearia_id = public.current_barbearia_id());
create policy "bz: admin apaga prazos_followup" on public.prazos_followup for delete to authenticated using (barbearia_id = public.current_barbearia_id() and public.e_admin());

-- Políticas antigas desligadas
alter policy "asaas_isolation" on public.asaas to service_role;
alter policy "usuario le suas faturas" on public.asaas to service_role;
alter policy "asaas_select_mesma_barbearia" on public.asaas to service_role;
alter policy "isola_asaas_por_barbearia" on public.asaas to service_role;
alter policy "acesso atendimento_servicos via atendimento" on public.atendimento_servicos to service_role;
alter policy "isola_atendimento_servicos_por_barbearia" on public.atendimento_servicos to service_role;
alter policy "atendimento_servicos_isolation" on public.atendimento_servicos to service_role;
alter policy "atendimentos_select_mesma_barbearia" on public.atendimentos to service_role;
alter policy "isola_atendimentos_por_barbearia" on public.atendimentos to service_role;
alter policy "acesso atendimentos pela barbearia" on public.atendimentos to service_role;
alter policy "atendimentos_delete" on public.atendimentos to service_role;
alter policy "atendimentos_insert" on public.atendimentos to service_role;
alter policy "atendimentos_select" on public.atendimentos to service_role;
alter policy "atendimentos_update" on public.atendimentos to service_role;
alter policy "barbearias_update" on public.barbearias to service_role;
alter policy "barbearias_select_propria" on public.barbearias to service_role;
alter policy "permitir cadastro publico via site" on public.barbearias to service_role;
alter policy "isola_barbearia_propria" on public.barbearias to service_role;
alter policy "barbearias_update_propria" on public.barbearias to service_role;
alter policy "barbearias_isolation" on public.barbearias to service_role;
alter policy "usuario edita sua barbearia" on public.barbearias to service_role;
alter policy "usuario ve sua barbearia" on public.barbearias to service_role;
alter policy "isola_bloqueios_agenda_por_barbearia" on public.bloqueios_agenda to service_role;
alter policy "bloqueios_isolation" on public.bloqueios_agenda to service_role;
alter policy "acesso bloqueios pela barbearia" on public.bloqueios_agenda to service_role;
alter policy "acesso fluxo_followup pela barbearia" on public.fluxo_followup to service_role;
alter policy "isola_fluxo_followup_por_barbearia" on public.fluxo_followup to service_role;
alter policy "fluxo_followup_isolation" on public.fluxo_followup to service_role;
alter policy "acesso fluxo_mensagens pela barbearia" on public.fluxo_mensagens to service_role;
alter policy "fluxo_mensagens_isolation" on public.fluxo_mensagens to service_role;
alter policy "isola_fluxo_mensagens_por_barbearia" on public.fluxo_mensagens to service_role;
alter policy "prazos_followup_isolation" on public.prazos_followup to service_role;
alter policy "isola_prazos_followup_por_barbearia" on public.prazos_followup to service_role;
alter policy "acesso prazos_followup pela barbearia" on public.prazos_followup to service_role;
alter policy "profissionais_modify" on public.profissionais to service_role;
alter policy "profissionais_select" on public.profissionais to service_role;
alter policy "profissionais_select_mesma_barbearia" on public.profissionais to service_role;
alter policy "profissionais_update_mesma_barbearia" on public.profissionais to service_role;
alter policy "ve profissionais da mesma barbearia" on public.profissionais to service_role;
alter policy "isola_profissionais_por_barbearia" on public.profissionais to service_role;
alter policy "edita profissionais da mesma barbearia" on public.profissionais to service_role;
alter policy "acesso servicos pela barbearia" on public.servicos to service_role;
alter policy "servicos_insert_mesma_barbearia" on public.servicos to service_role;
alter policy "servicos_select_mesma_barbearia" on public.servicos to service_role;
alter policy "servicos_update_mesma_barbearia" on public.servicos to service_role;
alter policy "servicos_isolation" on public.servicos to service_role;
alter policy "servicos_delete_mesma_barbearia" on public.servicos to service_role;
alter policy "isola_servicos_por_barbearia" on public.servicos to service_role;
