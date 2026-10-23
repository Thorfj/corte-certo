# Workflows n8n — Barbozap (export)

Exportados de `https://cortecerto.app.n8n.cloud` (pasta Barbozap) via MCP, em 2026-10-23, para backup e migração para n8n self-hosted.
Credenciais aparecem só como referência `{id, name}`; os segredos ficam no n8n e precisam ser recriados no destino.

| ID | Nome | Ativo | Gatilho | Webhook / form | Agenda | Credenciais | Chama (Execute Workflow) | Error workflow |
|---|---|---|---|---|---|---|---|---|
| [`zJkTduneYLgZSiLB`](zJkTduneYLgZSiLB-agendador-lembretes-nps-e-follow-up.json) | Agendador (Lembretes, NPS e Follow-up) | sim | Schedule |  | a cada 15 minutes | Supabase account (supabaseApi) | `U9nMESK4Zb5NPZZ0` (Enviar WhatsApp) | `LO9MFNlWYRaCsKz8` |
| [`LO9MFNlWYRaCsKz8`](LO9MFNlWYRaCsKz8-alerta-de-erro.json) | Alerta de erro | sim | Error Trigger |  |  | SMTP Barbozap (smtp)<br>Supabase account (supabaseApi) |  |  |
| [`2ch6yXqWnITsEyBJ`](2ch6yXqWnITsEyBJ-conexao-whatsapp.json) | Conexão WhatsApp | sim | Webhook | POST /webhook/whatsapp-conexao |  | Evolution API (httpHeaderAuth)<br>Supabase account (supabaseApi) |  | `LO9MFNlWYRaCsKz8` |
| [`ztT9jpz4sfvsyMJ9`](ztT9jpz4sfvsyMJ9-criar-agendas-dos-profissionais.json) | Criar agendas dos profissionais | sim | Execute Workflow (sub-workflow), Webhook | POST /webhook/profissional-criado |  | Supabase account (supabaseApi) | `kLvLNOMEiaxcT1mL` (Obter Access Token Válido (Google Calendar)) | `LO9MFNlWYRaCsKz8` |
| [`U9nMESK4Zb5NPZZ0`](U9nMESK4Zb5NPZZ0-enviar-whatsapp.json) | Enviar WhatsApp | sim | Execute Workflow (sub-workflow) |  |  | Evolution API (httpHeaderAuth) |  |  |
| [`jMULX7EiBx8jTsQh`](jMULX7EiBx8jTsQh-etapa-00101-primeiro-contato.json) | Etapa 00101 - Primeiro contato | sim | Execute Workflow (sub-workflow) |  |  | Supabase account (supabaseApi) | `OJyYgzwZAQfOZGIm` (Etapa 00201 - Escolha de Serviço)<br>`U9nMESK4Zb5NPZZ0` (Enviar WhatsApp) |  |
| [`OJyYgzwZAQfOZGIm`](OJyYgzwZAQfOZGIm-etapa-00201-escolha-de-servico.json) | Etapa 00201 - Escolha de Serviço | sim | Execute Workflow (sub-workflow) |  |  | Supabase account (supabaseApi) | `U9nMESK4Zb5NPZZ0` (Enviar WhatsApp)<br>`kQG08NWypUcIfJV5` (Etapa 00301 - Escolha do profissional) |  |
| [`kQG08NWypUcIfJV5`](kQG08NWypUcIfJV5-etapa-00301-escolha-do-profissional.json) | Etapa 00301 - Escolha do profissional | sim | Execute Workflow (sub-workflow) |  |  | Supabase account (supabaseApi) | `xNZSFurucinvuFff` (Etapa 00401 - Marcar o dia)<br>`U9nMESK4Zb5NPZZ0` (Enviar WhatsApp) |  |
| [`xNZSFurucinvuFff`](xNZSFurucinvuFff-etapa-00401-marcar-o-dia.json) | Etapa 00401 - Marcar o dia | sim | Execute Workflow (sub-workflow) |  |  | Supabase account (supabaseApi) | `U9nMESK4Zb5NPZZ0` (Enviar WhatsApp)<br>`bDdDwzBEiP0pQ5HU` (Etapa 00501 - Marcar o Horário) |  |
| [`bDdDwzBEiP0pQ5HU`](bDdDwzBEiP0pQ5HU-etapa-00501-marcar-o-horario.json) | Etapa 00501 - Marcar o Horário | sim | Execute Workflow (sub-workflow) |  |  | Supabase account (supabaseApi) | `U9nMESK4Zb5NPZZ0` (Enviar WhatsApp)<br>`HlEzGVs6lTvrWsbD` (Verificar Disponibilidade) |  |
| [`QDWsTv6Cd0HNByao`](QDWsTv6Cd0HNByao-google-oauth-iniciar.json) | Google OAuth Iniciar | sim | Webhook | GET /webhook/google-oauth-iniciar |  |  |  | `LO9MFNlWYRaCsKz8` |
| [`u3DDkroH1esFGqZQ`](u3DDkroH1esFGqZQ-google-oauth-retorno.json) | Google OAuth Retorno | sim | Webhook | GET /webhook/google-oauth-retorno |  | Google Clooud Calendar (httpBasicAuth)<br>Supabase account (supabaseApi) | `ztT9jpz4sfvsyMJ9` (Criar agendas dos profissionais) | `LO9MFNlWYRaCsKz8` |
| [`Y5aYPRUG8OHnXSju`](Y5aYPRUG8OHnXSju-notificacao-de-falta.json) | Notificação de Falta | sim | Webhook | POST /webhook/atendimento-falta |  | Supabase account (supabaseApi) | `U9nMESK4Zb5NPZZ0` (Enviar WhatsApp) | `LO9MFNlWYRaCsKz8` |
| [`kLvLNOMEiaxcT1mL`](kLvLNOMEiaxcT1mL-obter-access-token-valido-google-calendar.json) | Obter Access Token Válido (Google Calendar) | sim | Execute Workflow (sub-workflow) |  |  | Google Clooud Calendar (httpBasicAuth)<br>Supabase account (supabaseApi) |  |  |
| [`5BKxY2tNAptONoYS`](5BKxY2tNAptONoYS-roteador-principal-whatsapp.json) | Roteador Principal WhatsApp | sim | Webhook | POST /webhook/whatsapp-mensagem |  | Supabase account (supabaseApi) | `U9nMESK4Zb5NPZZ0` (Enviar WhatsApp)<br>`jMULX7EiBx8jTsQh` (Etapa 00101 - Primeiro contato)<br>`OJyYgzwZAQfOZGIm` (Etapa 00201 - Escolha de Serviço)<br>`kQG08NWypUcIfJV5` (Etapa 00301 - Escolha do profissional)<br>`xNZSFurucinvuFff` (Etapa 00401 - Marcar o dia)<br>`bDdDwzBEiP0pQ5HU` (Etapa 00501 - Marcar o Horário) | `LO9MFNlWYRaCsKz8` |
| [`w7S7TVhqwdZs4xrU`](w7S7TVhqwdZs4xrU-safra-de-prospeccao.json) | Safra de prospecção | não | Form | /form/safra-prospeccao |  | Evolution API (httpHeaderAuth)<br>SMTP Barbozap (smtp)<br>Supabase account (supabaseApi) | `U9nMESK4Zb5NPZZ0` (Enviar WhatsApp) | `LO9MFNlWYRaCsKz8` |
| [`m6QVZjtYD6pKADJT`](m6QVZjtYD6pKADJT-safra-pela-central.json) | Safra pela Central | sim | Webhook | POST /webhook/safra-prospeccao |  | Evolution API (httpHeaderAuth)<br>SMTP Barbozap (smtp)<br>Supabase account (supabaseApi) | `U9nMESK4Zb5NPZZ0` (Enviar WhatsApp) | `LO9MFNlWYRaCsKz8` |
| [`RlJz27QTh7Wtougc`](RlJz27QTh7Wtougc-sincronizar-atendimento-com-google-calendar.json) | Sincronizar Atendimento com Google Calendar | sim | Webhook | POST /webhook/atendimento-alterado |  | Supabase account (supabaseApi) | `kLvLNOMEiaxcT1mL` (Obter Access Token Válido (Google Calendar)) | `LO9MFNlWYRaCsKz8` |
| [`TWFMokNZoX8qhKZh`](TWFMokNZoX8qhKZh-sincronizar-bloqueio-com-google-calendar.json) | Sincronizar Bloqueio com Google Calendar | sim | Webhook | POST /webhook/sincronizar-bloqueio |  | Supabase account (supabaseApi) | `kLvLNOMEiaxcT1mL` (Obter Access Token Válido (Google Calendar)) | `LO9MFNlWYRaCsKz8` |
| [`oeETNOoLkVezss0C`](oeETNOoLkVezss0C-sincronizar-google-calendar-com-crm.json) | Sincronizar Google Calendar com CRM | sim | Schedule |  | a cada 30 minutes | Supabase account (supabaseApi) | `kLvLNOMEiaxcT1mL` (Obter Access Token Válido (Google Calendar)) | `LO9MFNlWYRaCsKz8` |
| [`HlEzGVs6lTvrWsbD`](HlEzGVs6lTvrWsbD-verificar-disponibilidade.json) | Verificar Disponibilidade | sim | Execute Workflow (sub-workflow) |  |  | Supabase account (supabaseApi) | `kLvLNOMEiaxcT1mL` (Obter Access Token Válido (Google Calendar)) |  |
| [`PeWxnjnK1sr15em3`](PeWxnjnK1sr15em3-whatsapp-da-prospeccao.json) | WhatsApp da prospecção | sim | Webhook | POST /webhook/whatsapp-prospeccao |  | Evolution API (httpHeaderAuth)<br>Supabase account (supabaseApi) |  | `LO9MFNlWYRaCsKz8` |

