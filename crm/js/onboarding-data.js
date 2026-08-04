/* ============================================================
   CORTE CERTO — ONBOARDING-DATA.JS
   Dados do tour guiado (onboarding) — separado do crm-global.js
   só pra facilitar editar o texto dos passos sem mexer na lógica
   do tour.

   Cada chave é o nome do arquivo HTML da página. Cada passo tem:
     selector — seletor CSS do elemento que vai ser destacado
     titulo   — título do balão
     texto    — texto explicativo do balão

   Precisa ser carregado ANTES de crm-global.js.
   ============================================================ */

const ONBOARDING_PASSOS = {
  "atendimentos.html": [
    {
      selector: '.nav-item[data-page="atendimentos.html"]',
      titulo: "Atendimentos",
      texto:
        "Aqui ficam todos os seus agendamentos, organizados por status: como um quadro de tarefas.",
    },
    {
      selector: "#novo-atendimento-btn",
      titulo: "Criar um atendimento manual",
      texto:
        "Use este botão pra agendar sem passar pelo WhatsApp:útil pra encaixes ou clientes que ligaram.",
    },
    {
      selector: "#kanban",
      titulo: "O quadro de atendimentos",
      texto:
        "Clique em qualquer cartão pra abrir e editar os detalhes daquele atendimento.",
    },
  ],
  "agenda.html": [
    {
      selector: '.nav-item[data-page="agenda.html"]',
      titulo: "Agenda",
      texto: "Veja os horários da sua barbearia em formato de calendário.",
    },
    {
      selector: "#view-switcher",
      titulo: "Diário, Mensal ou Bloqueios",
      texto:
        "Alterne entre ver um dia só, o mês inteiro, ou gerenciar folgas e feriados na aba Bloqueios.",
    },
    {
      selector: "#prof-selector",
      titulo: "Filtrar por profissional",
      texto:
        "Clique nos nomes pra mostrar ou esconder a agenda de cada profissional.",
    },
  ],
  "contatos.html": [
    {
      selector: '.nav-item[data-page="contatos.html"]',
      titulo: "Contatos",
      texto: "A lista de todos os clientes que já falaram com a sua barbearia.",
    },
    {
      selector: "#novo-contato-btn",
      titulo: "Cadastrar um contato",
      texto:
        "Adicione um cliente manualmente, mesmo antes dele agendar qualquer coisa.",
    },
    {
      selector: "#busca-input",
      titulo: "Buscar um cliente",
      texto: "Digite o nome ou telefone pra encontrar rapidinho.",
    },
  ],
  "servicos.html": [
    {
      selector: '.nav-item[data-page="servicos.html"]',
      titulo: "Serviços",
      texto: "Cadastre aqui todos os serviços que sua barbearia oferece",
    },
    {
      selector: "#novo-servico-btn",
      titulo: "Criar um serviço",
      texto:
        "Defina nome, preço, duração e recorrência: o bot usa essas informações pra montar o agendamento no WhatsApp.",
    },
  ],
  "mensagens.html": [
    {
      selector: '.nav-item[data-page="mensagens.html"]',
      titulo: "Mensagens",
      texto:
        "Aqui você configura tudo que o bot fala com o cliente no WhatsApp.",
    },
    {
      selector: ".tabs",
      titulo: "Fluxo, Follow-up e Automáticas",
      texto:
        "Fluxo é o passo a passo do agendamento. Follow-up são mensagens de retorno. Automáticas disparam sozinhas em situações específicas.",
    },
    {
      selector: "#toggle-fluxo-btn",
      titulo: "Ligar o fluxo",
      texto:
        "Quando terminar de configurar as mensagens, ative o fluxo aqui pra o bot começar a responder de verdade.",
    },
  ],
  "relatorios.html": [
    {
      selector: '.nav-item[data-page="relatorios.html"]',
      titulo: "Relatórios",
      texto:
        "Acompanhe faturamento, NPS, ocupação dos profissionais e outros números da barbearia.",
    },
    {
      selector: ".tabs",
      titulo: "Vários relatórios diferentes",
      texto: "Cada aba mostra uma visão diferente dos seus dados.",
    },
  ],
  "configuracoes.html": [
    {
      selector: '.nav-item[data-page="configuracoes.html"]',
      titulo: "Configurações",
      texto:
        "O painel de controle da sua barbearia: dados gerais, usuários e faturas.",
    },
    {
      selector: ".tabs",
      titulo: "Geral, Usuários e Faturas",
      texto:
        "Em Usuários você cadastra os outros profissionais que vão usar o CRM.",
    },
  ],
};
