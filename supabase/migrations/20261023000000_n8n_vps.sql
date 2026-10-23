-- n8n saiu do n8n Cloud e foi para a VPS da Hostinger: os gatilhos passam a chamar o
-- endereço novo. Mesmas definições de antes, só com a URL trocada.

create or replace trigger n8n_atendimento_alterado
  after insert or update or delete on public.atendimentos
  for each row execute function public.notificar_n8n('https://n8n.srv2088418.hstgr.cloud/webhook/atendimento-alterado');

create or replace trigger n8n_atendimento_falta
  after update of compareceu on public.atendimentos
  for each row when (new.compareceu = false and old.compareceu is distinct from false)
  execute function public.notificar_n8n('https://n8n.srv2088418.hstgr.cloud/webhook/atendimento-falta');

create or replace trigger n8n_sincronizar_bloqueio
  after insert or delete on public.bloqueios_agenda
  for each row execute function public.notificar_n8n('https://n8n.srv2088418.hstgr.cloud/webhook/sincronizar-bloqueio');

create or replace trigger n8n_profissional_criado
  after insert on public.profissionais
  for each row execute function public.notificar_n8n('https://n8n.srv2088418.hstgr.cloud/webhook/profissional-criado');
