# n8n — Barbozap

Os workflows ficam no n8n Cloud (`https://cortecerto.app.n8n.cloud`), pasta **Barbozap**.
Eles foram migrados dos JSONs do Google Drive, corrigidos para rodar no n8n Cloud (sem `$env` e sem HTTP dentro de Code node) e completados com as etapas que faltavam no bot.

## Workflows

| Workflow | Gatilho | ID |
|---|---|---|
| Roteador Principal WhatsApp | Webhook `POST /webhook/whatsapp-mensagem` (Evolution API) | `5BKxY2tNAptONoYS` |
| Etapa 00101 - Primeiro contato | sub-workflow | `jMULX7EiBx8jTsQh` |
| Etapa 00201 - Escolha de Serviço | sub-workflow | `OJyYgzwZAQfOZGIm` |
| Etapa 00301 - Escolha do profissional | sub-workflow | `kQG08NWypUcIfJV5` |
| Etapa 00401 - Marcar o dia | sub-workflow | `xNZSFurucinvuFff` |
| Etapa 00501 - Marcar o Horário | sub-workflow (cria o atendimento) | `bDdDwzBEiP0pQ5HU` |
| Enviar WhatsApp | sub-workflow (único ponto que fala com a Evolution) | `U9nMESK4Zb5NPZZ0` |
| Verificar Disponibilidade | sub-workflow | `HlEzGVs6lTvrWsbD` |
| Obter Access Token Válido (Google Calendar) | sub-workflow | `kLvLNOMEiaxcT1mL` |
| Agendador (Lembretes, NPS e Follow-up) | a cada 15 min | `zJkTduneYLgZSiLB` |
| Notificação de Falta | Webhook `POST /webhook/atendimento-falta` (Supabase) | `Y5aYPRUG8OHnXSju` |
| Sincronizar Atendimento com Google Calendar | Webhook `POST /webhook/atendimento-alterado` (Supabase) | `RlJz27QTh7Wtougc` |
| Sincronizar Bloqueio com Google Calendar | Webhook `POST /webhook/sincronizar-bloqueio` (Supabase) | `TWFMokNZoX8qhKZh` |
| Sincronizar Google Calendar com CRM | a cada 30 min | `oeETNOoLkVezss0C` |
| Google OAuth Iniciar | Webhook `GET /webhook/google-oauth-iniciar` | `QDWsTv6Cd0HNByao` |
| Google OAuth Retorno | Webhook `GET /webhook/google-oauth-retorno` | `u3DDkroH1esFGqZQ` |
| Criar agendas dos profissionais | sub-workflow + Webhook `POST /webhook/profissional-criado` | `ztT9jpz4sfvsyMJ9` |
| Alerta de erro | Error Trigger (é o *Error workflow* dos workflows com gatilho) | `LO9MFNlWYRaCsKz8` |
| Conexão WhatsApp | Webhook `POST /webhook/whatsapp-conexao` (CRM > Configurações) | `2ch6yXqWnITsEyBJ` |

Fluxo do bot: `00101 nome → 00201 serviços → 00301 profissional → 00401 dia → 00501 horário → atendimento criado`.
Ao concluir, a sessão fica com `etapa_atual = 'concluido'` e a próxima mensagem do cliente recomeça em 00201.

Antes de chamar a etapa, o Roteador (nó *Verifica NPS, cancelar e remarcar*) trata:

