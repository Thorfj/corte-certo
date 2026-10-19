/* ============================================================
   CENTRAL INTERNA — CENTRAL.JS
   Usa o MESMO projeto Supabase do site/CRM da barbearia.
   Tabelas: leads, lead_atividades, mensagens_prospeccao
   (supabase/migrations/20261019000000_crm_prospeccao.sql).
   ============================================================ */

// Mostra um erro visível na tela (não só no console) — assim dá
// pra diagnosticar sem precisar abrir o DevTools.
function mostrarErroFatal(mensagem) {
  const banner = document.createElement("div");
  banner.style.cssText =
    "position:fixed;top:0;left:0;right:0;z-index:9999;background:#b3261e;" +
    "color:#fff;padding:12px 20px;font-family:sans-serif;font-size:13.5px;" +
    "text-align:center;";
  banner.textContent = "Erro: " + mensagem;
  document.body.prepend(banner);
  console.error(mensagem);
}

if (typeof window.supabase === "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    mostrarErroFatal(
      "A biblioteca do Supabase não carregou (cdn.jsdelivr.net bloqueado, offline, ou sem internet). Confira sua conexão e recarregue a página.",
    );
  });
  throw new Error("supabase-js não carregado — abortando central.js");
}

// Mesmas credenciais do projeto já usado no site/CRM.
const SUPABASE_URL = "https://jzqiqrymqbzullysukja.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_lqY19MJcqfYcVAABzRgiNg_6h4DIWUO";
const supabaseCentral = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
);

// login-interno.html fica na mesma pasta que central.html.
const LOGIN_URL = "login-interno.html";

// Mesma ordem e nomes da planilha de prospecção.
const STAGES = [
  { status: "novo_lead", label: "Novo" },
  { status: "contato_feito", label: "Contatado" },
  { status: "respondeu", label: "Respondeu" },
  { status: "demo_agendada", label: "Demo" },
  { status: "teste_gratis", label: "Teste grátis" },
  { status: "fechado_ganho", label: "Cliente" },
  { status: "perdido", label: "Perdido" },
];
const ETAPAS_ENCERRADAS = ["fechado_ganho", "perdido"];

let leadsCache = [];
let mensagensCache = [];
let meuNome = "";
const filtros = { busca: "", status: "", bairro: "", hoje: false };

// ---------- utilitários ----------
function esc(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stageLabel(status) {
  return STAGES.find((s) => s.status === status)?.label || status || "—";
}

function stageIndex(status) {
  return STAGES.findIndex((s) => s.status === status);
}

// data local no formato AAAA-MM-DD (o mesmo do <input type="date">)
function hojeISO(somarDias = 0) {
  const d = new Date();
  d.setDate(d.getDate() + somarDias);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function formatarData(iso) {
  if (!iso) return "";
  // "2026-10-22" é data pura: sem isso o fuso desloca um dia
  const d = iso.length === 10 ? new Date(iso + "T12:00:00") : new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatarDataHora(iso) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// telefone guardado só com dígitos e DDI: 5541999990000
function normalizarTelefone(valor) {
  const digitos = String(valor || "").replace(/\D/g, "");
  if (!digitos) return null;
  if (digitos.length === 10 || digitos.length === 11) return "55" + digitos;
  return digitos;
}

function formatarTelefone(digitos) {
  if (!digitos) return "";
  const local = digitos.startsWith("55") ? digitos.slice(2) : digitos;
  if (local.length < 10) return digitos;
  const ddd = local.slice(0, 2);
  const numero = local.slice(2);
  return `(${ddd}) ${numero.slice(0, -4)}-${numero.slice(-4)}`;
}

function leadParaHoje(lead) {
  return (
    !!lead.data_proximo_passo &&
    lead.data_proximo_passo <= hojeISO() &&
    !ETAPAS_ENCERRADAS.includes(lead.status)
  );
}

// ---------- sessão + checagem de equipe interna ----------
async function checarAcesso() {
  try {
    const {
      data: { session },
    } = await supabaseCentral.auth.getSession();

    if (!session) {
      window.location.href = LOGIN_URL;
      return false;
    }

    const { data: membro, error } = await supabaseCentral
      .from("equipe_interna")
      .select("nome, papel")
      .eq("auth_user_id", session.user.id)
      .maybeSingle();

    if (error || !membro) {
      // encerra a sessão: sem isso, login-interno.js vê que já tem sessão
      // ativa e te manda de volta pra central automaticamente, sem nunca
      // mostrar o formulário de login.
      await supabaseCentral.auth.signOut();
      document.getElementById("accessDenied").classList.remove("hidden");
      return false;
    }

    meuNome = (membro.nome || "").split(" ")[0];
    document.getElementById("topbarStatus").textContent =
      `${membro.nome} · ${membro.papel}`;
    return true;
  } catch (err) {
    mostrarErroFatal("Falha ao checar sessão/acesso — " + (err.message || err));
    return false;
  }
}

// ---------- abas ----------
function initTabs() {
  const tabBtns = document.querySelectorAll(".tab-btn");
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document
        .querySelectorAll(".tab-panel")
        .forEach((p) => p.classList.remove("active"));
      document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
      if (btn.dataset.tab === "relatorios") carregarRelatorios();
    });
  });
}

