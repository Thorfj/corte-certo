if (typeof lucide !== "undefined") {
  lucide.createIcons();
} else {
  console.error("Lucide não carregou — verifique a conexão com unpkg.com");
}

let barbeariaCache = null;
let profissionalAtualCache = null;
let cobrancasCache = [];
let cnpjAtualCache = null;

// Webhook n8n que inicia o OAuth do Google. Recebe a barbearia_id (onde salvar
// o token) e a URL desta página (pra onde voltar depois da autorização).
const GOOGLE_OAUTH_URL =
  "https://n8n.srv2088418.hstgr.cloud/webhook/google-oauth-iniciar";

// TODO: ajustar para a URL real da Edge Function depois do deploy
const CRIAR_USUARIO_URL =
  "https://jzqiqrymqbzullysukja.supabase.co/functions/v1/criar-usuario";

const ALTERAR_SENHA_URL =
  "https://jzqiqrymqbzullysukja.supabase.co/functions/v1/alterar-senha-usuario";
const EXCLUIR_USUARIO_URL =
  "https://jzqiqrymqbzullysukja.supabase.co/functions/v1/excluir-usuario";

// A agenda de cada profissional é criada pelo n8n na conta Google da
// barbearia; aqui só mostramos o status (o ID não é editável).
function textoAgenda(agendas) {
  return agendas
    ? "Criada automaticamente ✅"
    : "Será criada quando o Google Agenda estiver conectado";
}

async function obterProfissionalAtual() {
  if (profissionalAtualCache) return profissionalAtualCache;
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  const { data, error } = await supabaseClient
    .from("profissionais")
    .select("id, acesso, tema")
    .eq("auth_user_id", user.id)
    .single();
  if (error) throw error;
  profissionalAtualCache = data;
  return profissionalAtualCache;
}

// ---------------- TABS ----------------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".tab-btn")
      .forEach((b) => b.classList.remove("active"));
    document
      .querySelectorAll(".tab-panel")
      .forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
  });
});

// Links dos "Primeiros passos": ?aba=usuarios abre a aba; #card-... rola até o cartão
(() => {
  const aba = new URLSearchParams(window.location.search).get("aba");
  if (aba) document.querySelector(`.tab-btn[data-tab="${aba}"]`)?.click();
})();

function irParaCartaoDoLink() {
  const alvo = window.location.hash && document.querySelector(window.location.hash);
  if (!alvo || alvo.classList.contains("hidden")) return;
  alvo.scrollIntoView({ behavior: "smooth", block: "start" });
  alvo.classList.add("cartao-destaque");
  setTimeout(() => alvo.classList.remove("cartao-destaque"), 2500);
}

// ---------------- ABA GERAL ----------------
async function carregarGeral() {
  const barbeariaId = await obterBarbeariaId();
  const { data, error } = await supabaseClient
    .from("barbearias")
    .select(
      "id, empresa, email, whatsapp, whatsapp_barbearia, cliente, google_calendar_status, google_calendar_email, horario_funcionamento",
    )
    .eq("id", barbeariaId)
    .single();

  if (error) {
    document.getElementById("g-erro").textContent =
      "Erro ao carregar configurações.";
    document.getElementById("g-erro").style.display = "block";
    return;
  }

  barbeariaCache = data;
  document.getElementById("g-empresa").value = data.empresa || "";
  document.getElementById("g-email").value = data.email || "";
  document.getElementById("g-whatsapp").value = data.whatsapp || "";
  mostrarDonoDoAssistente(data.whatsapp);

  atualizarStatusPlano(data);
  await configurarAparenciaEGoogle(data);
}

// ---------------- ABA GERAL — Assistente no WhatsApp ----------------
// O assistente (n8n "Assistente do dono") só responde ao barbearias.whatsapp,
// o campo "Seu WhatsApp (dono)" acima.
function mostrarDonoDoAssistente(numero) {
  const el = document.getElementById("assistente-dono");
  el.textContent = numero
    ? `Ele responde só ao seu WhatsApp cadastrado: ${formatarTelefone(numero)}.`
    : "Preencha \"Seu WhatsApp (dono)\" acima para o assistente reconhecer você.";
  el.classList.toggle("assistente-alerta", !numero);
}

// ---------------- ABA GERAL — Aparência (tema) ----------------
function marcarTemaAtivo(tema) {
  document.querySelectorAll(".tema-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tema === tema);
  });
}

document.querySelectorAll(".tema-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const tema = btn.dataset.tema;
    marcarTemaAtivo(tema);

    if (tema === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    localStorage.setItem("corteCerto:tema", tema);

    try {
      const { error } = await supabaseClient.rpc("update_meu_tema", {
        novo_tema: tema,
      });
      if (error) throw error;
      if (profissionalAtualCache) profissionalAtualCache.tema = tema;
    } catch (err) {
      console.error(err);
    }
  });
});

// ---------------- ABA GERAL — Google Calendar ----------------
function atualizarStatusGoogle(barbearia) {
  const badge = document.getElementById("google-status-badge");
  const conectarBtn = document.getElementById("google-conectar-btn");
  const conectado = barbearia.google_calendar_status === "conectado";
  // autorizou o Google mas desmarcou a permissão da agenda: o token não serve para criar agendas
  const semPermissao = barbearia.google_calendar_status === "sem_permissao";

  badge.textContent = conectado
    ? `Conectado ✅${barbearia.google_calendar_email ? " — " + barbearia.google_calendar_email : ""}`
    : semPermissao
      ? "Falta a permissão da agenda ⚠️"
      : "Desconectado";
  badge.classList.toggle("conectado", conectado);
  badge.classList.toggle("alerta", semPermissao);
  conectarBtn.textContent = conectado
    ? "Reconectar com Google"
    : semPermissao
      ? "Conectar de novo"
      : "Conectar com Google";
  const aviso = document.getElementById("google-aviso");
  aviso.classList.toggle("hidden", !semPermissao);
  const retorno = encodeURIComponent(
    window.location.origin + window.location.pathname,
  );
  conectarBtn.href = `${GOOGLE_OAUTH_URL}?barbearia_id=${barbearia.id}&retorno=${retorno}`;
}

