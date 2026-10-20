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
// só leads nessas etapas entram numa safra (o n8n confere de novo antes de enviar)
const ETAPAS_SAFRA = ["novo_lead", "contato_feito"];
const NA_FILA = "Na fila do n8n";
const SAFRA_MAX = 30;
const SAFRA_URL = "https://cortecerto.app.n8n.cloud/webhook/safra-prospeccao";

let leadsCache = [];
let mensagensCache = [];
let meuNome = "";
const selecionados = new Set();
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
      if (btn.dataset.tab === "comercial") carregarComercial();
      if (btn.dataset.tab === "whatsapp") {
        atualizarStatusWhatsapp();
        carregarSafras();
      }
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
      '<tr><td colspan="7" class="loading">Erro ao carregar os leads. Confira se a tabela `leads` existe.</td></tr>';
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
      '<tr><td colspan="7" class="loading">Nenhum lead com esses filtros.</td></tr>';
    atualizarSelecao();
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
      const podeSafra = podeEntrarNaSafra(l);
      return `
      <tr data-id="${esc(l.id)}">
        <td class="col-sel"><input type="checkbox" class="sel-lead" data-id="${esc(l.id)}"
          ${selecionados.has(String(l.id)) ? "checked" : ""} ${podeSafra ? "" : "disabled"}
          title="${podeSafra ? "Incluir na safra" : "Só leads em Novo ou Contatado, fora de outra safra"}"></td>
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
    tr.addEventListener("click", (e) => {
      if (e.target.closest(".col-sel")) return; // clique na caixinha não abre o lead
      const lead = leadsCache.find((l) => String(l.id) === tr.dataset.id);
      if (lead) abrirModalEdicao(lead);
    });
  });
  body.querySelectorAll(".sel-lead").forEach((cb) => {
    cb.addEventListener("change", () => {
      if (cb.checked) selecionados.add(cb.dataset.id);
      else selecionados.delete(cb.dataset.id);
      atualizarSelecao();
    });
  });
  atualizarSelecao();
}

// ---------- seleção e safra ----------
function podeEntrarNaSafra(lead) {
  return ETAPAS_SAFRA.includes(lead.status) && lead.proximo_passo !== NA_FILA && !!lead.telefone;
}

function atualizarSelecao() {
  // tira da seleção quem deixou de poder entrar (mudou de etapa, foi para a fila...)
  selecionados.forEach((id) => {
    const lead = leadsCache.find((l) => String(l.id) === id);
    if (!lead || !podeEntrarNaSafra(lead)) selecionados.delete(id);
  });
  const qtd = selecionados.size;
  document.getElementById("selBar").classList.toggle("hidden", qtd === 0);
  document.getElementById("selInfo").textContent =
    qtd > SAFRA_MAX
      ? `${qtd} selecionados: o máximo por safra é ${SAFRA_MAX}`
      : `${qtd} ${qtd === 1 ? "lead selecionado" : "leads selecionados"}`;
  document.getElementById("selMontar").disabled = qtd === 0 || qtd > SAFRA_MAX;

  const visiveis = leadsFiltrados().filter(podeEntrarNaSafra);
  const todos = document.getElementById("selTodos");
  const marcados = visiveis.filter((l) => selecionados.has(String(l.id))).length;
  todos.checked = visiveis.length > 0 && marcados === visiveis.length;
  todos.indeterminate = marcados > 0 && marcados < visiveis.length;
  todos.disabled = visiveis.length === 0;
}

function mostrarAvisoSafra(msg) {
  const el = document.getElementById("avisoSafra");
  el.textContent = msg || "";
  el.classList.toggle("hidden", !msg);
}

function initSafra() {
  const overlay = document.getElementById("modalSafra");
  const lista = document.getElementById("safraLista");
  const erroEl = document.getElementById("safraErro");
  const enviarBtn = document.getElementById("safraEnviarBtn");

  document.getElementById("selTodos").addEventListener("change", (e) => {
    const visiveis = leadsFiltrados().filter(podeEntrarNaSafra);
    if (e.target.checked) {
      // marca os visíveis, até completar o máximo da safra
      for (const l of visiveis) {
        if (selecionados.size >= SAFRA_MAX) break;
        selecionados.add(String(l.id));
      }
    } else {
      visiveis.forEach((l) => selecionados.delete(String(l.id)));
    }
    renderizarLista();
  });

  document.getElementById("selLimpar").addEventListener("click", () => {
    selecionados.clear();
    renderizarLista();
  });

  const fechar = () => overlay.classList.add("hidden");
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) fechar();
  });
  document
    .querySelectorAll("[data-close='modalSafra']")
    .forEach((b) => b.addEventListener("click", fechar));

  function atualizarInfo() {
    const qtd = lista.querySelectorAll(".safra-item").length;
    document.getElementById("safraInfo").textContent = qtd
      ? `${qtd} ${qtd === 1 ? "mensagem" : "mensagens"} pelo WhatsApp da prospecção. ` +
        `Entre um envio e outro o n8n espera de 3 a 7 minutos (cerca de ${qtd * 5} min no total). ` +
        "Dá para trocar o roteiro, editar o texto ou tirar um lead antes de enviar."
      : "Nenhum lead na safra.";
    enviarBtn.disabled = qtd === 0;
  }

  document.getElementById("selMontar").addEventListener("click", () => {
    const leads = leadsCache.filter((l) => selecionados.has(String(l.id)));
    const primeiros = mensagensCache.filter((m) => /primeiro contato/i.test(m.etapa));
    let novos = 0;
    lista.innerHTML = leads
      .map((l) => {
        // primeiro contato: reveza A/B/C dentro da safra; contatado: follow-up do dia 3 ou 7
        const roteiro =
          l.status === "novo_lead" && primeiros.length
            ? primeiros[novos++ % primeiros.length]
            : roteiroSugerido(l);
        const opcoes = mensagensCache
          .map(
            (m) =>
              `<option value="${m.id}"${roteiro && m.id === roteiro.id ? " selected" : ""}>${esc(m.etapa)}</option>`,
          )
          .join("");
        return `
        <div class="safra-item" data-id="${esc(l.id)}">
          <div class="safra-item-head">
            <div>
              <span class="lt-nome">${esc(l.nome_barbearia)}</span>
              <span class="lt-sub">${esc([l.bairro, formatarTelefone(l.telefone), stageLabel(l.status)].filter(Boolean).join(" · "))}</span>
            </div>
            <button type="button" class="safra-remover" title="Tirar da safra">&times;</button>
          </div>
          <select class="safra-roteiro">${opcoes}</select>
          <textarea class="safra-texto" rows="3">${esc(roteiro ? preencherMensagem(roteiro.texto, l) : "")}</textarea>
        </div>`;
      })
      .join("");

    lista.querySelectorAll(".safra-item").forEach((item) => {
      const lead = leadsCache.find((l) => String(l.id) === item.dataset.id);
      item.querySelector(".safra-roteiro").addEventListener("change", (e) => {
        const m = mensagensCache.find((x) => String(x.id) === e.target.value);
        if (m) item.querySelector(".safra-texto").value = preencherMensagem(m.texto, lead);
      });
      item.querySelector(".safra-remover").addEventListener("click", () => {
        item.remove();
        selecionados.delete(item.dataset.id);
        atualizarInfo();
        renderizarLista();
      });
    });

    erroEl.classList.remove("show");
    atualizarInfo();
    overlay.classList.remove("hidden");
    overlay.querySelector(".modal").scrollTop = 0;
  });

  enviarBtn.addEventListener("click", async () => {
    const itens = [...lista.querySelectorAll(".safra-item")].map((item) => ({
      lead_id: item.dataset.id,
      roteiro_id: Number(item.querySelector(".safra-roteiro").value) || null,
      texto: item.querySelector(".safra-texto").value.trim(),
    }));
    erroEl.classList.remove("show");
    if (!itens.length) return;
    if (itens.some((i) => !i.texto)) {
      erroEl.textContent = "Tem lead sem mensagem. Escreva o texto ou tire o lead da safra.";
      erroEl.classList.add("show");
      return;
    }

    enviarBtn.disabled = true;
    enviarBtn.textContent = "Enviando...";
    try {
      const { estado } = await chamarWhatsapp("status");
      if (estado !== "open") {
        throw new Error("O WhatsApp da prospecção não está conectado. Conecte na aba WhatsApp e tente de novo.");
      }
      const {
        data: { session },
      } = await supabaseCentral.auth.getSession();
      const resp = await fetch(SAFRA_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({ itens }),
      });
      const dados = await resp.json().catch(() => ({}));
      if (!resp.ok || dados.erro) {
        throw new Error(dados.erro || "Não foi possível iniciar a safra agora.");
      }

      fechar();
      selecionados.clear();
      renderizarLista();
      const ignorados = (dados.ignorados || []).map((i) => i.nome || "lead");
      mostrarAvisoSafra(
        `Safra #${dados.safra_id} iniciada com ${dados.total} ${dados.total === 1 ? "lead" : "leads"}. ` +
          "Os leads vão sendo atualizados aqui conforme as mensagens saem, e no fim chega o e-mail com o resumo." +
          (ignorados.length ? ` Ficaram de fora: ${ignorados.join(", ")}.` : ""),
      );
      // o n8n põe os leads "Na fila do n8n" logo depois de responder
      setTimeout(() => carregarLeads().catch(console.error), 2500);
      carregarSafras();
    } catch (err) {
      console.error(err);
      erroEl.textContent = err.message;
      erroEl.classList.add("show");
    } finally {
      enviarBtn.disabled = false;
      enviarBtn.textContent = "Enviar safra";
    }
  });
}