// ---------- leads: carregar ----------
async function carregarLeads() {
  const { data, error } = await supabaseCentral
    .from("leads")
    .select("*")
    .order("nome_barbearia", { ascending: true });

  if (error) {
    console.error(error);
    document.getElementById("leadsBody").innerHTML =
      '<tr><td colspan="6" class="loading">Erro ao carregar os leads. Confira se a tabela `leads` existe.</td></tr>';
    document.getElementById("kanban").innerHTML =
      '<div class="loading">Erro ao carregar o funil.</div>';
    return;
  }

  leadsCache = data || [];
  atualizarFiltroBairros();
  renderizarTudo();
}

function renderizarTudo() {
  renderizarLista();
  renderizarKanban();
  if (relatoriosCarregados) renderizarFunilResumo();
}

// ---------- leads: lista com filtros ----------
function initFiltros() {
  const fStatus = document.getElementById("fStatus");
  STAGES.forEach((s) => fStatus.add(new Option(s.label, s.status)));

  document.getElementById("fBusca").addEventListener("input", (e) => {
    filtros.busca = e.target.value.trim().toLowerCase();
    renderizarLista();
  });
  fStatus.addEventListener("change", (e) => {
    filtros.status = e.target.value;
    renderizarLista();
  });
  document.getElementById("fBairro").addEventListener("change", (e) => {
    filtros.bairro = e.target.value;
    renderizarLista();
  });
  document.getElementById("fHoje").addEventListener("click", (e) => {
    filtros.hoje = !filtros.hoje;
    e.currentTarget.classList.toggle("active", filtros.hoje);
    renderizarLista();
  });
}

function atualizarFiltroBairros() {
  const select = document.getElementById("fBairro");
  const atual = select.value;
  const bairros = [
    ...new Set(leadsCache.map((l) => l.bairro).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));
  select.innerHTML = '<option value="">Todos os bairros</option>';
  bairros.forEach((b) => select.add(new Option(b, b)));
  select.value = bairros.includes(atual) ? atual : "";
  filtros.bairro = select.value;
}

function leadsFiltrados() {
  const buscaDigitos = filtros.busca.replace(/\D/g, "");
  return leadsCache.filter((l) => {
    if (filtros.status && l.status !== filtros.status) return false;
    if (filtros.bairro && l.bairro !== filtros.bairro) return false;
    if (filtros.hoje && !leadParaHoje(l)) return false;
    if (filtros.busca) {
      const texto = [l.nome_barbearia, l.bairro, l.nome_contato, l.instagram]
        .join(" ")
        .toLowerCase();
      const bateTexto = texto.includes(filtros.busca);
      const bateTelefone =
        buscaDigitos.length >= 4 &&
        [l.telefone, l.telefone_2].some((t) => (t || "").includes(buscaDigitos));
      if (!bateTexto && !bateTelefone) return false;
    }
    return true;
  });
}