async function configurarAparenciaEGoogle(barbearia) {
  const profissional = await obterProfissionalAtual();
  marcarTemaAtivo(profissional.tema === "dark" ? "dark" : "light");

  const cardGoogle = document.getElementById("card-google");
  const cardHorario = document.getElementById("card-horario");
  if (profissional.acesso === "admin") {
    cardGoogle.classList.remove("hidden");
    atualizarStatusGoogle(barbearia);
    cardHorario.classList.remove("hidden");
    renderizarHorario(barbearia.horario_funcionamento);
    iniciarCardWhatsapp(barbearia);
    irParaCartaoDoLink();
  } else {
    cardGoogle.classList.add("hidden");
    cardHorario.classList.add("hidden");
  }
}

// ---------------- ABA GERAL — WhatsApp do bot ----------------
// O n8n (workflow "Conexão WhatsApp") confere se quem chama é admin e fala com a
// Evolution API usando o whatsapp_barbearia como nome da instância. A chave da
// Evolution nunca passa pelo navegador.
const WHATSAPP_CONEXAO_URL = "https://n8n.srv2088418.hstgr.cloud/webhook/whatsapp-conexao";
const WHATSAPP_POLL_MS = 4000; // confere se o WhatsApp já conectou
const WHATSAPP_QR_RENOVA_MS = 35000; // o QR da Evolution expira em ~40s
const WHATSAPP_QR_LIMITE_MS = 180000; // depois de 3 min sem conectar, para e pede para tentar de novo
let whatsappPoll = null;
let whatsappRenova = null;
let whatsappLimite = null;

// Dois jeitos de conectar:
//  - "qr": lê o QR Code com outro aparelho (padrão no computador);
//  - "codigo": código de pareamento de 8 letras, digitado no próprio WhatsApp em
//    "Conectar com número de telefone" (padrão no celular, que não consegue ler a própria tela).
const WHATSAPP_EH_CELULAR =
  /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
  window.matchMedia("(pointer: coarse) and (max-width: 900px)").matches;
let whatsappModo = WHATSAPP_EH_CELULAR ? "codigo" : "qr";

async function chamarConexaoWhatsapp(acao, extra = {}) {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  const resp = await fetch(WHATSAPP_CONEXAO_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ acao, ...extra }),
  });
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok || dados.erro) {
    throw new Error(dados.erro || "Não foi possível falar com o WhatsApp agora.");
  }
  return dados;
}

function pararEsperaWhatsapp() {
  clearInterval(whatsappPoll);
  clearInterval(whatsappRenova);
  clearTimeout(whatsappLimite);
  whatsappPoll = whatsappRenova = whatsappLimite = null;
}

function mostrarEstadoWhatsapp(estado) {
  const badge = document.getElementById("whatsapp-status-badge");
  const conectarBtn = document.getElementById("whatsapp-conectar-btn");
  const desconectarBtn = document.getElementById("whatsapp-desconectar-btn");
  const trocarBtn = document.getElementById("whatsapp-trocar-modo-btn");
  const conectado = estado === "open";
  const aguardando = estado === "connecting" && whatsappPoll;

  badge.textContent = conectado
    ? "Conectado ✅"
    : aguardando
      ? whatsappModo === "codigo"
        ? "Aguardando o código no WhatsApp…"
        : "Aguardando leitura do QR Code…"
      : "Desconectado";
  badge.classList.toggle("conectado", conectado);
  badge.classList.toggle("aguardando", Boolean(aguardando));
  conectarBtn.classList.toggle("hidden", conectado || Boolean(aguardando));
  desconectarBtn.classList.toggle("hidden", !conectado);
  trocarBtn.classList.toggle("hidden", !aguardando);
  // O número do bot só pode ser trocado com o WhatsApp desconectado (o nome da instância é o número)
  document.getElementById("whatsapp-trocar-numero-btn").classList.toggle("hidden", conectado || Boolean(aguardando));
  if (conectado || aguardando) document.getElementById("whatsapp-trocar-form").classList.add("hidden");
  trocarBtn.textContent =
    whatsappModo === "codigo"
      ? "Prefere ler um QR Code com outro aparelho?"
      : "Está no celular? Conectar com código em vez do QR Code";
  if (conectado || !aguardando) {
    document.getElementById("whatsapp-qr").classList.add("hidden");
    document.getElementById("whatsapp-codigo").classList.add("hidden");
  }
}

function mostrarErroWhatsapp(msg) {
  const erroEl = document.getElementById("whatsapp-erro");
  erroEl.textContent = msg || "";
  erroEl.style.display = msg ? "block" : "none";
}

async function iniciarCardWhatsapp(barbearia) {
  const card = document.getElementById("card-whatsapp");
  card.classList.remove("hidden");
  const numero = formatarTelefone(barbearia.whatsapp_barbearia);
  document.querySelectorAll(".whatsapp-numero").forEach((el) => (el.textContent = numero));
  try {
    const { estado } = await chamarConexaoWhatsapp("status");
    mostrarEstadoWhatsapp(estado);
  } catch (err) {
    console.error(err);
    mostrarEstadoWhatsapp("close");
    mostrarErroWhatsapp(err.message);
  }
}

