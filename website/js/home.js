// Simulação do atendimento automático exibida no celular do hero.
const chatScript = [
  {
    who: "in",
    text: "Oiee! Bem-vindo à Barbearia Corte Certo 💈 Qual seu nome?",
    wait: 900,
  },
  { who: "out", text: "Oi! André", wait: 650 },
  {
    who: "in",
    text: "Boa, André! Qual serviço você quer? Corte, Barba ou Tintura?",
    wait: 1100,
  },
  { who: "out", text: "Corte + Barba", wait: 650 },
  { who: "in", text: "Com qual profissional? João ou Maria?", wait: 900 },
  { who: "out", text: "João", wait: 600 },
  { who: "in", text: "Show! Tenho 29/07 às 10:00 livre. Fecha?", wait: 900 },
  { who: "out", text: "Fecha!", wait: 650 },
  {
    who: "card",
    title: "Agendado ✅",
    text: "29/07 às 10:00 · Corte + Barba · João",
    wait: 900,
  },
];

const chat = document.getElementById("chat");
let chatTimers = [];
let chatPlaying = false;

function esperar(ms) {
  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, ms);
    chatTimers.push(timer);
  });
}

function limparTimers() {
  chatTimers.forEach(window.clearTimeout);
  chatTimers = [];
}

function horarioAtual() {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function rolarChat() {
  chat.scrollTo({ top: chat.scrollHeight, behavior: "smooth" });
}

function criarDigitando() {
  const el = document.createElement("div");
  el.className = "bubble in typing";
  el.setAttribute("aria-label", "Barbearia digitando");
  el.innerHTML = "<span></span><span></span><span></span>";
  return el;
}

function criarMensagem(mensagem) {
  const el = document.createElement("div");
  el.className = `bubble ${mensagem.who}`;

  if (mensagem.who === "card") {
    const titulo = document.createElement("b");
    titulo.textContent = mensagem.title;
    el.append(titulo, document.createTextNode(mensagem.text));
  } else {
    el.textContent = mensagem.text;
  }

  const hora = document.createElement("span");
  hora.className = "message-time";
  hora.textContent = horarioAtual();
  if (mensagem.who === "out") {
    const check = document.createElement("span");
    check.className = "message-check";
    check.textContent = "✓✓";
    hora.appendChild(check);
  }
  el.appendChild(hora);
  return el;
}

async function reproduzirChat() {
  if (!chat || chatPlaying) return;
  chatPlaying = true;
  chat.innerHTML = "";

  for (const mensagem of chatScript) {
    let digitando = null;
    if (mensagem.who === "in" || mensagem.who === "card") {
      digitando = criarDigitando();
      chat.appendChild(digitando);
      rolarChat();
      await esperar(mensagem.wait);
      digitando.remove();
    } else {
      await esperar(mensagem.wait);
    }

    chat.appendChild(criarMensagem(mensagem));
    rolarChat();

    while (chat.children.length > 7) {
      chat.firstElementChild.remove();
    }
  }

  await esperar(3200);
  chatPlaying = false;
  reproduzirChat();
}

function pararChat() {
  limparTimers();
  chatPlaying = false;
}

if (chat) {
  const observador = new IntersectionObserver(
    ([entrada]) => {
      if (entrada.isIntersecting) reproduzirChat();
      else pararChat();
    },
    { threshold: 0.2 },
  );
  observador.observe(chat);
}