function renderizarLista() {
  const body = document.getElementById("leadsBody");
  const lista = leadsFiltrados();

  document.getElementById("fHojeQtd").textContent =
    leadsCache.filter(leadParaHoje).length;
  document.getElementById("leadsInfo").textContent =
    lista.length === leadsCache.length
      ? `${leadsCache.length} leads`
      : `${lista.length} de ${leadsCache.length} leads`;

  if (!lista.length) {
    body.innerHTML =
      '<tr><td colspan="6" class="loading">Nenhum lead com esses filtros.</td></tr>';
    return;
  }

  const hoje = hojeISO();
  body.innerHTML = lista
    .map((l) => {
      let proximo = "";
      if (l.proximo_passo || l.data_proximo_passo) {
        const atrasado =
          l.data_proximo_passo &&
          l.data_proximo_passo <= hoje &&
          !ETAPAS_ENCERRADAS.includes(l.status);
        proximo = `<span class="${atrasado ? "atrasado" : ""}">${
          l.data_proximo_passo ? esc(formatarData(l.data_proximo_passo)) + " · " : ""
        }${esc(l.proximo_passo || "")}</span>`;
      }
      return `
      <tr data-id="${esc(l.id)}">
        <td><span class="lt-nome">${esc(l.nome_barbearia)}</span>
          ${l.endereco ? `<span class="lt-sub">${esc(l.endereco)}</span>` : ""}</td>
        <td>${esc(l.bairro || "")}</td>
        <td class="nowrap">${esc(formatarTelefone(l.telefone))}
          ${l.tipo_telefone === "Fixo" ? '<span class="tag">fixo</span>' : ""}</td>
        <td><span class="status-badge" data-status="${esc(l.status)}">${esc(stageLabel(l.status))}</span></td>
        <td class="nowrap">${l.ultimo_contato ? esc(formatarData(l.ultimo_contato)) : ""}</td>
        <td>${proximo}</td>
      </tr>`;
    })
    .join("");

  body.querySelectorAll("tr[data-id]").forEach((tr) => {
    tr.addEventListener("click", () => {
      const lead = leadsCache.find((l) => String(l.id) === tr.dataset.id);
      if (lead) abrirModalEdicao(lead);
    });
  });
}

// ---------- kanban ----------
function renderizarKanban() {
  const kanban = document.getElementById("kanban");
  kanban.innerHTML = "";

  STAGES.forEach((stage) => {
    const itens = leadsCache.filter((l) => l.status === stage.status);

    const col = document.createElement("div");
    col.className = "kanban-column";
    col.dataset.status = stage.status;

    const header = document.createElement("div");
    header.className = "kanban-column-header";
    header.innerHTML = `<span class="kanban-column-title">${esc(stage.label)} (${itens.length})</span>`;
    col.appendChild(header);

    const cards = document.createElement("div");
    cards.className = "kanban-cards";
    if (itens.length === 0) {
      cards.innerHTML = '<div class="kanban-empty">Nenhum lead</div>';
    }
    itens.forEach((lead) => cards.appendChild(criarCard(lead)));
    col.appendChild(cards);

    // drop target
    col.addEventListener("dragover", (e) => {
      e.preventDefault();
      col.classList.add("drag-over");
    });
    col.addEventListener("dragleave", () => col.classList.remove("drag-over"));
    col.addEventListener("drop", async (e) => {
      e.preventDefault();
      col.classList.remove("drag-over");
      const leadId = e.dataTransfer.getData("text/plain");
      await moverLead(leadId, stage.status);
    });

    kanban.appendChild(col);
  });
}

function criarCard(lead) {
  const card = document.createElement("div");
  card.className = "lead-card";
  card.draggable = true;
  card.innerHTML = `
    <p class="lc-nome">${esc(lead.nome_barbearia)}</p>
    <p class="lc-detalhe">${esc(lead.bairro || [lead.cidade, lead.estado].filter(Boolean).join("/") || "—")}</p>
    ${lead.proximo_passo ? `<p class="lc-detalhe${leadParaHoje(lead) ? " atrasado" : ""}">${esc(lead.data_proximo_passo ? formatarData(lead.data_proximo_passo) + " · " : "")}${esc(lead.proximo_passo)}</p>` : ""}
  `;
  card.addEventListener("dragstart", (e) => {
    card.classList.add("dragging");
    e.dataTransfer.setData("text/plain", lead.id);
  });
  card.addEventListener("dragend", () => card.classList.remove("dragging"));
  card.addEventListener("click", () => abrirModalEdicao(lead));
  return card;
}