function formatarTelefone(numero) {
  const d = String(numero || "").replace(/\D/g, "").replace(/^55/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return numero || "cadastrado";
}

function formatarCodigoPareamento(codigo) {
  const c = String(codigo || "").replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

async function pedirConexaoWhatsapp() {
  const dados = await chamarConexaoWhatsapp("conectar", { modo: whatsappModo });
  if (dados.estado === "open") {
    pararEsperaWhatsapp();
    mostrarEstadoWhatsapp("open");
    return;
  }
  const qrEl = document.getElementById("whatsapp-qr");
  const codigoEl = document.getElementById("whatsapp-codigo");
  if (whatsappModo === "codigo") {
    if (!dados.codigo) {
      // Sem código (versão da Evolution sem suporte ou número não aceito): cai para o QR Code.
      whatsappModo = "qr";
      codigoEl.classList.add("hidden");
      mostrarErroWhatsapp("Não foi possível gerar o código agora. Use o QR Code abaixo ou tente o código de novo em instantes.");
      iniciarRenovacaoQr();
      mostrarEstadoWhatsapp("connecting");
      if (!dados.qr) return pedirConexaoWhatsapp();
    } else {
      document.getElementById("whatsapp-codigo-valor").textContent = formatarCodigoPareamento(dados.codigo);
      qrEl.classList.add("hidden");
      codigoEl.classList.remove("hidden");
      return;
    }
  }
  if (dados.qr) {
    document.getElementById("whatsapp-qr-img").src = dados.qr;
    codigoEl.classList.add("hidden");
    qrEl.classList.remove("hidden");
  }
}

// O QR expira rápido e é renovado sozinho. O código não: renová-lo enquanto a
// pessoa digita invalidaria o que ela está vendo, então ele só muda pelo botão.
function iniciarRenovacaoQr() {
  clearInterval(whatsappRenova);
  whatsappRenova = whatsappModo === "qr"
    ? setInterval(() => pedirConexaoWhatsapp().catch(console.error), WHATSAPP_QR_RENOVA_MS)
    : null;
}

async function iniciarConexaoWhatsapp() {
  mostrarErroWhatsapp("");
  pararEsperaWhatsapp();
  // marca como "aguardando" antes do primeiro QR/código, para o botão sumir
  whatsappPoll = setInterval(async () => {
    try {
      const { estado } = await chamarConexaoWhatsapp("status");
      if (estado === "open") {
        pararEsperaWhatsapp();
        mostrarEstadoWhatsapp("open");
      }
    } catch (err) {
      console.error(err);
    }
  }, WHATSAPP_POLL_MS);
  iniciarRenovacaoQr();
  whatsappLimite = setTimeout(() => {
    pararEsperaWhatsapp();
    mostrarEstadoWhatsapp("close");
    mostrarErroWhatsapp(
      whatsappModo === "codigo"
        ? "O código expirou. Toque em Conectar WhatsApp para gerar outro."
        : "O QR Code expirou. Clique em Conectar WhatsApp para gerar outro.",
    );
  }, WHATSAPP_QR_LIMITE_MS);
  mostrarEstadoWhatsapp("connecting");
  await pedirConexaoWhatsapp();
}

async function conectarWhatsappComBotao(btn) {
  btn.disabled = true;
  try {
    await iniciarConexaoWhatsapp();
  } catch (err) {
    console.error(err);
    pararEsperaWhatsapp();
    mostrarEstadoWhatsapp("close");
    mostrarErroWhatsapp(err.message);
  } finally {
    btn.disabled = false;
  }
}

document.getElementById("whatsapp-conectar-btn").addEventListener("click", (e) =>
  conectarWhatsappComBotao(e.currentTarget),
);

document.getElementById("whatsapp-novo-codigo-btn").addEventListener("click", (e) => {
  whatsappModo = "codigo";
  conectarWhatsappComBotao(e.currentTarget);
});

document.getElementById("whatsapp-trocar-modo-btn").addEventListener("click", (e) => {
  whatsappModo = whatsappModo === "codigo" ? "qr" : "codigo";
  conectarWhatsappComBotao(e.currentTarget);
});

// ---------------- ABA GERAL — Trocar o número do bot ----------------
// O número do bot (barbearias.whatsapp_barbearia) é diferente do WhatsApp do dono
// (barbearias.whatsapp, usado pelo Assistente). Os dois podem ser iguais, mas o dono escolhe.
function normalizarNumeroBot(valor) {
  const d = String(valor || "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return "55" + d;
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return d;
  return null;
}

document.getElementById("whatsapp-trocar-numero-btn").addEventListener("click", () => {
  const form = document.getElementById("whatsapp-trocar-form");
  form.classList.remove("hidden");
  const input = document.getElementById("whatsapp-novo-numero");
  input.value = "";
  input.focus();
  mostrarErroWhatsapp("");
});

document.getElementById("whatsapp-cancelar-numero-btn").addEventListener("click", () => {
  document.getElementById("whatsapp-trocar-form").classList.add("hidden");
  mostrarErroWhatsapp("");
});

document.getElementById("whatsapp-trocar-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  mostrarErroWhatsapp("");
  const numero = normalizarNumeroBot(document.getElementById("whatsapp-novo-numero").value);
  if (!numero) {
    mostrarErroWhatsapp("Informe o número com DDD, por exemplo (41) 99999-0000.");
    return;
  }
  if (barbeariaCache && numero === barbeariaCache.whatsapp_barbearia) {
    document.getElementById("whatsapp-trocar-form").classList.add("hidden");
    return;
  }
  const confirmado = await confirmarAcao(
    `Trocar o número do bot para ${formatarTelefone(numero)}? Depois você conecta o WhatsApp desse número aqui mesmo.`,
    "Trocar número",
  );
  if (!confirmado) return;

  const btn = document.getElementById("whatsapp-salvar-numero-btn");
  btn.disabled = true;
  btn.textContent = "Salvando...";
  try {
    // Remove a conexão pendente do número antigo na Evolution (se houver) antes de trocar.
    await chamarConexaoWhatsapp("desconectar").catch((err) => console.error(err));
    const barbeariaId = await obterBarbeariaId();
    const { error } = await supabaseClient
      .from("barbearias")
      .update({ whatsapp_barbearia: numero })
      .eq("id", barbeariaId);
    if (error) {
      if (error.code === "23505") throw new Error("Esse número já é o bot de outra conta. Use outro número ou fale com o suporte.");
      throw new Error("Não foi possível trocar o número. Você precisa ser admin da barbearia.");
    }
    if (barbeariaCache) barbeariaCache.whatsapp_barbearia = numero;
    const formatado = formatarTelefone(numero);
    document.querySelectorAll(".whatsapp-numero").forEach((el) => (el.textContent = formatado));
    document.getElementById("whatsapp-trocar-form").classList.add("hidden");
    pararEsperaWhatsapp();
    mostrarEstadoWhatsapp("close");
  } catch (err) {
    console.error(err);
    mostrarErroWhatsapp(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Salvar número";
  }
});

document.getElementById("whatsapp-copiar-btn").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  const codigo = document.getElementById("whatsapp-codigo-valor").textContent.replace(/-/g, "");
  try {
    await navigator.clipboard.writeText(codigo);
  } catch {
    // navegador sem clipboard: seleciona o texto para a pessoa copiar na mão
    const range = document.createRange();
    range.selectNodeContents(document.getElementById("whatsapp-codigo-valor"));
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    return;
  }
  const original = btn.innerHTML;
  btn.textContent = "Copiado ✅";
  setTimeout(() => (btn.innerHTML = original), 2000);
});

document.getElementById("whatsapp-desconectar-btn").addEventListener("click", async () => {
  const confirmado = await confirmarAcao(
    "Desconectar o WhatsApp? O bot para de responder seus clientes até você conectar de novo.",
    "Desconectar",
    "danger",
  );
  if (!confirmado) return;
  const btn = document.getElementById("whatsapp-desconectar-btn");
  btn.disabled = true;
  mostrarErroWhatsapp("");
  try {
    const { estado } = await chamarConexaoWhatsapp("desconectar");
    mostrarEstadoWhatsapp(estado);
  } catch (err) {
    console.error(err);
    mostrarErroWhatsapp(err.message);
  } finally {
    btn.disabled = false;
  }
});

// ---------------- ABA GERAL — Horário de funcionamento ----------------
// Formato salvo em barbearias.horario_funcionamento:
//   { "0": null, "1": ["09:00","19:00"], ... }  (0 = domingo ... 6 = sábado; null = fechado)
// O bot (etapa 00501 no n8n) só oferece horários dentro desse período.
const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0];
const HORARIO_PADRAO = { 0: null, 1: ["09:00", "19:00"], 2: ["09:00", "19:00"], 3: ["09:00", "19:00"], 4: ["09:00", "19:00"], 5: ["09:00", "19:00"], 6: ["09:00", "19:00"] };

