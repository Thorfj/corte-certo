/* ============================================================
   BARBOZAP — LANDING.JS
   Página pública da barbearia (barbozap.com.br/b/<link>).
   Lê só a função pagina_publica() do Supabase (chave pública).
   ============================================================ */

const SUPABASE_URL = "https://jzqiqrymqbzullysukja.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_lqY19MJcqfYcVAABzRgiNg_6h4DIWUO";

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0];

const moeda = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const escapar = (t) =>
  String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function lerSlug() {
  const doParametro = new URLSearchParams(window.location.search).get("s");
  const doCaminho = (window.location.pathname.match(/^\/b\/([a-z0-9-]+)\/?$/i) || [])[1];
  return String(doParametro || doCaminho || "").toLowerCase();
}

function duracaoTexto(min) {
  const m = Number(min) || 0;
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}h${String(m % 60).padStart(2, "0")}` : `${h}h`;
}

// "Aberto agora" / "Fechado agora" pelo horário de funcionamento
function situacaoAgora(horario) {
  if (!horario) return null;
  const agora = new Date();
  const faixa = horario[String(agora.getDay())];
  if (!Array.isArray(faixa)) return { aberto: false, texto: "Fechado hoje" };
  const hm = `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;
  const aberto = hm >= faixa[0] && hm < faixa[1];
  return { aberto, texto: aberto ? `Aberto agora · até ${faixa[1]}` : `Fechado agora · hoje das ${faixa[0]} às ${faixa[1]}` };
}

// Iniciais pro círculo do topo, sem "Barbearia", "do", "da"...
function iniciais(nome) {
  const palavras = String(nome || "").trim().split(/\s+/).filter(Boolean);
  const uteis = palavras.filter((w) => !/^(barbearia|barber|shop|do|da|de|dos|das)$/i.test(w));
  const base = uteis.length ? uteis : palavras;
  return base.slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "B";
}

function linkAgendar(pagina) {
  // Fase 1: abre o WhatsApp da barbearia e o bot atende por lá
  const numero = String(pagina.whatsapp || "").replace(/\D/g, "");
  if (!numero) return null;
  const texto = encodeURIComponent("Oi! Quero agendar um horário.");
  return `https://wa.me/${numero}?text=${texto}`;
}

// Cores escolhidas pelo dono no CRM (fundo + destaque); o resto é calculado em lp-cores.js
function aplicarCores(p) {
  if (!window.LPCores) return;
  const tema = window.LPCores.aplicar(document.documentElement, p.cor_fundo, p.cor_destaque);
  document.querySelector('meta[name="theme-color"]').content = tema.fundo;
  document.documentElement.style.colorScheme = tema.escuro ? "dark" : "light";
}

function linkWhatsapp(pagina) {
  const numero = String(pagina.whatsapp || "").replace(/\D/g, "");
  return `https://wa.me/${numero}?text=${encodeURIComponent(`Oi! Vim pela página da ${pagina.empresa}.`)}`;
}

// ---------------- Agendamento online ----------------
// serviços → dia → horário → profissional (ou sem preferência) → nome, WhatsApp e e-mail.
// Horários livres e a reserva vêm de pagina_horarios() / pagina_agendar() no Supabase,
// com as mesmas regras do bot.
const agenda = {
  ativa: false,
  pagina: null,
  servicos: new Set(),
  dia: null,
  horario: null,
  profs: [],
  prof: null,
  consulta: 0,
};
let clienteSupabase = null;

const DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function hojeBrasilia() {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return new Date(partes + "T12:00:00");
}
const isoData = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function dataPorExtenso(iso) {
  const d = new Date(iso + "T12:00:00");
  return `${DIAS[d.getDay()].toLowerCase()}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

function mostrar(id, visivel) {
  document.getElementById(id).classList.toggle("hidden", !visivel);
}

function iniciarAgenda(p) {
  agenda.pagina = p;
  mostrar("lp-agenda", true);
  document.querySelectorAll(".lp-servico-escolha").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.id);
      if (agenda.servicos.has(id)) agenda.servicos.delete(id);
      else agenda.servicos.add(id);
      btn.setAttribute("aria-pressed", String(agenda.servicos.has(id)));
      aoMudarServicos();
    });
  });
  renderizarDias();
  document.getElementById("lp-passo-dados").addEventListener("submit", confirmarAgendamento);
  document.getElementById("lp-tel-cliente").addEventListener("input", (e) => {
    e.target.value = mascararTelefone(e.target.value);
  });
  document.getElementById("lp-agendar-outro").addEventListener("click", () => {
    agenda.horario = null;
    agenda.prof = null;
    mostrar("lp-sucesso", false);
    mostrar("lp-agenda-passos", true);
    if (agenda.dia) carregarHorarios();
    document.getElementById("lp-secao-servicos").scrollIntoView({ behavior: "smooth" });
  });
  document.getElementById("lp-agendar").addEventListener("click", (e) => {
    e.preventDefault();
    const alvo = agenda.servicos.size ? "lp-agenda" : "lp-secao-servicos";
    document.getElementById(alvo).scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function mascararTelefone(valor) {
  const d = String(valor || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function servicosEscolhidos() {
  return (agenda.pagina.servicos || []).filter((s) => agenda.servicos.has(Number(s.id)));
}

function aoMudarServicos() {
  const tem = agenda.servicos.size > 0;
  mostrar("lp-agenda-sem-servico", !tem);
  mostrar("lp-passo-dia", tem);
  const btn = document.getElementById("lp-agendar");
  const escolhidos = servicosEscolhidos();
  const total = escolhidos.reduce((t, s) => t + Number(s.preco || 0), 0);
  btn.textContent = tem ? `Escolher horário · ${moeda(total)}` : "Agendar horário";
  agenda.horario = null;
  agenda.prof = null;
  if (!tem) {
    ["lp-passo-hora", "lp-passo-prof", "lp-passo-dados"].forEach((id) => mostrar(id, false));
    return;
  }
  if (agenda.dia) carregarHorarios();
}

function renderizarDias() {
  const horario = agenda.pagina.horario_funcionamento || {};
  const inicio = hojeBrasilia();
  const dias = [];
  for (let i = 0; i < 21; i++) {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    const faixa = horario[String(d.getDay())];
    dias.push({ iso: isoData(d), d, aberto: Array.isArray(faixa) });
  }
  const el = document.getElementById("lp-dias");
  el.innerHTML = dias
    .map(({ iso, d, aberto }, i) => `
      <button type="button" class="lp-dia" role="radio" aria-checked="false" data-dia="${iso}" ${aberto ? "" : "disabled"}>
        <span class="lp-dia-semana">${i === 0 ? "Hoje" : i === 1 ? "Amanhã" : DIAS_CURTOS[d.getDay()]}</span>
        <span class="lp-dia-numero">${d.getDate()}</span>
        <span class="lp-dia-mes">${aberto ? MESES[d.getMonth()] : "fechado"}</span>
      </button>`)
    .join("");
  el.querySelectorAll(".lp-dia:not([disabled])").forEach((btn) => {
    btn.addEventListener("click", () => {
      agenda.dia = btn.dataset.dia;
      el.querySelectorAll(".lp-dia").forEach((b) => b.setAttribute("aria-checked", String(b === btn)));
      agenda.horario = null;
      agenda.prof = null;
      carregarHorarios();
    });
  });
}

async function carregarHorarios() {
  const minha = ++agenda.consulta;
  mostrar("lp-passo-hora", true);
  mostrar("lp-passo-prof", false);
  mostrar("lp-passo-dados", false);
  const el = document.getElementById("lp-horas");
  el.innerHTML = '<p class="lp-agenda-aviso">Buscando horários livres...</p>';
  try {
    const { data, error } = await clienteSupabase.rpc("pagina_horarios", {
      p_slug: agenda.pagina.slug,
      p_servicos: [...agenda.servicos],
      p_data: agenda.dia,
    });
    if (minha !== agenda.consulta) return; // o cliente já mudou a escolha
    if (error || !data || !data.ok) throw error || new Error(data && data.reason);
    renderizarHorarios(data.horarios || []);
  } catch (err) {
    console.error(err);
    if (minha !== agenda.consulta) return;
    el.innerHTML = '<p class="lp-agenda-aviso">Não foi possível buscar os horários agora. Tente de novo em instantes.</p>';
  }
}

function renderizarHorarios(horarios) {
  const el = document.getElementById("lp-horas");
  if (!horarios.length) {
    el.innerHTML = '<p class="lp-agenda-aviso">Sem horários livres nesse dia. Escolha outro dia.</p>';
    return;
  }
  const minutos = (h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
  const periodos = [["Manhã", 0, 720], ["Tarde", 720, 1080], ["Noite", 1080, 1440]];
  el.innerHTML = periodos
    .map(([nome, ini, fim]) => {
      const lista = horarios.filter((h) => minutos(h.horario) >= ini && minutos(h.horario) < fim);
      if (!lista.length) return "";
      return `<p class="lp-periodo">${nome}</p>
        <div class="lp-horas" role="radiogroup" aria-label="${nome}">${lista
          .map((h) => `<button type="button" class="lp-hora" role="radio" aria-checked="false" data-hora="${h.horario}">${h.horario}</button>`)
          .join("")}</div>`;
    })
    .join("");
  el.querySelectorAll(".lp-hora").forEach((btn) => {
    btn.addEventListener("click", () => {
      el.querySelectorAll(".lp-hora").forEach((b) => b.setAttribute("aria-checked", String(b === btn)));
      agenda.horario = btn.dataset.hora;
      agenda.profs = (horarios.find((h) => h.horario === agenda.horario) || {}).profissionais || [];
      agenda.prof = null;
      renderizarProfs();
      mostrar("lp-passo-dados", true);
      atualizarResumo();
      document.getElementById("lp-passo-prof").scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  });
}

function renderizarProfs() {
  const el = document.getElementById("lp-profs");
  const opcoes = [{ id: null, nome: "Sem preferência" }, ...agenda.profs];
  el.innerHTML = opcoes
    .map((p) => `<button type="button" class="lp-opcao" role="radio" aria-checked="${p.id === agenda.prof}" data-prof="${p.id ?? ""}">${escapar(p.nome)}</button>`)
    .join("");
  el.querySelectorAll(".lp-opcao").forEach((btn) => {
    btn.addEventListener("click", () => {
      agenda.prof = btn.dataset.prof ? Number(btn.dataset.prof) : null;
      el.querySelectorAll(".lp-opcao").forEach((b) => b.setAttribute("aria-checked", String(b === btn)));
      atualizarResumo();
    });
  });
  // com uma pessoa só, não há o que escolher
  mostrar("lp-passo-prof", agenda.profs.length > 1);
}

function atualizarResumo() {
  const escolhidos = servicosEscolhidos();
  const total = escolhidos.reduce((t, s) => t + Number(s.preco || 0), 0);
  const prof = agenda.profs.find((p) => p.id === agenda.prof);
  document.getElementById("lp-resumo").innerHTML = `
    <p><strong>${escapar(escolhidos.map((s) => s.nome).join(" + "))}</strong> · ${moeda(total)}</p>
    <p>${escapar(dataPorExtenso(agenda.dia))} às ${agenda.horario}${prof ? ` com ${escapar(prof.nome)}` : ""}</p>`;
}

const MENSAGENS_ERRO = {
  horario_ocupado: "Esse horário acabou de ser ocupado. Escolha outro, por favor.",
  telefone_invalido: "Confira o WhatsApp: use o DDD, por exemplo (41) 99999-0000.",
  nome_invalido: "Escreva o seu nome.",
  email_invalido: "Confira o e-mail ou deixe o campo em branco.",
  limite: "Você já tem 3 horários marcados aqui. Para marcar mais, fale com a barbearia pelo WhatsApp.",
  data_invalida: "Escolha o dia e o horário de novo.",
  servicos_invalidos: "Escolha os serviços de novo.",
};

function mostrarErroAgenda(texto) {
  const el = document.getElementById("lp-agenda-erro");
  el.textContent = texto || "";
  el.classList.toggle("hidden", !texto);
}

async function confirmarAgendamento(e) {
  e.preventDefault();
  mostrarErroAgenda("");
  const nome = document.getElementById("lp-nome-cliente").value.trim();
  const tel = document.getElementById("lp-tel-cliente").value.replace(/\D/g, "");
  const email = document.getElementById("lp-email-cliente").value.trim();
  if (nome.length < 2) return mostrarErroAgenda(MENSAGENS_ERRO.nome_invalido);
  if (tel.length < 10) return mostrarErroAgenda(MENSAGENS_ERRO.telefone_invalido);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return mostrarErroAgenda(MENSAGENS_ERRO.email_invalido);
  if (!agenda.dia || !agenda.horario) return mostrarErroAgenda(MENSAGENS_ERRO.data_invalida);

  const btn = document.getElementById("lp-confirmar");
  btn.disabled = true;
  btn.textContent = "Agendando...";
  try {
    const { data, error } = await clienteSupabase.rpc("pagina_agendar", {
      p_slug: agenda.pagina.slug,
      p_servicos: [...agenda.servicos],
      p_data: agenda.dia,
      p_horario: agenda.horario,
      p_prof: agenda.prof,
      p_nome: nome,
      p_telefone: tel,
      p_email: email || null,
    });
    if (error) throw error;
    if (!data || !data.ok) {
      mostrarErroAgenda(MENSAGENS_ERRO[data && data.reason] || "Não foi possível agendar agora. Tente de novo.");
      if (data && data.reason === "horario_ocupado") carregarHorarios();
      return;
    }
    const escolhidos = servicosEscolhidos();
    document.getElementById("lp-sucesso-texto").innerHTML = `
      <strong>${escapar(dataPorExtenso(data.data))} às ${escapar(data.horario)}</strong>
      com ${escapar(data.profissional)}<br>
      ${escapar(escolhidos.map((s) => s.nome).join(" + "))} · ${moeda(data.total)}
      ${agenda.pagina.agendamento_online ? "<br><small>Você recebe um lembrete no WhatsApp antes do horário.</small>" : ""}`;
    mostrar("lp-agenda-passos", false);
    mostrar("lp-sucesso", true);
    document.getElementById("lp-agenda").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    console.error(err);
    mostrarErroAgenda("Não foi possível agendar agora. Verifique a internet e tente de novo.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Confirmar agendamento";
  }
}

function renderizar(p) {
  aplicarCores(p);
  document.title = `${p.empresa} — Agende seu horário`;
  document.querySelector('meta[name="description"]').content =
    p.descricao || `Veja os serviços e agende seu horário na ${p.empresa}.`;

  document.getElementById("lp-avatar").textContent = iniciais(p.empresa);
  document.getElementById("lp-nome").textContent = p.empresa;
  const desc = document.getElementById("lp-descricao");
  desc.textContent = p.descricao || "";
  desc.classList.toggle("hidden", !p.descricao);

  // chips: aberto/fechado + Instagram
  const chips = [];
  const situacao = situacaoAgora(p.horario_funcionamento);
  if (situacao) {
    chips.push(`<span class="lp-chip ${situacao.aberto ? "aberto" : "fechado"}">${escapar(situacao.texto)}</span>`);
  }
  if (p.instagram) {
    const user = String(p.instagram).replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/.*$/, "");
    chips.push(`<a class="lp-chip" href="https://instagram.com/${encodeURIComponent(user)}" target="_blank" rel="noopener">@${escapar(user)}</a>`);
  }
  document.getElementById("lp-chips").innerHTML = chips.join("");

  // serviços (com agendamento online, cada um vira um botão de escolher)
  const servicos = p.servicos || [];
  agenda.ativa = servicos.length > 0 && (p.profissionais || []).length > 0;
  document.getElementById("lp-servicos-dica").classList.toggle("hidden", !agenda.ativa);
  document.getElementById("lp-servicos").innerHTML = servicos.length
    ? servicos
        .map((s) => {
          const conteudo = `
          <div>
            <p class="lp-servico-nome">${escapar(s.nome)}</p>
            <p class="lp-servico-duracao">${duracaoTexto(s.duracao_min)}</p>
          </div>
          <p class="lp-servico-preco">${moeda(s.preco)}</p>`;
          return agenda.ativa
            ? `<li><button type="button" class="lp-servico lp-servico-escolha" data-id="${Number(s.id)}" aria-pressed="false">
                <span class="lp-check" aria-hidden="true"></span>${conteudo}</button></li>`
            : `<li class="lp-servico">${conteudo}</li>`;
        })
        .join("")
    : '<li class="lp-servico-vazio">Os serviços ainda estão sendo cadastrados.</li>';

  // horário de funcionamento (hoje em destaque)
  const hoje = new Date().getDay();
  const h = p.horario_funcionamento || {};
  document.getElementById("lp-horarios").innerHTML = ORDEM_DIAS.map((d) => {
    const faixa = h[String(d)];
    return `<li class="${d === hoje ? "hoje" : ""}">
      <span>${DIAS[d]}</span>
      <span>${Array.isArray(faixa) ? `${faixa[0]} às ${faixa[1]}` : "Fechado"}</span>
    </li>`;
  }).join("");

  // endereço
  if (p.endereco) {
    document.getElementById("lp-secao-endereco").classList.remove("hidden");
    document.getElementById("lp-endereco").textContent = p.endereco;
    document.getElementById("lp-mapa").href =
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.endereco)}`;
  }

  // barra fixa: "Agendar horário" (aqui na página) + "WhatsApp"
  const link = linkAgendar(p);
  const btnAgendar = document.getElementById("lp-agendar");
  const btnWhats = document.getElementById("lp-whats");
  if (link) {
    btnWhats.href = linkWhatsapp(p);
    btnWhats.classList.remove("hidden");
  }
  if (agenda.ativa) {
    iniciarAgenda(p);
    btnAgendar.removeAttribute("target");
  } else if (link) {
    // sem serviços/profissionais cadastrados: agenda pelo WhatsApp, como antes
    btnAgendar.href = link;
    btnAgendar.target = "_blank";
    btnWhats.classList.add("hidden");
  } else {
    btnAgendar.classList.add("hidden");
  }
  if (agenda.ativa || link) document.getElementById("lp-cta").classList.remove("hidden");

  document.getElementById("lp-carregando").classList.add("hidden");
  document.getElementById("lp-conteudo").classList.remove("hidden");
}

function naoEncontrada() {
  document.title = "Página não encontrada — Barbozap";
  document.getElementById("lp-carregando").classList.add("hidden");
  document.getElementById("lp-vazio").classList.remove("hidden");
}

(async () => {
  const slug = lerSlug();
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return naoEncontrada();

  // mostra o endereço bonito (/b/<link>) mesmo quando veio pelo 404.html
  if (window.location.pathname !== `/b/${slug}`) {
    history.replaceState(null, "", `/b/${slug}`);
  }

  try {
    clienteSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await clienteSupabase.rpc("pagina_publica", { p_slug: slug });
    if (error || !data) return naoEncontrada();
    renderizar(data);
  } catch (err) {
    console.error(err);
    naoEncontrada();
  }
})();