async function moverLead(leadId, novoStatus) {
  const lead = leadsCache.find((l) => String(l.id) === String(leadId));
  if (!lead || lead.status === novoStatus) return;

  // atualização otimista: já move na tela, depois confirma no banco
  lead.status = novoStatus;
  renderizarTudo();

  const { error } = await supabaseCentral
    .from("leads")
    .update({ status: novoStatus })
    .eq("id", leadId);
  if (error) {
    console.error(error);
    await carregarLeads(); // desfaz a mudança otimista se der erro
  }
}

// ---------- mensagens (roteiros) ----------
async function carregarMensagens() {
  const { data, error } = await supabaseCentral
    .from("mensagens_prospeccao")
    .select("*")
    .order("ordem", { ascending: true });

  if (error) {
    console.error(error);
    document.getElementById("mensagensLista").innerHTML =
      '<div class="loading">Erro ao carregar as mensagens.</div>';
    return;
  }
  mensagensCache = data || [];
  renderizarMensagens();
}

function opcoesEtapa(selecionada) {
  return (
    '<option value="">Não muda</option>' +
    STAGES.filter((s) => !ETAPAS_ENCERRADAS.includes(s.status))
      .map(
        (s) =>
          `<option value="${s.status}"${s.status === selecionada ? " selected" : ""}>${esc(s.label)}</option>`,
      )
      .join("")
  );
}

function renderizarMensagens() {
  const wrap = document.getElementById("mensagensLista");
  if (!mensagensCache.length) {
    wrap.innerHTML = '<div class="loading">Nenhuma mensagem cadastrada.</div>';
    return;
  }

  wrap.innerHTML = mensagensCache
    .map(
      (m) => `
    <form class="msg-card" data-id="${m.id}">
      <div class="field-row">
        <div class="field">
          <label>Etapa</label>
          <input type="text" name="etapa" value="${esc(m.etapa)}" required>
        </div>
        <div class="field">
          <label>Quando usar</label>
          <input type="text" name="quando_usar" value="${esc(m.quando_usar || "")}">
        </div>
      </div>
      <div class="field">
        <label>Mensagem</label>
        <textarea name="texto" rows="4" required>${esc(m.texto)}</textarea>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Ao enviar, mover para</label>
          <select name="status_depois">${opcoesEtapa(m.status_depois)}</select>
        </div>
        <div class="field">
          <label>Próximo passo</label>
          <input type="text" name="proximo_passo" value="${esc(m.proximo_passo || "")}">
        </div>
        <div class="field field-dias">
          <label>Em quantos dias</label>
          <input type="number" name="dias_proximo_passo" min="0" value="${m.dias_proximo_passo ?? ""}">
        </div>
      </div>
      <div class="msg-card-footer">
        <span class="hint msg-salvo"></span>
        <button type="submit" class="btn">Salvar</button>
      </div>
    </form>`,
    )
    .join("");

  wrap.querySelectorAll(".msg-card").forEach((form) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const dias = fd.get("dias_proximo_passo");
      const payload = {
        etapa: fd.get("etapa").trim(),
        quando_usar: fd.get("quando_usar").trim() || null,
        texto: fd.get("texto").trim(),
        status_depois: fd.get("status_depois") || null,
        proximo_passo: fd.get("proximo_passo").trim() || null,
        dias_proximo_passo: dias === "" ? null : Number(dias),
        atualizado_em: new Date().toISOString(),
      };
      const aviso = form.querySelector(".msg-salvo");
      const { error } = await supabaseCentral
        .from("mensagens_prospeccao")
        .update(payload)
        .eq("id", form.dataset.id);
      if (error) {
        console.error(error);
        aviso.textContent = "Erro ao salvar.";
        return;
      }
      Object.assign(
        mensagensCache.find((m) => String(m.id) === form.dataset.id),
        payload,
      );
      aviso.textContent = "Salvo.";
      setTimeout(() => (aviso.textContent = ""), 2000);
    });
  });
}

// troca as variáveis do roteiro pelos dados do lead
function preencherMensagem(texto, lead) {
  let t = texto;
  const contato = (lead.nome_contato || "").trim();
  // sem nome do contato: "Oi, [nome]!" vira "Oi!"
  if (!contato) t = t.replace(/,?\s*\[nome\]/g, "");
  const bairro = (lead.bairro || "").split("/")[0].replace(/\s*\(.*?\)/g, "").trim();
  return t
    .replaceAll("[nome]", contato)
    .replaceAll("[barbearia]", lead.nome_barbearia || "sua barbearia")
    .replaceAll("[bairro]", bairro || "região")
    .replaceAll("[seu nome]", meuNome || "[seu nome]")
    .replaceAll("[Google/Instagram]", lead.instagram ? "Instagram" : "Google");
}