function renderizarHorario(horario) {
  const h = horario && typeof horario === "object" ? horario : HORARIO_PADRAO;
  const lista = document.getElementById("horario-lista");
  lista.innerHTML = ORDEM_DIAS.map((d) => {
    const faixa = h[d] ?? h[String(d)] ?? null;
    const aberto = Array.isArray(faixa);
    const [ini, fim] = aberto ? faixa : ["09:00", "19:00"];
    return `
      <div class="horario-linha${aberto ? "" : " fechado"}" data-dia="${d}">
        <span class="horario-dia">${DIAS_SEMANA[d]}</span>
        <label class="horario-aberto">
          <input type="checkbox" class="h-aberto" ${aberto ? "checked" : ""}> ${aberto ? "Aberto" : "Fechado"}
        </label>
        <div class="horario-horas">
          <input type="time" class="h-ini" value="${ini}" step="900">
          <span class="text-secondary">até</span>
          <input type="time" class="h-fim" value="${fim}" step="900">
        </div>
      </div>`;
  }).join("");

  lista.querySelectorAll(".h-aberto").forEach((chk) => {
    chk.addEventListener("change", () => {
      const linha = chk.closest(".horario-linha");
      linha.classList.toggle("fechado", !chk.checked);
      chk.parentElement.lastChild.textContent = chk.checked ? " Aberto" : " Fechado";
    });
  });
}

document.getElementById("form-horario").addEventListener("submit", async (e) => {
  e.preventDefault();
  const erroEl = document.getElementById("h-erro");
  const sucessoEl = document.getElementById("h-sucesso");
  const salvarBtn = document.getElementById("h-salvar-btn");
  erroEl.style.display = "none";
  sucessoEl.style.display = "none";

  const horario = {};
  for (const linha of document.querySelectorAll("#horario-lista .horario-linha")) {
    const dia = linha.dataset.dia;
    if (!linha.querySelector(".h-aberto").checked) {
      horario[dia] = null;
      continue;
    }
    const ini = linha.querySelector(".h-ini").value;
    const fim = linha.querySelector(".h-fim").value;
    if (!ini || !fim || ini >= fim) {
      erroEl.textContent = `Confira o horário de ${DIAS_SEMANA[dia]}: a abertura precisa ser antes do fechamento.`;
      erroEl.style.display = "block";
      return;
    }
    horario[dia] = [ini, fim];
  }

  salvarBtn.disabled = true;
  salvarBtn.textContent = "Salvando...";
  try {
    const barbeariaId = await obterBarbeariaId();
    const { error } = await supabaseClient
      .from("barbearias")
      .update({ horario_funcionamento: horario })
      .eq("id", barbeariaId);
    if (error) throw error;
    if (barbeariaCache) barbeariaCache.horario_funcionamento = horario;
    try {
      localStorage.setItem(`barbozap:horarioConferido:${barbeariaId}`, "1");
    } catch {
      // só serve pro checklist de Primeiros passos
    }
    sucessoEl.style.display = "block";
    setTimeout(() => {
      sucessoEl.style.display = "none";
    }, 3000);
  } catch (err) {
    console.error(err);
    erroEl.textContent = "Erro ao salvar o horário. Tente novamente.";
    erroEl.style.display = "block";
  } finally {
    salvarBtn.disabled = false;
    salvarBtn.textContent = "Salvar horário";
  }
});

document.getElementById("form-geral").addEventListener("submit", async (e) => {
  e.preventDefault();

  const erroEl = document.getElementById("g-erro");
  const sucessoEl = document.getElementById("g-sucesso");
  const salvarBtn = document.getElementById("g-salvar-btn");
  erroEl.style.display = "none";
  sucessoEl.style.display = "none";
  salvarBtn.disabled = true;
  salvarBtn.textContent = "Salvando...";

  try {
    const barbeariaId = await obterBarbeariaId();
    const { error } = await supabaseClient
      .from("barbearias")
      .update({
        empresa: document.getElementById("g-empresa").value.trim(),
        email: document.getElementById("g-email").value.trim() || null,
        whatsapp: document.getElementById("g-whatsapp").value.trim() || null,
      })
      .eq("id", barbeariaId);

    if (error) throw error;
    mostrarDonoDoAssistente(document.getElementById("g-whatsapp").value.trim());

    sucessoEl.style.display = "block";
    setTimeout(() => {
      sucessoEl.style.display = "none";
    }, 3000);
  } catch (err) {
    console.error(err);
    erroEl.textContent =
      "Erro ao salvar. Você precisa ter papel de admin para editar essas configurações.";
    erroEl.style.display = "block";
  } finally {
    salvarBtn.disabled = false;
    salvarBtn.textContent = "Salvar alterações";
  }
});

