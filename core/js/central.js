/* ============================================================
   CENTRAL INTERNA — CENTRAL.JS
   Usa o MESMO projeto Supabase do site/CRM da barbearia.
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

const STAGES = [
  { status: "novo_lead", label: "Novo Lead" },
  { status: "contato_feito", label: "Contato Feito" },
  { status: "demo_agendada", label: "Demo Agendada" },
  { status: "proposta_enviada", label: "Proposta Enviada" },
  { status: "fechado_ganho", label: "Fechado (Ganho)" },
  { status: "perdido", label: "Perdido" },
];

let leadsCache = [];

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
      document.getElementById("accessDenied").classList.remove("hidden");
      return false;
    }

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

// ---------- kanban: carregar e renderizar ----------
async function carregarLeads() {
  const kanban = document.getElementById("kanban");
  const { data, error } = await supabaseCentral
    .from("leads")
    .select("*")
    .order("criado_em", { ascending: false });

  if (error) {
    console.error(error);
    kanban.innerHTML =
      '<div class="loading">Erro ao carregar — confira se a tabela `leads` existe (ver central-schema.sql).</div>';
    return;
  }

  leadsCache = data || [];
  renderizarKanban();
}

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
    header.innerHTML = `<span class="kanban-column-title">${stage.label} (${itens.length})</span>`;
    col.appendChild(header);

    if (itens.length === 0) {
      const vazio = document.createElement("div");
      vazio.className = "kanban-empty";
      vazio.textContent = "Nenhum lead";
      col.appendChild(vazio);
    }

    itens.forEach((lead) => col.appendChild(criarCard(lead)));

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
    <p class="lc-nome">${lead.nome_barbearia}</p>
    <p class="lc-detalhe">${[lead.cidade, lead.estado].filter(Boolean).join("/") || "—"}</p>
    ${lead.nome_contato ? `<p class="lc-detalhe">${lead.nome_contato}</p>` : ""}
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
  renderizarKanban();

  const { error } = await supabaseCentral
    .from("leads")
    .update({ status: novoStatus })
    .eq("id", leadId);
  if (error) {
    console.error(error);
    await carregarLeads(); // desfaz a mudança otimista se der erro
  }
}

// ---------- modal: novo / editar lead ----------
function initModal() {
  const overlay = document.getElementById("modalLead");
  const form = document.getElementById("formLead");
  const statusSelect = document.getElementById("ldStatus");
  const motivoField = document.getElementById("ldMotivoPerdaField");
  const excluirBtn = document.getElementById("ldExcluirBtn");

  document.getElementById("novoLeadBtn").addEventListener("click", () => {
    abrirModalNovo();
  });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) fecharModal();
  });
  document
    .querySelectorAll("[data-close='modalLead']")
    .forEach((b) => b.addEventListener("click", fecharModal));

  statusSelect.addEventListener("change", () => {
    motivoField.classList.toggle("hidden", statusSelect.value !== "perdido");
  });

  function fecharModal() {
    overlay.classList.add("hidden");
  }

  function abrirModalNovo() {
    form.reset();
    document.getElementById("ldId").value = "";
    document.getElementById("modalLeadTitulo").textContent = "Novo Lead";
    document.getElementById("ldErro").classList.remove("show");
    motivoField.classList.add("hidden");
    excluirBtn.style.display = "none";
    overlay.classList.remove("hidden");
  }

  window.abrirModalEdicao = function (lead) {
    form.reset();
    document.getElementById("ldId").value = lead.id;
    document.getElementById("ldNome").value = lead.nome_barbearia || "";
    document.getElementById("ldCidade").value = lead.cidade || "";
    document.getElementById("ldEstado").value = lead.estado || "";
    document.getElementById("ldBairro").value = lead.bairro || "";
    document.getElementById("ldContato").value = lead.nome_contato || "";
    document.getElementById("ldTelefone").value = lead.telefone || "";
    document.getElementById("ldOrigem").value = lead.origem || "outro";
    document.getElementById("ldStatus").value = lead.status || "novo_lead";
    document.getElementById("ldNotas").value = lead.notas || "";
    document.getElementById("ldMotivoPerda").value = lead.motivo_perda || "";
    motivoField.classList.toggle("hidden", lead.status !== "perdido");
    document.getElementById("modalLeadTitulo").textContent = "Editar Lead";
    document.getElementById("ldErro").classList.remove("show");
    excluirBtn.style.display = "inline-flex";
    overlay.classList.remove("hidden");
  };

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
    const payload = {
      nome_barbearia: document.getElementById("ldNome").value.trim(),
      cidade: document.getElementById("ldCidade").value.trim() || null,
      estado:
        document.getElementById("ldEstado").value.trim().toUpperCase() || null,
      bairro: document.getElementById("ldBairro").value.trim() || null,
      nome_contato: document.getElementById("ldContato").value.trim() || null,
      telefone: document.getElementById("ldTelefone").value.trim() || null,
      origem: document.getElementById("ldOrigem").value,
      status: document.getElementById("ldStatus").value,
      notas: document.getElementById("ldNotas").value.trim() || null,
      motivo_perda:
        document.getElementById("ldStatus").value === "perdido"
          ? document.getElementById("ldMotivoPerda").value.trim() || null
          : null,
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
      if (id) {
        const { error } = await supabaseCentral
          .from("leads")
          .update(payload)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabaseCentral.from("leads").insert(payload);
        if (error) throw error;
      }
      fecharModal();
      await carregarLeads();
    } catch (err) {
      console.error(err);
      erroEl.textContent =
        "Erro ao salvar. Confira se a tabela `leads` existe (ver central-schema.sql).";
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
        <div class="bar-row-head"><span>${stage.label}</span><span>${qtd}</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
      </div>
    `;
  }).join("");
}

// ---------- init ----------
document.addEventListener("DOMContentLoaded", async () => {
  // abas e modal não dependem de rede — inicializam sempre,
  // mesmo que a checagem de sessão abaixo falhe ou demore.
  initTabs();
  initModal();

  try {
    const ok = await checarAcesso();
    if (!ok) return;
    await carregarLeads();
  } catch (err) {
    mostrarErroFatal("Falha ao carregar a página — " + (err.message || err));
  }
});