- **Nota de NPS**: resposta `1` a `5` (mesma escala do CRM) ao pedido enviado pelo Agendador grava `atendimentos.nps`; a média do cliente (`clientes.media_nps`) é recalculada pelo trigger `trg_media_nps`.
- **Cancelar** (`cancelar`, `desmarcar`): mostra o próximo horário e pede *SIM*/*NÃO* (`etapa_atual = 'cancelar_confirma'`, `id_atend_alvo` = atendimento). Com *SIM* o atendimento é apagado (o evento sai do Google Calendar pelo webhook).
- **Remarcar** (`remarcar`, `reagendar`, `mudar o horário`): volta para 00401 com os mesmos serviços e profissional e `id_atend_alvo` preenchido; na 00501 o horário escolhido **atualiza** o atendimento existente em vez de criar outro.

## Checklist para colocar no ar

1. **Credenciais no n8n** (Overview → Credentials) e selecionar nos nós HTTP:
   - `Supabase Barbozap` (tipo *Supabase API*): host `https://jzqiqrymqbzullysukja.supabase.co` + **service role key**.
   - `Evolution API` (tipo *Header Auth*): nome `apikey`, valor = API key da Evolution.
   - `Google OAuth Client (Barbozap)` (tipo *Basic Auth*): usuário = Client ID, senha = Client Secret.
2. **Evolution API**: roda na VPS da Hostinger atrás do Traefik, em `https://api.barbozap.com.br` (manager em `/manager`). A regra do Traefik fica na linha `traefik.http.routers...rule` de `/docker/evolution-api-kpq8/docker-compose.yml` (`Host(...) || Host(`api.barbozap.com.br`)`); se o app for reinstalado pelo painel, refazer. Configurar o webhook da instância (evento `MESSAGES_UPSERT`) para `https://cortecerto.app.n8n.cloud/webhook/whatsapp-mensagem`. O nome da instância deve ser igual a `barbearias.whatsapp_barbearia`.
3. **Google Cloud**: trocar `SEU_GOOGLE_CLIENT_ID` no *Google OAuth Iniciar*; cadastrar `https://cortecerto.app.n8n.cloud/webhook/google-oauth-retorno` como URI de redirecionamento autorizada; habilitar a Google Calendar API.
4. **Supabase → webhooks para o n8n**: já criados como triggers (`n8n_atendimento_alterado`, `n8n_atendimento_falta`, `n8n_sincronizar_bloqueio`) pela migração `20261014010000_webhooks_n8n.sql`, usando `pg_net`.
5. **Publicar (ativar)** os workflows com gatilho: Roteador, Agendador, Notificação de Falta, as 3 sincronizações e os 2 de OAuth.

## Esquema usado pelos workflows

As colunas que faltavam no banco foram criadas pela migração `supabase/migrations/20261014000000_colunas_bot_n8n.sql` (já aplicada no projeto).

- `sessoes`: `id_cliente`, `etapa_atual`, `aguardando_resposta`, `servicos_selecionados` (array), `id_prof_selecionado`, `dia_selecionado`, `horario_selecionado`, `id_atend_alvo` (cancelamento/remarcação).
- `atendimentos`: `aviso_1dia_enviado`, `aviso_1hora_enviado`, `nps_solicitado`, `google_event_id`, `duracao_atend`.
- `clientes`: `ciclo_followup_atual`, `recorrencia_followup`, `data_proximo_followup`, `data_ult_agend`.
- `bloqueios_agenda`: `origem`, `google_event_ids` (jsonb).
- `google_calendar_tokens`: `barbearia_id` (único), `access_token`, `refresh_token`, `expires_at`.

Horário de funcionamento: `barbearias.horario_funcionamento` (por dia da semana, `null` = fechado), editado no CRM em **Configurações > Horário de funcionamento**. Sem configuração, vale seg–sáb 09:00–19:00. Passos de 30 min e antecedência mínima de 30 min (constantes no nó *Calcula horários livres e escolha* da etapa 00501). Folgas e feriados vêm de `bloqueios_agenda`.

## Alerta de erro

Roteador, Agendador, Notificação de Falta, OAuth, sincronizações do Google e Criar agendas têm o *Error workflow* apontando para **Alerta de erro**. Ele grava a falha em `n8n_erros` (Supabase) e manda e-mail para `email_alertas` (nó *Monta alerta*) pela credencial SMTP da Hostinger (`contato@barbozap.com.br`). O *Enviar WhatsApp* fica de fora do alerta.

## Conexão do WhatsApp pelo CRM

Em **Configurações > WhatsApp do bot** o admin conecta o número lendo o QR Code. O CRM chama `POST /webhook/whatsapp-conexao` com o token do usuário logado e `{ acao: status | conectar | desconectar }`. O n8n confere o usuário no Supabase Auth, exige papel admin e usa `barbearias.whatsapp_barbearia` como nome da instância (nunca um valor vindo do navegador). Instâncias novas já nascem com o webhook do Roteador (`MESSAGES_UPSERT`).