// ---------------- ABA USUÁRIOS ----------------
// FIX: antes buscava TODOS os profissionais visíveis pela RLS, sem
// filtrar pela barbearia do usuário logado. Por isso apareciam usuários
// de outras barbearias (ex: "Usuário Teste").
async function carregarUsuarios() {
  const barbeariaId = await obterBarbeariaId();
  const { data, error } = await supabaseClient
    .from("profissionais")
    .select("id, nome, email, acesso, agendas, atende_clientes")
    .eq("barbearia_id", barbeariaId)
    .is("removido_em", null)
    .order("nome", { ascending: true });
  const meuProf = await obterMeuProfissional();

  const body = document.getElementById("tabela-usuarios-body");

  if (error) {
    body.innerHTML =
      '<tr><td colspan="6" class="empty">Erro ao carregar usuários.</td></tr>';
    return;
  }

  if (!data || data.length === 0) {
    body.innerHTML =
      '<tr><td colspan="6" class="empty">Nenhum usuário cadastrado.</td></tr>';
    return;
  }

  const rotulos = {
    admin: "Admin",
    usuario: "Usuário",
  };

  body.innerHTML = data
    .map(
      (u) => `
    <tr class="clickable" data-editar="${u.id}">
      <td>${u.nome}</td>
      <td>${u.email}</td>
      <td><span class="badge">${rotulos[u.acesso] || u.acesso}</span></td>
      <td>${u.atende_clientes ? "Sim" : '<span class="texto-mudo">Não</span>'}</td>
      <td>${u.agendas ? "✅ Criada automaticamente" : "—"}</td>
      <td class="col-acoes">
        <button class="icon-btn" data-trocar-senha="${u.id}" data-nome="${u.nome}" title="Alterar senha">
          <i data-lucide="key" style="width:16px;height:16px"></i>
        </button>
        <i data-lucide="pencil" style="width:16px;height:16px"></i>
        ${u.id === meuProf.id ? "" : `
        <button class="icon-btn icon-btn-excluir" data-excluir="${u.id}" data-nome="${u.nome}" title="Excluir usuário">
          <i data-lucide="trash-2" style="width:16px;height:16px"></i>
        </button>`}
      </td>
    </tr>
  `,
    )
    .join("");

  if (typeof lucide !== "undefined") lucide.createIcons();

  // sem ninguém atendendo, o bot não tem profissional para oferecer
  document
    .getElementById("usuarios-aviso-atende")
    .classList.toggle("hidden", data.some((u) => u.atende_clientes));

  body.querySelectorAll("[data-editar]").forEach((tr) => {
    tr.addEventListener("click", () => {
      const usuario = data.find((u) => String(u.id) === tr.dataset.editar);
      abrirModalUsuario(usuario);
    });
  });

  body.querySelectorAll("[data-trocar-senha]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      abrirModalAlterarSenha(btn.dataset.trocarSenha, btn.dataset.nome);
    });
  });

  body.querySelectorAll("[data-excluir]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      excluirUsuario(btn.dataset.excluir, btn.dataset.nome);
    });
  });
}

function mostrarAvisoUsuarios(texto, ok = false) {
  const aviso = document.getElementById("usuarios-aviso");
  aviso.textContent = texto;
  aviso.classList.toggle("ok", ok);
  aviso.classList.remove("hidden");
}

async function excluirUsuario(profissionalId, nome) {
  document.getElementById("usuarios-aviso").classList.add("hidden");

  const confirmado = await confirmarAcao(
    `Excluir ${nome}? Essa pessoa perde o acesso ao CRM e deixa de aparecer no WhatsApp e na agenda. ` +
      "Os atendimentos que ela já fez continuam nos relatórios. Essa ação não pode ser desfeita.",
    "Excluir usuário",
    "danger",
  );
  if (!confirmado) return;

  try {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();

    const resp = await fetch(EXCLUIR_USUARIO_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ profissional_id: profissionalId }),
    });

    const resultado = await resp.json();
    if (!resp.ok || resultado.error) {
      throw new Error(resultado.error || "Erro ao excluir usuário.");
    }

    mostrarAvisoUsuarios(`${nome} foi excluído.`, true);
    await carregarUsuarios();
  } catch (err) {
    console.error(err);
    mostrarAvisoUsuarios(err.message || "Erro ao excluir usuário.");
  }
}

function abrirModalAlterarSenha(profissionalId, nome) {
  document.getElementById("form-alterar-senha").reset();
  document.getElementById("as-erro").style.display = "none";
  document.getElementById("as-profissional-id").value = profissionalId;
  document.getElementById("as-usuario-nome").textContent =
    `Definindo uma nova senha de acesso pra ${nome}.`;
  document.getElementById("modal-alterar-senha").classList.remove("hidden");
}

document
  .getElementById("form-alterar-senha")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const profissionalId = document.getElementById("as-profissional-id").value;
    const novaSenha = document.getElementById("as-nova-senha").value;
    const erroEl = document.getElementById("as-erro");
    const salvarBtn = document.getElementById("as-salvar-btn");

    erroEl.style.display = "none";

    if (novaSenha.length < 6) {
      erroEl.textContent = "A senha precisa ter pelo menos 6 caracteres.";
      erroEl.style.display = "block";
      return;
    }

    salvarBtn.disabled = true;
    salvarBtn.textContent = "Salvando...";

    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();

      const resp = await fetch(ALTERAR_SENHA_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          profissional_id: profissionalId,
          nova_senha: novaSenha,
        }),
      });

      const resultado = await resp.json();
      if (!resp.ok || resultado.error) {
        throw new Error(resultado.error || "Erro ao alterar a senha.");
      }

      document.getElementById("modal-alterar-senha").classList.add("hidden");
    } catch (err) {
      console.error(err);
      erroEl.textContent = err.message || "Erro ao alterar a senha.";
      erroEl.style.display = "block";
    } finally {
      salvarBtn.disabled = false;
      salvarBtn.textContent = "Salvar nova senha";
    }
  });

function abrirModalUsuario(usuario) {
  document.getElementById("form-usuario").reset();
  document.getElementById("us-erro").style.display = "none";

  const senhaField = document.getElementById("us-senha-field");
  const senhaInput = document.getElementById("us-senha");

  if (usuario) {
    document.getElementById("modal-usuario-titulo").textContent =
      "Editar Usuário";
    document.getElementById("us-id").value = usuario.id;
    document.getElementById("us-nome").value = usuario.nome;
    document.getElementById("us-email").value = usuario.email;
    document.getElementById("us-acesso").value = usuario.acesso;
    document.getElementById("us-agenda").value = textoAgenda(usuario.agendas);
    document.getElementById("us-atende").checked = usuario.atende_clientes !== false;
    senhaField.style.display = "none";
    senhaInput.required = false;
  } else {
    document.getElementById("modal-usuario-titulo").textContent =
      "Novo Usuário";
    document.getElementById("us-id").value = "";
    document.getElementById("us-agenda").value = textoAgenda(null);
    senhaField.style.display = "block";
    senhaInput.required = true;
  }

  // campo de UID manual removido do fluxo — a Edge Function cuida disso
  document.getElementById("modal-usuario").classList.remove("hidden");
}

document
  .getElementById("novo-usuario-btn")
  .addEventListener("click", () => abrirModalUsuario(null));