// roteiro sugerido para a etapa do lead
function roteiroSugerido(lead) {
  const primeiros = mensagensCache.filter((m) => /primeiro contato/i.test(m.etapa));
  if (lead.status === "novo_lead" && primeiros.length) {
    // reparte A/B/C entre os leads de forma estável (mesmo lead, mesma versão)
    const soma = [...String(lead.id)].reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return primeiros[soma % primeiros.length];
  }
  if (lead.status === "contato_feito") {
    const dia = /dia 7/i.test(lead.proximo_passo || "") ? "dia 7" : "dia 3";
    return mensagensCache.find((m) => m.etapa.toLowerCase().includes(dia));
  }
  return null;
}

// ---------- histórico ----------
async function carregarHistorico(leadId) {
  const ul = document.getElementById("ldHistorico");
  ul.innerHTML = '<li class="loading">Carregando...</li>';
  const { data, error } = await supabaseCentral
    .from("lead_atividades")
    .select("*")
    .eq("lead_id", leadId)
    .order("criado_em", { ascending: false })
    .limit(50);

  if (error) {
    console.error(error);
    ul.innerHTML = '<li class="loading">Erro ao carregar o histórico.</li>';
    return;
  }
  if (!data.length) {
    ul.innerHTML = '<li class="loading">Nada registrado ainda.</li>';
    return;
  }
  ul.innerHTML = data
    .map((a) => {
      let texto;
      if (a.tipo === "status") {
        texto = `Etapa: ${esc(stageLabel(a.status_de))} → <strong>${esc(stageLabel(a.status_para))}</strong>`;
      } else if (a.tipo === "mensagem") {
        texto = `WhatsApp enviado: ${esc(a.descricao || "mensagem livre")}`;
      } else {
        texto = esc(a.descricao);
      }
      return `<li><span class="hist-data">${esc(formatarDataHora(a.criado_em))}</span><span>${texto}</span></li>`;
    })
    .join("");
}

