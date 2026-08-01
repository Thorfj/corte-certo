// Hero WhatsApp chat sequence — mirrors the real Mensagens flow
const script = [
  {
    who: "in",
    text: "oiee! bem-vindo à Barbearia Corte Certo 💈 qual seu nome?",
  },
  { who: "out", text: "Oi! André" },
  {
    who: "in",
    text: "boa André! qual serviço você quer? Corte, Barba ou Tintura?",
  },
  { who: "out", text: "Corte + Barba" },
  { who: "in", text: "com qual profissional? João ou Maria?" },
  { who: "out", text: "João" },
  { who: "in", text: "show. tenho 29/07 às 10:00 livre, fecha?" },
  { who: "out", text: "Fecha!" },
  {
    who: "card",
    title: "Agendado ✅",
    text: "29/07 às 10:00 · Corte + Barba · João",
  },
];

const chat = document.getElementById("chat");
let i = 0;

function playChat() {
  chat.innerHTML = "";
  i = 0;
  step();
}

function step() {
  if (i >= script.length) {
    setTimeout(playChat, 2900);
    return;
  }
  const m = script[i];
  const el = document.createElement("div");
  if (m.who === "card") {
    el.className = "bubble card";
    el.innerHTML = "<b>" + m.title + "</b>" + m.text;
  } else {
    el.className = "bubble " + m.who;
    el.textContent = m.text;
  }
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;

  // keep only last 6 bubbles visible to avoid overflow
  while (chat.children.length > 6) {
    chat.removeChild(chat.firstChild);
  }

  i++;
  setTimeout(step, m.who === "out" ? 1100 : 1700);
}

playChat();