function abrirModalAlterarSenha(profissionalId, nome) {
  document.getElementById("form-alterar-senha").reset();
  document.getElementById("as-erro").style.display = "none";
  document.getElementById("as-profissional-id").value = profissionalId;
  document.getElementById("as-usuario-nome").textContent =
    `Definindo uma nova senha pra ${nome}.`;
  document.getElementById("modal-alterar-senha").classList.remove("hidden");
}

document
  .getElementById("form-alterar-senha")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const profissionalId = document.getElementById("as-profissional-id").value;
    const novaSenha = document.getElementById("as-nova-senha").value;
    const erroEl = document.getElementById("as-erro");
    const salvarBtn = document.getElementById("as-salvar-btn");

    erroEl.style.display = "none";

    if (novaSenha.length < 6) {
      erroEl.textContent = "A senha precisa ter pelo menos 6 caracteres.";
      erroEl.style.display = "block";
      return;
    }

    salvarBtn.disabled = true;
    salvarBtn.textContent = "Salvando...";

    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();

      const resp = await fetch(
        "https://jzqiqrymqbzullysukja.supabase.co/functions/v1/alterar-senha-usuario",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            profissional_id: profissionalId,
            nova_senha: novaSenha,
          }),
        },
      );

      const resultado = await resp.json();
      if (!resp.ok || resultado.error) {
        throw new Error(resultado.error || "Erro ao alterar a senha.");
      }

      document.getElementById("modal-alterar-senha").classList.add("hidden");
    } catch (err) {
      console.error(err);
      erroEl.textContent = err.message || "Erro ao alterar a senha.";
      erroEl.style.display = "block";
    } finally {
      salvarBtn.disabled = false;
      salvarBtn.textContent = "Salvar nova senha";
    }
  });

document
  .getElementById("form-usuario")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = document.getElementById("us-id").value;
    const nome = document.getElementById("us-nome").value.trim();
    const email = document.getElementById("us-email").value.trim();
    const acesso = document.getElementById("us-acesso").value;
    const senha = document.getElementById("us-senha").value;
    const atendeClientes = document.getElementById("us-atende").checked;
    const erroEl = document.getElementById("us-erro");
    const salvarBtn = document.getElementById("us-salvar-btn");

    erroEl.style.display = "none";

    if (!id && senha.length < 6) {
      erroEl.textContent = "A senha precisa ter pelo menos 6 caracteres.";
      erroEl.style.display = "block";
      return;
    }

    salvarBtn.disabled = true;
    salvarBtn.textContent = "Salvando...";

    try {
      if (id) {
        // edição: continua indo direto na tabela (RLS/policy de UPDATE
        // já deve restringir pra mesma barbearia)
        const { error } = await supabaseClient
          .from("profissionais")
          .update({ nome, email, acesso, atende_clientes: atendeClientes })
          .eq("id", id);
        if (error) throw error;
      } else {
        // criação: agora passa pela Edge Function — ela cria o usuário
        // no Supabase Auth já com a senha definida aqui, pega o UID
        // sozinha e insere em profissionais já com o barbearia_id certo.
        // Não manda e-mail nenhum — o usuário já sai pronto pra logar.
        const {
          data: { session },
        } = await supabaseClient.auth.getSession();

        const resp = await fetch(CRIAR_USUARIO_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ nome, email, acesso, senha }),
        });

        const resultado = await resp.json();
        if (!resp.ok || resultado.error) {
          throw new Error(resultado.error || "Erro ao criar usuário.");
        }

        // a Edge Function cria todo mundo como "atende clientes"
        if (!atendeClientes) {
          const barbeariaId = await obterBarbeariaId();
          const { error } = await supabaseClient
            .from("profissionais")
            .update({ atende_clientes: false })
            .eq("barbearia_id", barbeariaId)
            .eq("email", email);
          if (error) throw error;
        }
      }

      document.getElementById("modal-usuario").classList.add("hidden");
      await carregarUsuarios();
    } catch (err) {
      console.error(err);
      erroEl.textContent =
        err.code === "23505"
          ? "Já existe um usuário com esse e-mail."
          : err.message || "Erro ao salvar usuário.";
      erroEl.style.display = "block";
    } finally {
      salvarBtn.disabled = false;
      salvarBtn.textContent = "Salvar";
    }
  });

// ---------------- ABA PAGAMENTOS ----------------
const SITUACAO_LABELS = {
  pagante: { texto: "Pagante", classe: "pagante" },
  pendente: { texto: "Pendente", classe: "pendente" },
  "não pagante": { texto: "Inadimplente", classe: "inadimplente" },
  cancelada: { texto: "Cancelada", classe: "cancelada" },
};