// ---------- modal: novo / editar lead ----------
function initModal() {
  const overlay = document.getElementById("modalLead");
  const form = document.getElementById("formLead");
  const statusSelect = document.getElementById("ldStatus");
  const motivoField = document.getElementById("ldMotivoPerdaField");
  const excluirBtn = document.getElementById("ldExcluirBtn");
  const extras = [
    document.getElementById("ldEnvio"),
    document.getElementById("ldHistoricoSec"),
  ];
  const roteiroSelect = document.getElementById("ldRoteiro");
  const mensagemEl = document.getElementById("ldMensagem");
  const fonteInput = document.getElementById("ldFonte");
  const fonteLink = document.getElementById("ldFonteLink");
  let leadAtual = null;

  STAGES.forEach((s) => statusSelect.add(new Option(s.label, s.status)));

  document.getElementById("novoLeadBtn").addEventListener("click", () => {
    abrirModalNovo();
  });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) fecharModal();
  });
  document
    .querySelectorAll("[data-close='modalLead']")
    .forEach((b) => b.addEventListener("click", fecharModal));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlay.classList.contains("hidden")) fecharModal();
  });

  statusSelect.addEventListener("change", () => {
    motivoField.classList.toggle("hidden", statusSelect.value !== "perdido");
  });

  function atualizarLinkFonte() {
    const url = fonteInput.value.trim();
    fonteLink.classList.toggle("hidden", !/^https?:\/\//.test(url));
    fonteLink.href = url || "#";
  }
  fonteInput.addEventListener("input", atualizarLinkFonte);

  function fecharModal() {
    overlay.classList.add("hidden");
    leadAtual = null;
  }

  function abrirModalNovo() {
    form.reset();
    leadAtual = null;
    document.getElementById("ldId").value = "";
    document.getElementById("modalLeadTitulo").textContent = "Novo Lead";
    document.getElementById("ldErro").classList.remove("show");
    document.getElementById("ldOrigem").value = "prospeccao";
    statusSelect.value = "novo_lead";
    motivoField.classList.add("hidden");
    excluirBtn.style.display = "none";
    extras.forEach((el) => el.classList.add("hidden"));
    atualizarLinkFonte();
    overlay.classList.remove("hidden");
    overlay.querySelector(".modal").scrollTop = 0;
  }

  window.abrirModalEdicao = function (lead) {
    form.reset();
    leadAtual = lead;
    document.getElementById("ldId").value = lead.id;
    document.getElementById("ldNome").value = lead.nome_barbearia || "";
    document.getElementById("ldBairro").value = lead.bairro || "";
    document.getElementById("ldCidade").value = lead.cidade || "";
    document.getElementById("ldEstado").value = lead.estado || "";
    document.getElementById("ldEndereco").value = lead.endereco || "";
    document.getElementById("ldTelefone").value = formatarTelefone(lead.telefone);
    document.getElementById("ldTipoTel").value = lead.tipo_telefone || "Celular";
    document.getElementById("ldTelefone2").value = formatarTelefone(lead.telefone_2);
    document.getElementById("ldInstagram").value = lead.instagram || "";
    document.getElementById("ldContato").value = lead.nome_contato || "";
    document.getElementById("ldOrigem").value = lead.origem || "outro";
    statusSelect.value = lead.status || "novo_lead";
    document.getElementById("ldDataProximo").value = lead.data_proximo_passo || "";
    document.getElementById("ldProximo").value = lead.proximo_passo || "";
    document.getElementById("ldNotas").value = lead.notas || "";
    document.getElementById("ldMotivoPerda").value = lead.motivo_perda || "";
    fonteInput.value = lead.fonte_url || "";
    atualizarLinkFonte();
    motivoField.classList.toggle("hidden", lead.status !== "perdido");
    document.getElementById("modalLeadTitulo").textContent = lead.nome_barbearia;
    document.getElementById("ldErro").classList.remove("show");
    excluirBtn.style.display = "inline-flex";

    // roteiros
    roteiroSelect.innerHTML = '<option value="">Mensagem livre</option>';
    mensagensCache.forEach((m) => roteiroSelect.add(new Option(m.etapa, m.id)));
    const sugerido = roteiroSugerido(lead);
    roteiroSelect.value = sugerido ? String(sugerido.id) : "";
    mensagemEl.value = sugerido ? preencherMensagem(sugerido.texto, lead) : "";
    atualizarHintEnvio();

    extras.forEach((el) => el.classList.remove("hidden"));
    overlay.classList.remove("hidden");
    overlay.querySelector(".modal").scrollTop = 0;
    carregarHistorico(lead.id);
  };

  function roteiroSelecionado() {
    return mensagensCache.find((m) => String(m.id) === roteiroSelect.value) || null;
  }

  // o que muda no lead quando a mensagem é enviada
  function efeitosDoEnvio(lead, roteiro) {
    const mudancas = { ultimo_contato: new Date().toISOString() };
    if (
      roteiro?.status_depois &&
      stageIndex(roteiro.status_depois) > stageIndex(lead.status)
    ) {
      mudancas.status = roteiro.status_depois;
    }
    if (roteiro?.dias_proximo_passo != null) {
      mudancas.proximo_passo = roteiro.proximo_passo;
      mudancas.data_proximo_passo = hojeISO(roteiro.dias_proximo_passo);
    }
    return mudancas;
  }

  function atualizarHintEnvio() {
    const hint = document.getElementById("ldEnvioHint");
    if (!leadAtual) return;
    const m = efeitosDoEnvio(leadAtual, roteiroSelecionado());
    const partes = [];
    if (m.status) partes.push(`o lead vai para <strong>${esc(stageLabel(m.status))}</strong>`);
    if (m.proximo_passo)
      partes.push(
        `o próximo passo fica "${esc(m.proximo_passo)}" em ${esc(formatarData(m.data_proximo_passo))}`,
      );
    hint.innerHTML = partes.length
      ? `Ao abrir o WhatsApp, ${partes.join(" e ")}.`
      : "Ao abrir o WhatsApp, o envio fica registrado no histórico.";
    document.getElementById("ldWhatsBtn").disabled = !leadAtual.telefone;
  }

  roteiroSelect.addEventListener("change", () => {
    const r = roteiroSelecionado();
    if (r && leadAtual) mensagemEl.value = preencherMensagem(r.texto, leadAtual);
    atualizarHintEnvio();
  });

  document.getElementById("ldCopiarBtn").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    try {
      await navigator.clipboard.writeText(mensagemEl.value);
      btn.textContent = "Copiado!";
    } catch {
      mensagemEl.select();
      btn.textContent = "Selecionado";
    }
    setTimeout(() => (btn.textContent = "Copiar"), 1500);
  });

  document.getElementById("ldWhatsBtn").addEventListener("click", async () => {
    const lead = leadAtual;
    if (!lead?.telefone) return;
    const texto = mensagemEl.value.trim();
    // abre antes de qualquer await, senão o navegador bloqueia o pop-up
    window.open(
      `https://wa.me/${lead.telefone}${texto ? "?text=" + encodeURIComponent(texto) : ""}`,
      "_blank",
      "noopener",
    );

    const roteiro = roteiroSelecionado();
    const mudancas = efeitosDoEnvio(lead, roteiro);
    const { error } = await supabaseCentral
      .from("leads")
      .update(mudancas)
      .eq("id", lead.id);
    if (error) {
      console.error(error);
      alert("O WhatsApp abriu, mas não deu pra registrar o envio no lead.");
      return;
    }
    await supabaseCentral.from("lead_atividades").insert({
      lead_id: lead.id,
      tipo: "mensagem",
      descricao: roteiro ? roteiro.etapa : null,
    });

    Object.assign(lead, mudancas);
    if (mudancas.status) {
      statusSelect.value = mudancas.status;
      motivoField.classList.toggle("hidden", mudancas.status !== "perdido");
    }
    if (mudancas.proximo_passo) {
      document.getElementById("ldProximo").value = mudancas.proximo_passo;
      document.getElementById("ldDataProximo").value = mudancas.data_proximo_passo;
    }
    atualizarHintEnvio();
    renderizarTudo();
    carregarHistorico(lead.id);
  });

  document.getElementById("ldNotaBtn").addEventListener("click", async () => {
    const input = document.getElementById("ldNovaNota");
    const texto = input.value.trim();
    if (!texto || !leadAtual) return;
    const { error } = await supabaseCentral
      .from("lead_atividades")
      .insert({ lead_id: leadAtual.id, tipo: "nota", descricao: texto });
    if (error) {
      console.error(error);
      alert("Erro ao registrar a nota.");
      return;
    }
    input.value = "";
    carregarHistorico(leadAtual.id);
  });
  document.getElementById("ldNovaNota").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.getElementById("ldNotaBtn").click();
    }
  });

  excluirBtn.addEventListener("click", async () => {
    const id = document.getElementById("ldId").value;
    if (!id) return;
    if (!confirm("Excluir este lead? Essa ação não pode ser desfeita.")) return;
    const { error } = await supabaseCentral.from("leads").delete().eq("id", id);
    if (error) {
      alert("Erro ao excluir.");
      return;
    }
    fecharModal();
    await carregarLeads();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const erroEl = document.getElementById("ldErro");
    erroEl.classList.remove("show");

    const id = document.getElementById("ldId").value;
    const valor = (campo) => document.getElementById(campo).value.trim() || null;
    const payload = {
      nome_barbearia: document.getElementById("ldNome").value.trim(),
      bairro: valor("ldBairro"),
      cidade: valor("ldCidade"),
      estado: valor("ldEstado")?.toUpperCase() || null,
      endereco: valor("ldEndereco"),
      telefone: normalizarTelefone(valor("ldTelefone")),
      tipo_telefone: document.getElementById("ldTipoTel").value,
      telefone_2: normalizarTelefone(valor("ldTelefone2")),
      instagram: valor("ldInstagram"),
      nome_contato: valor("ldContato"),
      origem: document.getElementById("ldOrigem").value,
      status: statusSelect.value,
      proximo_passo: valor("ldProximo"),
      data_proximo_passo: valor("ldDataProximo"),
      notas: valor("ldNotas"),
      fonte_url: valor("ldFonte"),
      motivo_perda:
        statusSelect.value === "perdido" ? valor("ldMotivoPerda") : null,
    };

    if (!payload.nome_barbearia) {
      erroEl.textContent = "Informe o nome da barbearia.";
      erroEl.classList.add("show");
      return;
    }

    const salvarBtn = document.getElementById("ldSalvarBtn");
    salvarBtn.disabled = true;
    salvarBtn.textContent = "Salvando...";

    try {
      const { error } = id
        ? await supabaseCentral.from("leads").update(payload).eq("id", id)
        : await supabaseCentral.from("leads").insert(payload);
      if (error) throw error;
      fecharModal();
      await carregarLeads();
    } catch (err) {
      console.error(err);
      erroEl.textContent =
        err.code === "23505"
          ? "Já existe um lead com esse telefone."
          : "Erro ao salvar o lead.";
      erroEl.classList.add("show");
    } finally {
      salvarBtn.disabled = false;
      salvarBtn.textContent = "Salvar";
    }
  });
}

