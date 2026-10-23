# Migração do n8n Cloud para a VPS da Hostinger

Motivo: o plano do n8n Cloud tem limite de execuções e o consumo fixo (agendador a cada
15 min, sincronização do Google Calendar a cada 30 min) já chega perto do limite sem
clientes. A versão hospedada na VPS não tem limite de execuções.

## Situação

| | Endereço |
|---|---|
| n8n antigo (Cloud) | https://cortecerto.app.n8n.cloud |
| n8n novo (VPS Hostinger KVM 1, `srv2088418`, IP 2.25.109.56) | https://n8n.srv2088418.hstgr.cloud |

- O n8n novo roda no **Gerenciador Docker** da Hostinger (projeto `n8n`, 7 contêineres,
  com Traefik e HTTPS). Ele só responde pelo nome `n8n.srv2088418.hstgr.cloud`; pelo IP dá 404.
- A Evolution API continua na outra VPS (`api.barbozap.com.br`). Não mexer nela.
- Cópia de todos os fluxos do Cloud: `n8n/workflows/*.json` (índice em `n8n/workflows/INDEX.md`).
- O Claude acessa o n8n novo por um conector MCP próprio (configurado em claude.ai, além do
  conector do n8n Cloud).

## Status (23/10/2026, ~23h20)

Virada feita. Os 21 fluxos rodam na VPS; no Cloud estão todos desligados (não apagar
até o passo 7). Site e gatilhos do Supabase já apontam para a VPS.

Problemas resolvidos na virada:
- Os workers (modo fila) não subiam: `N8N_ENCRYPTION_KEY=` estava vazio no
  `/docker/n8n/docker-compose.yml`. Preenchido com a chave do n8n principal
  (`/home/node/.n8n/config`); backup em `docker-compose.yml.bak`. Não usar "reimplantar"
  no Gerenciador Docker da Hostinger: pode voltar o arquivo original.
- A credencial "Evolution API" estava com a chave errada (401); corrigida com a
  `AUTHENTICATION_API_KEY` da VPS da Evolution (srv2067195, 179.197.232.141).
- Na Evolution só existe a instância `prospeccao` (sem webhook), então não havia webhook de
  barbearia para trocar. O fluxo auxiliar "Barbozap - Migração: apontar webhooks da Evolution"
  (n8n novo) refaz isso se precisar; pode ser arquivado.
- O Google não precisou de mudança: o redirect do OAuth é `barbozap.com.br/oauth/google.html`,
  que agora chama o webhook novo.

## Passos

- [x] 1. Importar os fluxos no n8n novo, **todos desligados**, mantendo os nomes.
      Os sub-fluxos são chamados por ID: depois de importar, trocar nos nós
      "Execute Workflow" os IDs antigos pelos novos (tabela de-para no fim deste arquivo).
- [x] 2. Recadastrar as credenciais no n8n novo (as senhas não saem do Cloud). Lista em
      `n8n/workflows/INDEX.md`. Principais: Supabase (service role), Evolution API (apikey
      global), SMTP (e-mail de alertas). Conferir se há credenciais do Google.
- [x] 3. Configurar o error workflow ("Barbozap - Alerta de erro") em cada fluxo.
- [x] 4. Trocar os endereços `https://cortecerto.app.n8n.cloud/webhook/...` por
      `https://n8n.srv2088418.hstgr.cloud/webhook/...`:
  - Site:
    - `core/js/central.js`: `whatsapp-prospeccao`, `safra-prospeccao`
    - `app/js/configuracoes.js` e `app/js/crm-global.js`: `whatsapp-conexao`
    - `oauth/google.html` e o fluxo "Google OAuth Iniciar": `google-oauth-iniciar` e `google-oauth-retorno`
  - Supabase (gatilhos que chamam `notificar_n8n(url)`), via migração nova:
    - `atendimentos` → `n8n_atendimento_alterado` (`atendimento-alterado`)
    - `atendimentos` → `n8n_atendimento_falta` (`atendimento-falta`)
    - `bloqueios_agenda` → `n8n_sincronizar_bloqueio` (`sincronizar-bloqueio`)
    - `profissionais` → `n8n_profissional_criado` (`profissional-criado`)
  - Evolution: o webhook de mensagens (`whatsapp-mensagem`) de cada instância de barbearia.
    A instância `prospeccao` não tem webhook.
  - Google Cloud Console: URI de redirecionamento autorizado do OAuth →
    `https://n8n.srv2088418.hstgr.cloud/webhook/google-oauth-retorno` (o Thor troca).
  - URLs fixas dentro dos próprios fluxos (ver INDEX.md).
- [x] 5. Virada: ligar os fluxos no n8n novo e desligar os mesmos no Cloud, logo em seguida.
      Publicar o site com os endereços novos e aplicar a migração do Supabase no mesmo momento.
- [ ] 6. Testes: mensagem no WhatsApp da barbearia de teste (thorfj@gmail.com, "barbearia da
      analu") até marcar um horário; conexão do WhatsApp na Central; status na tela de
      Configurações do CRM; uma safra de 1 lead; lembrete do agendador.
- [ ] 7. Uma semana sem problemas → cancelar o n8n Cloud.
- [x] 8. Backups: snapshot das duas VPS (n8n e Evolution) feito em 23/10 após a virada; tirar um novo antes de mexer em qualquer servidor.

## Otimizações para depois

- "Obter Access Token Válido (Google Calendar)": guardar o token e só renovar quando vencer.
- Sincronização do Google Calendar: avaliar passar de 30 para 60 minutos.

## De-para de IDs (preencher na importação)

| Fluxo | ID no Cloud | ID no n8n novo |
|---|---|---|