function formatarDataCurta(dataISO) {
  if (!dataISO) return "—";
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatarDataHora(dataISO) {
  if (!dataISO) return "—";
  const d = new Date(dataISO);
  return (
    d.toLocaleDateString("pt-BR") +
    " às " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );
}

async function carregarAssinatura() {
  const barbeariaId = await obterBarbeariaId();
  const { data, error } = await supabaseClient
    .from("barbearias")
    .select(
      "id, cnpj, status_assinatura, subscription_status, asaas_customer_id, asaas_subscription_id, proximo_vencimento, criado_em",
    )
    .eq("id", barbeariaId)
    .single();

  if (error) {
    mostrarErroPagamento("Erro ao carregar dados da assinatura.");
    return;
  }

  cnpjAtualCache = data.cnpj || null;

  // Card: situação financeira
  const info = SITUACAO_LABELS[data.status_assinatura] || {
    texto: "Sem assinatura",
    classe: "indisponivel",
  };
  const badge = document.getElementById("pg-situacao-badge");
  badge.textContent = info.texto;
  badge.className = `badge ${info.classe}`;

  const detalheEl = document.getElementById("pg-situacao-detalhe");
  if (data.status_assinatura === "pagante") {
    detalheEl.textContent = data.proximo_vencimento
      ? `Próxima cobrança em ${formatarDataCurta(data.proximo_vencimento)}.`
      : "Assinatura em dia.";
  } else if (data.status_assinatura === "não pagante") {
    detalheEl.textContent =
      "Cobrança vencida há mais de 7 dias. O fluxo de mensagens fica desativado até regularizar.";
  } else if (data.status_assinatura === "pendente") {
    detalheEl.textContent =
      "Assinatura criada, aguardando confirmação do primeiro pagamento.";
  } else if (data.status_assinatura === "cancelada") {
    detalheEl.textContent = "Assinatura cancelada.";
  } else {
    detalheEl.textContent = "Nenhuma assinatura conectada ainda.";
  }

  // Card: assinatura
  document.getElementById("pg-plano").textContent =
    "Barbozap — R$ 67,00/mês";
  document.getElementById("pg-status-raw").textContent =
    data.subscription_status || "—";
  document.getElementById("pg-proximo-vencimento").textContent =
    formatarDataCurta(data.proximo_vencimento);

  const conectarBtn = document.getElementById("pg-conectar-btn");
  const conectadoMsg = document.getElementById("pg-conectado-msg");

  const emDia = data.status_assinatura === "pagante";
  conectadoMsg.classList.toggle("hidden", !emDia);
  conectarBtn.classList.add("hidden");
  if (!emDia) {
    try {
      const profissional = await obterProfissionalAtual();
      if (profissional.acesso === "admin") {
        conectarBtn.textContent = data.asaas_subscription_id ? "Pagar agora" : "Assinar agora";
        conectarBtn.classList.remove("hidden");
      }
    } catch (err) {
      console.error("Erro ao checar permissão de admin:", err);
    }
  }
}

// O pagamento (Pix ou cartão, sem sair do CRM) fica na página Pagamentos
document
  .getElementById("pg-conectar-btn")
  .addEventListener("click", () => {
    window.location.href = "/app/pagamentos/?pagar=1";
  });

document.getElementById("form-cnpj").addEventListener("submit", async (e) => {
  e.preventDefault();

  const cnpjInput = document.getElementById("cnpj-input");
  const erroEl = document.getElementById("cnpj-erro");
  const salvarBtn = document.getElementById("cnpj-salvar-btn");
  const cnpj = cnpjInput.value.replace(/\D/g, "");

  erroEl.style.display = "none";

  if (cnpj.length !== 14) {
    erroEl.textContent = "CNPJ deve ter 14 dígitos.";
    erroEl.style.display = "block";
    return;
  }

  salvarBtn.disabled = true;
  salvarBtn.textContent = "Salvando...";

  try {
    const barbeariaId = await obterBarbeariaId();
    const { error } = await supabaseClient
      .from("barbearias")
      .update({ cnpj })
      .eq("id", barbeariaId);
    if (error) throw error;

    cnpjAtualCache = cnpj;
    document.getElementById("modal-cnpj").classList.add("hidden");
    await conectarAsaas();
  } catch (err) {
    console.error(err);
    erroEl.textContent = "Erro ao salvar o CNPJ. Tente novamente.";
    erroEl.style.display = "block";
  } finally {
    salvarBtn.disabled = false;
    salvarBtn.textContent = "Salvar e continuar";
  }
});

async function conectarAsaas() {
  const btn = document.getElementById("pg-conectar-btn");
  const textoOriginal = btn.innerHTML;
  btn.style.pointerEvents = "none";
  btn.textContent = "Conectando...";

  try {
    const { data, error } = await supabaseClient.functions.invoke(
      "criar-assinatura-asaas",
      { body: {} },
    );
    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    await carregarAssinatura();

    if (data?.checkout_url) {
      window.open(data.checkout_url, "_blank", "noopener");
    }
  } catch (err) {
    console.error(err);
    mostrarErroPagamento(
      "Não foi possível processar sua assinatura agora. Tente novamente em instantes.",
    );
  } finally {
    btn.style.pointerEvents = "";
    btn.innerHTML = textoOriginal;
    if (typeof lucide !== "undefined") lucide.createIcons();
  }
}

function mostrarErroPagamento(mensagem) {
  const erroEl = document.getElementById("pg-erro");
  erroEl.textContent = mensagem;
  erroEl.classList.remove("hidden");
}

function statusCobrancaLabel(status) {
  const info = SITUACAO_LABELS[status];
  if (info) return info;
  return { texto: status || "—", classe: "indisponivel" };
}

function formatarCompetencia(dataVencimento) {
  if (!dataVencimento) return "—";
  const [ano, mes] = dataVencimento.split("-");
  const nomesMeses = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];
  return `${nomesMeses[Number(mes) - 1]}/${ano}`;
}

async function carregarCobrancas() {
  const barbeariaId = await obterBarbeariaId();
  const { data, error } = await supabaseClient
    .from("asaas")
    .select(
      "id, valor, status, data_vencimento, data_pagamento, billing_type, fatura_url",
    )
    .eq("barbearia_id", barbeariaId)
    .order("data_vencimento", { ascending: false });

  const body = document.getElementById("tabela-cobrancas-body");

  if (error) {
    body.innerHTML =
      '<tr><td colspan="7" class="empty">Erro ao carregar cobranças.</td></tr>';
    return;
  }

  cobrancasCache = data || [];
  renderizarCobrancas(cobrancasCache);
  renderizarIndicadores(cobrancasCache);
}

function renderizarCobrancas(lista) {
  const body = document.getElementById("tabela-cobrancas-body");

  if (lista.length === 0) {
    body.innerHTML =
      '<tr><td colspan="7" class="empty">Nenhuma cobrança registrada ainda.</td></tr>';
    return;
  }

  body.innerHTML = lista
    .map((c) => {
      const statusInfo = statusCobrancaLabel(c.status);
      return `
      <tr>
        <td>${formatarCompetencia(c.data_vencimento)}</td>
        <td>R$ ${Number(c.valor || 0).toFixed(2)}</td>
        <td><span class="badge ${statusInfo.classe}">${statusInfo.texto}</span></td>
        <td>${formatarDataCurta(c.data_vencimento)}</td>
        <td>${c.data_pagamento ? formatarDataHora(c.data_pagamento) : "—"}</td>
        <td>${c.billing_type || "—"}</td>
        <td>${
          c.fatura_url
            ? `<a class="btn btn-sm" href="${c.fatura_url}" target="_blank" rel="noopener">Ver fatura</a>`
            : ""
        }</td>
      </tr>
    `;
    })
    .join("");
}

