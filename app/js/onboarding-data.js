/* ============================================================
   BARBOZAP — ONBOARDING-DATA.JS
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
  "atendimentos": [
    {
      selector: ".primeiros-passos",
      titulo: "Comece por aqui",
      texto:
        "Esta lista mostra o que falta para o bot começar a atender. Ela se marca sozinha conforme você configura.",
    },
    {
      selector: '.nav-item[data-page="atendimentos"]',
      titulo: "Atendimentos",
      texto: "Aqui ficam todos os seus clientes e agendamentos, organizados por etapa.",
    },
    {
      selector: "#kanban",
      titulo: "As colunas do quadro",
      texto:
        "<strong>Falar com humano</strong>: o cliente pediu para falar com alguém da equipe, responda pelo WhatsApp. <strong>Em atendimento</strong>: está conversando com o bot. <strong>Agendado</strong>: tem horário marcado. <strong>Follow-up</strong>: já foi atendido e vai receber o lembrete de voltar.",
    },
    {
      selector: "#novo-atendimento-btn",
      titulo: "Criar um atendimento manual",
      texto:
        "Use este botão para agendar sem passar pelo WhatsApp: útil para encaixes ou clientes que ligaram.",
    },
  ],
  "agenda": [
    {
      selector: '.nav-item[data-page="agenda"]',
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
  "contatos": [
    {
      selector: '.nav-item[data-page="contatos"]',
      titulo: "Contatos",
      texto: "A lista de todos os clientes que já falaram com a sua barbearia.",
    },
    {
      selector: "#novo-contato-btn",
      titulo: "Cadastrar um contato",
      texto:
        "Adicione um cliente manualmente, mesmo antes dele realizar um agendamento.",
    },
    {
      selector: "#busca-input",
      titulo: "Buscar um cliente",
      texto: "Digite o nome ou telefone pra encontrar algum cliente.",
    },
  ],
  "servicos": [
    {
      selector: '.nav-item[data-page="servicos"]',
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
  "mensagens": [
    {
      selector: '.nav-item[data-page="mensagens"]',
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
  "relatorios": [
    {
      selector: '.nav-item[data-page="relatorios"]',
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
  "configuracoes": [
    {
      selector: "#card-whatsapp",
      titulo: "WhatsApp do bot",
      texto:
        "Conecte aqui o número da barbearia, lendo o QR Code como no WhatsApp Web. É por ele que o bot conversa com seus clientes.",
    },
    {
      selector: "#card-horario",
      titulo: "Horário de funcionamento",
      texto:
        "Marque os dias e horários em que a barbearia abre. O bot só oferece horários dentro deles. Folgas e feriados ficam na Agenda, em Bloqueios.",
    },
    {
      selector: "#card-google",
      titulo: "Google Agenda (opcional)",
      texto:
        "Conecte a conta Google da barbearia e cada profissional ganha uma agenda com os horários marcados.",
    },
    {
      selector: ".tabs",
      titulo: "Usuários e Pagamentos",
      texto:
        "Em Usuários você cadastra os outros profissionais: cada um aparece como opção no bot. Em Pagamentos fica a sua assinatura.",
    },
  ],
  "financeiro": [
    {
      selector: "#fin-kpis",
      titulo: "O dinheiro da barbearia",
      texto:
        "Faturamento, o que já entrou, o fiado a receber e o que está previsto no período escolhido. Mais abaixo: por dia, por forma de pagamento, por serviço e por profissional.",
    },
    {
      selector: "#fin-tabela-fiado",
      titulo: "Fiado em aberto",
      texto: "Quem ainda está devendo. Quando o cliente pagar, é só clicar em Marcar pago.",
    },
  ],
  "pagamentos": [
    {
      selector: ".pagamentos-grid",
      titulo: "Sua assinatura",
      texto:
        "Aqui você acompanha o plano e paga por Pix ou cartão sem sair do CRM. No cartão, as próximas mensalidades são cobradas automaticamente.",
    },
  ],
};
