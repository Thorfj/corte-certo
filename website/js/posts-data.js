/* ============================================================
   CORTE CERTO — POSTS-DATA.JS
   Fonte única dos posts do blog.
   Pra publicar um post novo:
     1) adicione uma entrada aqui
     2) crie o arquivo HTML correspondente em /html/blog-posts/<slug>.html
   O blog.js lê esta lista e gera a listagem sozinho — não precisa
   editar blog.html na mão.
   ============================================================ */

const BLOG_POSTS = [
  {
    slug: "whatsapp-recepcao-barbearia",
    title:
      "O WhatsApp virou a recepção da sua barbearia — você só ainda não percebeu",
    excerpt:
      "Todo cliente que manda “oi, tem horário?” já está, na prática, batendo na porta do seu negócio. O problema é que ninguém projetou essa recepção — ela simplesmente aconteceu.",
    category: "atendimento",
    categoryLabel: "Atendimento",
    date: "28 jul 2026",
    readTime: "6 min de leitura",
    featured: true,
  },
  {
    slug: "reduzir-faltas-barbearia",
    title: "5 jeitos simples de reduzir as faltas na sua barbearia",
    excerpt:
      "Lembrete automático é só o começo. Veja outras táticas que diminuem o “esqueci que tinha marcado” sem precisar cobrar multa.",
    category: "agendamento",
    categoryLabel: "Agendamento",
    date: "22 jul 2026",
    readTime: "4 min",
    featured: false,
  },
  {
    slug: "nps-o-que-conta",
    title:
      "NPS de 1 a 5: o que esse número realmente conta sobre sua barbearia",
    excerpt:
      "Não é só uma nota bonita pra colocar em post do Instagram. Veja como usar o NPS pra decidir onde investir tempo e treinamento.",
    category: "gestao",
    categoryLabel: "Gestão",
    date: "15 jul 2026",
    readTime: "5 min",
    featured: false,
  },
  {
    slug: "tempo-perdido-respondendo-horario",
    title: "Quanto tempo você perde respondendo “qual horário você tem?”",
    excerpt:
      "Fizemos as contas: em uma barbearia de porte médio, essa pergunta sozinha pode consumir mais de uma hora por dia do profissional.",
    category: "agendamento",
    categoryLabel: "Agendamento",
    date: "08 jul 2026",
    readTime: "3 min",
    featured: false,
  },
  {
    slug: "agenda-varios-profissionais",
    title: "Como organizar a agenda de mais de um profissional sem bagunça",
    excerpt:
      "Quando a barbearia cresce e ganha um segundo ou terceiro profissional, a agenda no papel começa a rachar. Veja o que muda.",
    category: "gestao",
    categoryLabel: "Gestão",
    date: "30 jun 2026",
    readTime: "4 min",
    featured: false,
  },
];