// ---------- relatórios de SaaS ----------
let relatoriosCarregados = false;

async function carregarRelatorios() {
  if (relatoriosCarregados) return; // evita recarregar toda vez que troca de aba
  relatoriosCarregados = true;

  const grid = document.getElementById("metricsGrid");

  try {
    const { data: metricas, error: erroMetricas } = await supabaseCentral
      .from("vw_saas_metricas")
      .select("*")
      .single();
    if (erroMetricas) throw erroMetricas;

    grid.innerHTML = `
      <div class="metric-card"><p class="metric-label">Barbearias ativas</p><p class="metric-value">${metricas.barbearias_ativas ?? "—"}</p></div>
      <div class="metric-card"><p class="metric-label">Em teste grátis</p><p class="metric-value">${metricas.em_teste_gratis ?? "—"}</p></div>
      <div class="metric-card"><p class="metric-label">Canceladas</p><p class="metric-value">${metricas.canceladas ?? "—"}</p></div>
      <div class="metric-card"><p class="metric-label">MRR estimado</p><p class="metric-value">R$ ${metricas.mrr_estimado ?? "0"}</p></div>
      <div class="metric-card"><p class="metric-label">Conversão trial → pago</p><p class="metric-value">${metricas.taxa_conversao_pct ?? "—"}%</p></div>
    `;
  } catch (err) {
    console.error(err);
    grid.innerHTML =
      '<div class="loading">Erro ao carregar métricas — confira se a view `vw_saas_metricas` existe e se os nomes de coluna batem com sua tabela `barbearias` (ver TODOs no central-schema.sql).</div>';
  }

  try {
    const { data: porMes, error: erroMes } = await supabaseCentral
      .from("vw_novas_barbearias_por_mes")
      .select("*");
    if (erroMes) throw erroMes;
    renderizarChartBarras(porMes || []);
  } catch (err) {
    console.error(err);
    document.getElementById("chartNovasBarbearias").innerHTML =
      '<div class="loading">Erro ao carregar gráfico.</div>';
  }

  renderizarFunilResumo();
}