const SAFRA_STATUS = {
  previa: "Prévia",
  enviando: "Enviando",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

async function carregarSafras() {
  const body = document.getElementById("safrasBody");
  const { data, error } = await supabaseCentral
    .from("safras_prospeccao")
    .select("id, criado_em, status, total, resumo")
    .order("id", { ascending: false })
    .limit(10);
  if (error) {
    console.error(error);
    body.innerHTML = '<tr><td colspan="5" class="loading">Erro ao carregar as safras.</td></tr>';
    return;
  }
  if (!data.length) {
    body.innerHTML = '<tr><td colspan="5" class="loading">Nenhuma safra ainda.</td></tr>';
    return;
  }
  body.innerHTML = data
    .map((s) => {
      const r = s.resumo || {};
      const partes = [
        r.enviado ? `${r.enviado} ${r.enviado === 1 ? "enviada" : "enviadas"}` : "",
        r.sem_whatsapp ? `${r.sem_whatsapp} sem WhatsApp` : "",
        r.respondeu ? `${r.respondeu} já ${r.respondeu === 1 ? "tinha" : "tinham"} respondido` : "",
        r.pulado ? `${r.pulado} ${r.pulado === 1 ? "pulado" : "pulados"}` : "",
        r.erro ? `${r.erro} com erro` : "",
      ].filter(Boolean);
      const resultado =
        s.status === "enviando" ? "Em andamento" : partes.join(" · ") || (s.status === "concluida" ? "—" : "");
      return `
      <tr>
        <td>${esc(s.id)}</td>
        <td class="nowrap">${esc(formatarDataHora(s.criado_em))}</td>
        <td><span class="safra-status" data-status="${esc(s.status)}">${esc(SAFRA_STATUS[s.status] || s.status)}</span></td>
        <td>${esc(s.total ?? "—")}</td>
        <td>${esc(resultado)}</td>
      </tr>`;
    })
    .join("");
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

// ---------- WhatsApp da prospecção ----------
// Fala com o n8n (workflow "Barbozap - WhatsApp da prospecção"), que confere se o
// usuário é da equipe interna e usa sempre a instância "prospeccao" da Evolution,
// sem webhook. A chave da Evolution nunca passa pelo navegador.
const WHATSAPP_URL = "https://cortecerto.app.n8n.cloud/webhook/whatsapp-prospeccao";
const WHATSAPP_POLL_MS = 4000; // confere se o QR já foi lido
const WHATSAPP_QR_RENOVA_MS = 35000; // o QR da Evolution expira em ~40s
const WHATSAPP_QR_LIMITE_MS = 180000; // depois de 3 min sem ler, para e pede para tentar de novo
let waPoll = null;
let waRenova = null;
let waLimite = null;

async function chamarWhatsapp(acao) {
  const {
    data: { session },
  } = await supabaseCentral.auth.getSession();
  const resp = await fetch(WHATSAPP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || ""}`,
    },
    body: JSON.stringify({ acao }),
  });
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok || dados.erro) {
    throw new Error(dados.erro || "Não foi possível falar com o WhatsApp agora.");
  }
  return dados;
}

function pararEsperaWhatsapp() {
  clearInterval(waPoll);
  clearInterval(waRenova);
  clearTimeout(waLimite);
  waPoll = waRenova = waLimite = null;
}

function mostrarErroWhatsapp(msg) {
  const el = document.getElementById("waErro");
  el.textContent = msg || "";
  el.classList.toggle("show", Boolean(msg));
}

function mostrarEstadoWhatsapp(dados) {
  const estado = dados.estado;
  const conectado = estado === "open";
  const aguardando = estado === "connecting" && Boolean(waPoll);
  const badge = document.getElementById("waBadge");
  badge.textContent = conectado
    ? "Conectado"
    : aguardando
      ? "Aguardando leitura do QR Code…"
      : "Desconectado";
  badge.dataset.estado = conectado ? "open" : aguardando ? "connecting" : "close";

  const numeroEl = document.getElementById("waNumero");
  const numero = conectado && dados.numero ? formatarTelefone(dados.numero) : "";
  numeroEl.textContent = numero ? [numero, dados.nome].filter(Boolean).join(" · ") : "";
  numeroEl.classList.toggle("hidden", !numero);

  document.getElementById("waConectarBtn").classList.toggle("hidden", conectado || aguardando);
  document.getElementById("waSafraBtn").classList.toggle("hidden", !conectado);
  // dá para desconectar conectado ou no meio da leitura (cancela o QR)
  const desconectarBtn = document.getElementById("waDesconectarBtn");
  desconectarBtn.classList.toggle("hidden", !conectado && !aguardando);
  desconectarBtn.textContent = aguardando ? "Cancelar" : "Desconectar";
  if (!aguardando) document.getElementById("waQr").classList.add("hidden");
}

async function atualizarStatusWhatsapp() {
  if (waPoll) return; // já está esperando a leitura do QR
  mostrarErroWhatsapp("");
  try {
    mostrarEstadoWhatsapp(await chamarWhatsapp("status"));
  } catch (err) {
    console.error(err);
    mostrarEstadoWhatsapp({ estado: "close" });
    mostrarErroWhatsapp(err.message);
  }
}

async function pedirQrWhatsapp() {
  const dados = await chamarWhatsapp("conectar");
  if (dados.estado === "open") {
    pararEsperaWhatsapp();
    await atualizarStatusWhatsapp();
    return;
  }
  if (dados.qr) {
    document.getElementById("waQrImg").src = dados.qr;
    document.getElementById("waQr").classList.remove("hidden");
  }
}

function initWhatsapp() {
  const conectarBtn = document.getElementById("waConectarBtn");
  const desconectarBtn = document.getElementById("waDesconectarBtn");

  document.getElementById("waSafraBtn").addEventListener("click", () => {
    const fStatus = document.getElementById("fStatus");
    fStatus.value = "novo_lead";
    filtros.status = "novo_lead";
    document.querySelector('.tab-btn[data-tab="leads"]').click();
    renderizarLista();
    mostrarAvisoSafra("Marque os leads na lista (a caixinha do topo marca os visíveis) e clique em Montar safra.");
  });
  document.getElementById("safrasAtualizar").addEventListener("click", () => carregarSafras());

  conectarBtn.addEventListener("click", async () => {
    mostrarErroWhatsapp("");
    conectarBtn.disabled = true;
    try {
      pararEsperaWhatsapp();
      // marca como "aguardando" antes do primeiro QR, para o botão sumir
      waPoll = setInterval(async () => {
        try {
          const dados = await chamarWhatsapp("status");
          if (dados.estado === "open") {
            pararEsperaWhatsapp();
            mostrarEstadoWhatsapp(dados);
          }
        } catch (err) {
          console.error(err);
        }
      }, WHATSAPP_POLL_MS);
      waRenova = setInterval(() => pedirQrWhatsapp().catch(console.error), WHATSAPP_QR_RENOVA_MS);
      waLimite = setTimeout(() => {
        pararEsperaWhatsapp();
        mostrarEstadoWhatsapp({ estado: "close" });
        mostrarErroWhatsapp("O QR Code expirou. Clique em Conectar WhatsApp para gerar outro.");
      }, WHATSAPP_QR_LIMITE_MS);
      mostrarEstadoWhatsapp({ estado: "connecting" });
      await pedirQrWhatsapp();
    } catch (err) {
      console.error(err);
      pararEsperaWhatsapp();
      mostrarEstadoWhatsapp({ estado: "close" });
      mostrarErroWhatsapp(err.message);
    } finally {
      conectarBtn.disabled = false;
    }
  });

  desconectarBtn.addEventListener("click", async () => {
    const cancelandoQr = Boolean(waPoll);
    if (
      !cancelandoQr &&
      !confirm(
        "Desconectar o WhatsApp da prospecção? As safras não conseguem enviar até você conectar de novo.",
      )
    )
      return;
    desconectarBtn.disabled = true;
    mostrarErroWhatsapp("");
    pararEsperaWhatsapp();
    try {
      mostrarEstadoWhatsapp(await chamarWhatsapp("desconectar"));
    } catch (err) {
      console.error(err);
      mostrarErroWhatsapp(err.message);
    } finally {
      desconectarBtn.disabled = false;
    }
  });
}

// ---------- performance comercial ----------
// Tudo calculado no navegador a partir de leads, lead_atividades e safras_prospeccao.
let comAtividades = null; // cache do histórico; "Atualizar" busca de novo
let comSafras = null;

function pct(parte, todo) {
  return todo ? Math.round((parte / todo) * 100) : 0;
}

// etapa mais avançada a que o lead já chegou (Perdido não conta como avanço)
function etapaMaxima(lead, historico) {
  let max = lead.status === "perdido" ? 0 : stageIndex(lead.status);
  (historico || []).forEach((a) => {
    if (a.tipo === "status" && a.status_para !== "perdido") {
      max = Math.max(max, stageIndex(a.status_para));
    }
  });
  if (max < 1 && lead.ultimo_contato) max = 1; // já recebeu mensagem
  return max;
}

function inicioDaSemana(data) {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // segunda-feira
  return d;
}

function barrasHorizontais(linhas, vazio) {
  if (!linhas.some((l) => l.valor > 0)) return `<div class="loading">${esc(vazio)}</div>`;
  const max = Math.max(...linhas.map((l) => l.valor), 1);
  return linhas
    .map(
      (l) => `
    <div class="bar-row" title="${esc(l.rotulo)}: ${l.valor}${l.extra ? " (" + esc(l.extra) + ")" : ""}">
      <div class="bar-row-head"><span>${esc(l.rotulo)}</span><span>${l.valor}${l.extra ? ` <small class="text-secondary">${esc(l.extra)}</small>` : ""}</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${l.valor ? Math.max((l.valor / max) * 100, 2) : 0}%"></div></div>
    </div>`,
    )
    .join("");
}

function colunasSemanais(semanas, vazio) {
  if (!semanas.some((s) => s.total > 0)) return `<div class="loading">${esc(vazio)}</div>`;
  const max = Math.max(...semanas.map((s) => s.total), 1);
  return semanas
    .map(
      (s) => `
    <div class="chart-bar-col" title="Semana de ${esc(s.rotulo)}: ${s.total}">
      <span class="chart-bar-value">${s.total || ""}</span>
      <div class="chart-bar" style="height:${s.total ? Math.max((s.total / max) * 100, 4) : 0}%"></div>
      <span class="chart-bar-label">${esc(s.rotulo)}</span>
    </div>`,
    )
    .join("");
}

function tabela(cabecalho, linhas, vazio) {
  if (!linhas.length) return `<div class="loading">${esc(vazio)}</div>`;
  return `<table class="leads-table com-tabela"><thead><tr>${cabecalho
    .map((c, i) => `<th${i ? ' class="num"' : ""}>${esc(c)}</th>`)
    .join("")}</tr></thead><tbody>${linhas
    .map((l) => `<tr>${l.map((c, i) => `<td${i ? ' class="num"' : ""}>${c}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

async function carregarComercial(forcar = false) {
  if (forcar || !comAtividades) {
    document.getElementById("comKpis").innerHTML = '<div class="loading">Carregando...</div>';
    const [atv, saf] = await Promise.all([
      supabaseCentral
        .from("lead_atividades")
        .select("lead_id, tipo, descricao, status_de, status_para, criado_em")
        .order("criado_em", { ascending: true })
        .limit(20000),
      supabaseCentral
        .from("safras_prospeccao")
        .select("id, criado_em, status, total, resumo")
        .order("id", { ascending: false })
        .limit(500),
    ]);
    if (atv.error || saf.error) {
      console.error(atv.error || saf.error);
      document.getElementById("comKpis").innerHTML =
        '<div class="loading">Erro ao carregar os dados do relatório.</div>';
      return;
    }
    comAtividades = atv.data || [];
    comSafras = saf.data || [];
  }
  renderizarComercial();
}

function renderizarComercial() {
  const dias = Number(document.getElementById("comPeriodo").value);
  const desde = dias ? Date.now() - dias * 864e5 : 0;
  const noPeriodo = (iso) => new Date(iso).getTime() >= desde;

  const porLead = new Map();
  comAtividades.forEach((a) => {
    if (!porLead.has(a.lead_id)) porLead.set(a.lead_id, []);
    porLead.get(a.lead_id).push(a);
  });
  const atvPeriodo = comAtividades.filter((a) => noPeriodo(a.criado_em));
  const mensagens = atvPeriodo.filter((a) => a.tipo === "mensagem");
  const chegouEm = (etapa) =>
    new Set(atvPeriodo.filter((a) => a.tipo === "status" && a.status_para === etapa).map((a) => a.lead_id));

  // ---- KPIs do período ----
  const contatados = new Set(mensagens.map((a) => a.lead_id));
  const responderam = chegouEm("respondeu");
  const demos = chegouEm("demo_agendada");
  const testes = chegouEm("teste_gratis");
  const clientes = chegouEm("fechado_ganho");
  const kpi = (rotulo, valor, sub) =>
    `<div class="metric-card"><p class="metric-label">${esc(rotulo)}</p><p class="metric-value">${valor}</p>${
      sub ? `<p class="metric-sub">${esc(sub)}</p>` : ""
    }</div>`;
  document.getElementById("comKpis").innerHTML = [
    kpi("Mensagens enviadas", mensagens.length, `${contatados.size} ${contatados.size === 1 ? "lead" : "leads"}`),
    kpi("Responderam", responderam.size, contatados.size ? `${pct(responderam.size, contatados.size)}% dos contatados` : ""),
    kpi("Demos", demos.size, ""),
    kpi("Testes grátis", testes.size, ""),
    kpi("Novos clientes", clientes.size, contatados.size ? `${pct(clientes.size, contatados.size)}% dos contatados` : ""),
    kpi("Para hoje", leadsCache.filter(leadParaHoje).length, "próximos passos vencidos"),
  ].join("");

  // ---- funil acumulado (desde o início) ----
  const maximos = leadsCache.map((l) => etapaMaxima(l, porLead.get(l.id)));
  const etapasFunil = STAGES.slice(0, 6); // Novo ... Cliente
  let anterior = null;
  document.getElementById("comFunil").innerHTML = barrasHorizontais(
    etapasFunil.map((st, i) => {
      const valor = i === 0 ? leadsCache.length : maximos.filter((m) => m >= i).length;
      const extra = anterior ? `${pct(valor, anterior)}%` : "";
      anterior = valor;
      return { rotulo: i === 0 ? "Na base" : st.label, valor, extra };
    }),
    "Nenhum lead cadastrado.",
  );

  // ---- etapa atual ----
  document.getElementById("comEtapas").innerHTML = barrasHorizontais(
    STAGES.map((st) => ({
      rotulo: st.label,
      valor: leadsCache.filter((l) => l.status === st.status).length,
    })),
    "Nenhum lead cadastrado.",
  );

  // ---- semanas (fixo: últimas 8) ----
  const semanas = [];
  const segunda = inicioDaSemana(new Date());
  for (let i = 7; i >= 0; i--) {
    const ini = new Date(segunda);
    ini.setDate(ini.getDate() - i * 7);
    semanas.push({ ini: ini.getTime(), rotulo: ini.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) });
  }
  const contaSemanas = (lista) =>
    semanas.map((s, i) => {
      const fim = i < semanas.length - 1 ? semanas[i + 1].ini : Infinity;
      return { ...s, total: lista.filter((a) => { const t = new Date(a.criado_em).getTime(); return t >= s.ini && t < fim; }).length };
    });
  document.getElementById("comSemanaMsgs").innerHTML = colunasSemanais(
    contaSemanas(comAtividades.filter((a) => a.tipo === "mensagem")),
    "Nenhuma mensagem nas últimas 8 semanas.",
  );
  document.getElementById("comSemanaResp").innerHTML = colunasSemanais(
    contaSemanas(comAtividades.filter((a) => a.tipo === "status" && a.status_para === "respondeu")),
    "Nenhuma resposta nas últimas 8 semanas.",
  );

  // ---- roteiros ----
  const respondeuEm = new Map(); // lead -> data da primeira vez em Respondeu
  comAtividades.forEach((a) => {
    if (a.tipo === "status" && a.status_para === "respondeu" && !respondeuEm.has(a.lead_id)) {
      respondeuEm.set(a.lead_id, new Date(a.criado_em).getTime());
    }
  });
  const porRoteiro = new Map();
  mensagens.forEach((a) => {
    const nome = String(a.descricao || "Mensagem livre").replace(/\s*·\s*safra n8n #\d+$/, "");
    if (!porRoteiro.has(nome)) porRoteiro.set(nome, { envios: 0, leads: new Set(), responderam: new Set() });
    const r = porRoteiro.get(nome);
    r.envios += 1;
    r.leads.add(a.lead_id);
    const resp = respondeuEm.get(a.lead_id);
    if (resp && resp >= new Date(a.criado_em).getTime()) r.responderam.add(a.lead_id);
  });
  const ordem = (nome) => {
    const m = mensagensCache.find((x) => x.etapa === nome);
    return m ? m.ordem : 9999;
  };
  document.getElementById("comRoteiros").innerHTML = tabela(
    ["Roteiro", "Envios", "Leads", "Responderam", "Taxa de resposta"],
    [...porRoteiro.entries()]
      .sort((a, b) => ordem(a[0]) - ordem(b[0]))
      .map(([nome, r]) => {
        const taxa = pct(r.responderam.size, r.leads.size);
        return [
          esc(nome),
          r.envios,
          r.leads.size,
          r.responderam.size,
          `<span class="taxa"><span class="taxa-barra"><span style="width:${taxa}%"></span></span>${taxa}%</span>`,
        ];
      }),
    "Nenhuma mensagem enviada no período.",
  );

  // ---- bairros (desde o início) ----
  const porBairro = new Map();
  leadsCache.forEach((l, i) => {
    if (maximos[i] < 1) return; // nunca contatado
    const b = l.bairro || "Sem bairro";
    if (!porBairro.has(b)) porBairro.set(b, { contatados: 0, responderam: 0, clientes: 0 });
    const r = porBairro.get(b);
    r.contatados += 1;
    if (maximos[i] >= 2) r.responderam += 1;
    if (maximos[i] >= 5) r.clientes += 1;
  });
  document.getElementById("comBairros").innerHTML = tabela(
    ["Bairro", "Contatados", "Responderam", "Clientes", "Taxa de resposta"],
    [...porBairro.entries()]
      .sort((a, b) => b[1].contatados - a[1].contatados)
      .slice(0, 10)
      .map(([b, r]) => [esc(b), r.contatados, r.responderam, r.clientes, `${pct(r.responderam, r.contatados)}%`]),
    "Nenhum lead contatado ainda.",
  );

  // ---- safras ----
  const safrasPeriodo = comSafras.filter((s) => noPeriodo(s.criado_em) && s.status !== "cancelada" && s.status !== "previa");
  const soma = (campo) => safrasPeriodo.reduce((t, s) => t + Number((s.resumo || {})[campo] || 0), 0);
  document.getElementById("comSafras").innerHTML = safrasPeriodo.length
    ? `<ul class="com-lista">
        <li><span>Safras disparadas</span><strong>${safrasPeriodo.length}</strong></li>
        <li><span>Mensagens enviadas</span><strong>${soma("enviado")}</strong></li>
        <li><span>Números sem WhatsApp</span><strong>${soma("sem_whatsapp")}</strong></li>
        <li><span>Já tinham respondido (follow-up evitado)</span><strong>${soma("respondeu")}</strong></li>
        <li><span>Erros</span><strong>${soma("erro")}</strong></li>
      </ul>`
    : '<div class="loading">Nenhuma safra no período.</div>';

  // ---- motivos de perda ----
  const motivos = new Map();
  leadsCache
    .filter((l) => l.status === "perdido")
    .forEach((l) => {
      const m = (l.motivo_perda || "Sem motivo informado").trim();
      motivos.set(m, (motivos.get(m) || 0) + 1);
    });
  document.getElementById("comPerdas").innerHTML = motivos.size
    ? `<ul class="com-lista">${[...motivos.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([m, n]) => `<li><span>${esc(m)}</span><strong>${n}</strong></li>`)
        .join("")}</ul>`
    : '<div class="loading">Nenhum lead perdido.</div>';
}

function initComercial() {
  document.getElementById("comPeriodo").addEventListener("change", () => {
    if (comAtividades) renderizarComercial();
  });
  document.getElementById("comAtualizar").addEventListener("click", () =>
    carregarComercial(true).catch(console.error),
  );
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
  initWhatsapp();
  initSafra();
  initComercial();

  try {
    const ok = await checarAcesso();
    if (!ok) return;
    await Promise.all([carregarLeads(), carregarMensagens()]);
  } catch (err) {
    mostrarErroFatal("Falha ao carregar a página — " + (err.message || err));
  }
});