## Credenciais referenciadas

| ID | Nome | Tipo |
|---|---|---|
| `AmkxzERCZUsLm88L` | Evolution API | `httpHeaderAuth` |
| `cqynC2eNkG0tsLp8` | Google Clooud Calendar | `httpBasicAuth` |
| `rhvSDr4P1wPo3pfX` | SMTP Barbozap | `smtp` |
| `Vo6zz7XjdgV1XEmo` | Supabase account | `supabaseApi` |

## URLs fixas nos parâmetros dos nós

- `https://accounts.google.com/o/oauth2/v2/auth`
- `https://api.barbozap.com.br`
- `https://api.barbozap.com.br/chat/findMessages`
- `https://api.barbozap.com.br/chat/whatsappNumbers`
- `https://api.barbozap.com.br/instance/connect`
- `https://api.barbozap.com.br/instance/connectionState`
- `https://api.barbozap.com.br/instance/create`
- `https://api.barbozap.com.br/instance/delete`
- `https://api.barbozap.com.br/instance/fetchInstances`
- `https://api.barbozap.com.br/instance/logout`
- `https://api.barbozap.com.br/manager`
- `https://api.barbozap.com.br/message/sendText`
- `https://api.barbozap.com.br/webhook/set`
- `https://barbozap.com.br`
- `https://barbozap.com.br/app/configuracoes`
- `https://barbozap.com.br/core/html/central.html`
- `https://barbozap.com.br/oauth/google.html`
- `https://cortecerto.app.n8n.cloud/webhook/atendimento-alterado`
- `https://cortecerto.app.n8n.cloud/webhook/atendimento-falta`
- `https://cortecerto.app.n8n.cloud/webhook/google-oauth-iniciar`
- `https://cortecerto.app.n8n.cloud/webhook/sincronizar-bloqueio`
- `https://cortecerto.app.n8n.cloud/webhook/whatsapp-mensagem`
- `https://jzqiqrymqbzullysukja.supabase.co/auth/v1/user`
- `https://jzqiqrymqbzullysukja.supabase.co/rest/v1/atendimento_servicos`
- `https://jzqiqrymqbzullysukja.supabase.co/rest/v1/atendimentos`
- `https://jzqiqrymqbzullysukja.supabase.co/rest/v1/barbearias`
- `https://jzqiqrymqbzullysukja.supabase.co/rest/v1/bloqueios_agenda`
- `https://jzqiqrymqbzullysukja.supabase.co/rest/v1/clientes`
- `https://jzqiqrymqbzullysukja.supabase.co/rest/v1/equipe_interna`
- `https://jzqiqrymqbzullysukja.supabase.co/rest/v1/fluxo_followup`
- `https://jzqiqrymqbzullysukja.supabase.co/rest/v1/fluxo_mensagens`
- `https://jzqiqrymqbzullysukja.supabase.co/rest/v1/google_calendar_tokens`
- `https://jzqiqrymqbzullysukja.supabase.co/rest/v1/leads`
- `https://jzqiqrymqbzullysukja.supabase.co/rest/v1/mensagens_prospeccao`
- `https://jzqiqrymqbzullysukja.supabase.co/rest/v1/n8n_erros`
- `https://jzqiqrymqbzullysukja.supabase.co/rest/v1/prazos_followup`
- `https://jzqiqrymqbzullysukja.supabase.co/rest/v1/profissionais`
- `https://jzqiqrymqbzullysukja.supabase.co/rest/v1/rpc/registrar_lead_safra`
- `https://jzqiqrymqbzullysukja.supabase.co/rest/v1/safras_prospeccao`
- `https://jzqiqrymqbzullysukja.supabase.co/rest/v1/servicos`
- `https://jzqiqrymqbzullysukja.supabase.co/rest/v1/sessoes`
- `https://oauth2.googleapis.com/token`
- `https://www.googleapis.com/auth/calendar`
- `https://www.googleapis.com/calendar/v3/calendars`