function renderizarChartBarras(dados) {
  const wrap = document.getElementById("chartNovasBarbearias");
  if (!dados.length) {
    wrap.innerHTML = '<div class="loading">Sem dados ainda.</div>';
    return;
  }
  const max = Math.max(...dados.map((d) => d.total), 1);
  wrap.innerHTML = dados
    .map(
      (d) => `
    <div class="chart-bar-col">
      <span class="chart-bar-value">${d.total}</span>
      <div class="chart-bar" style="height:${Math.max((d.total / max) * 100, 4)}%"></div>
      <span class="chart-bar-label">${d.mes}</span>
    </div>
  `,
    )
    .join("");
}

function renderizarFunilResumo() {
  const el = document.getElementById("funilResumo");
  const total = leadsCache.length || 1;
  el.innerHTML = STAGES.map((stage) => {
    const qtd = leadsCache.filter((l) => l.status === stage.status).length;
    const pct = Math.round((qtd / total) * 100);
    return `
      <div class="bar-row">
        <div class="bar-row-head"><span>${esc(stage.label)}</span><span>${qtd}</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
      </div>
    `;
  }).join("");
}

// ---------- init ----------
document.addEventListener("DOMContentLoaded", async () => {
  // abas, filtros e modal não dependem de rede — inicializam sempre, mesmo
  // que a checagem de sessão abaixo falhe ou demore.
  initTabs();
  initFiltros();
  initModal();

  try {
    const ok = await checarAcesso();
    if (!ok) return;
    await Promise.all([carregarLeads(), carregarMensagens()]);
  } catch (err) {
    mostrarErroFatal("Falha ao carregar a página — " + (err.message || err));
  }
});