function renderizarIndicadores(lista) {
  const receitaRecebida = lista
    .filter((c) => c.status === "pagante")
    .reduce((soma, c) => soma + Number(c.valor || 0), 0);

  const pendentes = lista.filter((c) => c.status === "pendente").length;
  const vencidas = lista.filter((c) => c.status === "não pagante").length;
  const pagas = lista.filter((c) => c.status === "pagante").length;

  document.getElementById("pg-indicadores").innerHTML = `
    <div class="pg-indicador">
      <p class="pg-indicador-label">Receita recebida</p>
      <p class="pg-indicador-valor">R$ ${receitaRecebida.toFixed(2)}</p>
    </div>
    <div class="pg-indicador">
      <p class="pg-indicador-label">Cobranças pagas</p>
      <p class="pg-indicador-valor">${pagas}</p>
    </div>
    <div class="pg-indicador">
      <p class="pg-indicador-label">Cobranças pendentes</p>
      <p class="pg-indicador-valor">${pendentes}</p>
    </div>
    <div class="pg-indicador">
      <p class="pg-indicador-label">Cobranças vencidas</p>
      <p class="pg-indicador-valor">${vencidas}</p>
    </div>
  `;
}


function atualizarStatusPlano(barbearia) {
  const textoEl = document.getElementById("plano-status-texto");
  const cancelarBtn = document.getElementById("cancelar-plano-btn");

  if (barbearia.cliente) {
    textoEl.textContent = "Assinatura ativa.";
    cancelarBtn.style.display = "inline-flex";
  } else {
    textoEl.textContent = "Assinatura cancelada.";
    cancelarBtn.style.display = "none";
  }
}

function confirmarAcao(mensagem, textoBotao = "Confirmar", estilo = "primary") {
  return new Promise((resolve) => {
    document.getElementById("confirm-mensagem").textContent = mensagem;
    const okBtn = document.getElementById("confirm-ok-btn");
    okBtn.textContent = textoBotao;
    okBtn.className = `btn ${estilo === "danger" ? "btn-danger" : "btn-primary"}`;
    document.getElementById("modal-confirm").classList.remove("hidden");

    const cancelarBtn = document.getElementById("confirm-cancelar-btn");
    const limpar = () => {
      okBtn.removeEventListener("click", onOk);
      cancelarBtn.removeEventListener("click", onCancelar);
      document.getElementById("modal-confirm").classList.add("hidden");
    };
    const onOk = () => {
      limpar();
      resolve(true);
    };
    const onCancelar = () => {
      limpar();
      resolve(false);
    };
    okBtn.addEventListener("click", onOk);
    cancelarBtn.addEventListener("click", onCancelar);
  });
}

document
  .getElementById("cancelar-plano-btn")
  .addEventListener("click", async () => {
    const confirmado = await confirmarAcao(
      "Tem certeza que deseja cancelar a assinatura? As cobranças mensais param e o bot do WhatsApp é desligado. Você pode assinar de novo quando quiser.",
      "Cancelar assinatura",
      "danger",
    );
    if (!confirmado) return;

    try {
      // Cancela no Asaas (para de cobrar) e marca como cancelada no Barbozap
      const { data, error } = await supabaseClient.functions.invoke(
        "cancelar-assinatura",
        { body: {} },
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      barbeariaCache.cliente = false;
      atualizarStatusPlano(barbeariaCache);
      await carregarAssinatura();
    } catch (err) {
      console.error(err);
      alert("Não foi possível cancelar a assinatura agora. Tente novamente em instantes.");
    }
  });

// ---------------- Status do teste grátis ----------------
let diasTesteGratis = 14;
async function carregarStatusTeste() {
  const card = document.getElementById("trial-status-card");
  try {
    const { data, error } = await supabaseClient.rpc("status_teste");
    if (error || !data || !data.length) return;

    const status = data[0];
    card.classList.remove("hidden", "trial-banner-info", "trial-banner-aviso");

    if (status.fase === "assinante") {
      card.classList.add("hidden");
      return;
    }

    if (status.fase === "configurando") {
      const promo = window.promoBlackFriday ? await window.promoBlackFriday() : null;
      diasTesteGratis = promo && promo.elegivel ? 30 : 14;
      card.classList.add("trial-banner-info");
      card.innerHTML = `
        <span>Configure suas informações, profissionais e serviços à vontade. Quando terminar, inicie seus ${diasTesteGratis} dias de teste grátis${diasTesteGratis === 30 ? " (Black Friday: inicie até 15/12)" : ""}.</span>
        <button type="button" class="btn btn-primary" id="concluir-config-btn">Concluir configuração e iniciar teste</button>
      `;
      document
        .getElementById("concluir-config-btn")
        .addEventListener("click", concluirConfiguracaoTeste);
      return;
    }

    if (status.fase === "teste_ativo") {
      card.classList.add("trial-banner-info");
      card.innerHTML = `<span>Você está no teste grátis: ${status.dias_restantes} dia(s) restante(s).</span>`;
      return;
    }

    if (status.fase === "grace") {
      card.classList.add("trial-banner-aviso");
      card.innerHTML = `<span>Seu teste grátis acabou. Você ainda tem ${status.dias_restantes} dia(s) de acesso ao CRM, mas o fluxo foi desativado até você assinar.</span>`;
      return;
    }

    if (status.fase === "bloqueado") {
      card.classList.add("trial-banner-aviso");
      card.innerHTML = `<span>Seu período de acesso terminou. Assine o plano pra reativar o CRM.</span>`;
    }
  } catch (err) {
    console.error("Erro ao carregar status do teste:", err);
  }
}

async function concluirConfiguracaoTeste() {
  const confirmado = await confirmarAcao(
    `A partir de agora você tem ${diasTesteGratis} dias de teste grátis. Essa ação não pode ser desfeita. Deseja continuar?`,
    "Iniciar teste grátis",
    "primary",
  );
  if (!confirmado) return;

  try {
    const { error } = await supabaseClient.rpc("concluir_configuracao_teste");
    if (error) throw error;
    await carregarStatusTeste();
  } catch (err) {
    console.error(err);
    if (err && err.hint === "sem_servicos") {
      alert("Cadastre pelo menos um serviço antes de iniciar o teste: sem serviço o bot não consegue agendar. Vá em Serviços e cadastre o primeiro.");
      return;
    }
    alert("Erro ao iniciar o teste. Tente novamente.");
  }
}

(async () => {
  try {
    if (typeof supabaseClient === "undefined") {
      throw new Error("Cliente Supabase não inicializado.");
    }
    const session = await checarSessao();
    if (session) {
      await aplicarTemaUsuario();
      await carregarNomeBarbearia();
      await carregarStatusTeste();
      await carregarGeral();
      await carregarUsuarios();
      await carregarAssinatura();
      await carregarCobrancas();
    }
  } catch (err) {
    console.error(err);
    document.getElementById("g-erro").textContent = "Erro: " + err.message;
    document.getElementById("g-erro").style.display = "block";
  }
})();