if (typeof lucide !== "undefined") {
  lucide.createIcons();
} else {
  console.error("Lucide não carregou — verifique a conexão com unpkg.com");
}

let profissionalAtualCache = null;
let cobrancasCache = [];
let cnpjAtualCache = null;

async function obterProfissionalAtual() {
  if (profissionalAtualCache) return profissionalAtualCache;
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  const { data, error } = await supabaseClient
    .from("profissionais")
    .select("id, acesso")
    .eq("auth_user_id", user.id)
    .single();
  if (error) throw error;
  profissionalAtualCache = data;
  return profissionalAtualCache;
}

// ---------------- Situação financeira / assinatura ----------------
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
    mostrarErro("Erro ao carregar dados da assinatura.");
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
    detalheEl.textContent = "Assinatura cancelada na Asaas.";
  } else {
    detalheEl.textContent = "Nenhuma assinatura conectada ainda.";
  }

  // Card: assinatura
  document.getElementById("pg-plano").textContent =
    "Corte Certo — R$ 69,00/mês";
  document.getElementById("pg-status-raw").textContent =
    data.subscription_status || "—";
  document.getElementById("pg-proximo-vencimento").textContent =
    formatarDataCurta(data.proximo_vencimento);

  const conectarBtn = document.getElementById("pg-conectar-btn");
  const conectadoMsg = document.getElementById("pg-conectado-msg");

  if (data.asaas_subscription_id) {
    conectarBtn.classList.add("hidden");
    conectadoMsg.classList.remove("hidden");
  } else {
    conectadoMsg.classList.add("hidden");
    try {
      const profissional = await obterProfissionalAtual();
      if (profissional.acesso === "admin") {
        conectarBtn.classList.remove("hidden");
      }
    } catch (err) {
      console.error("Erro ao checar permissão de admin:", err);
    }
  }
}

document
  .getElementById("pg-conectar-btn")
  .addEventListener("click", async () => {
    if (!cnpjAtualCache) {
      document.getElementById("cnpj-input").value = "";
      document.getElementById("cnpj-erro").style.display = "none";
      document.getElementById("modal-cnpj").classList.remove("hidden");
      return;
    }
    await conectarAsaas();
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
  } catch (err) {
    console.error(err);
    mostrarErro(
      "Não foi possível conectar com a Asaas agora. Tente novamente em instantes.",
    );
  } finally {
    btn.style.pointerEvents = "";
    btn.innerHTML = textoOriginal;
    if (typeof lucide !== "undefined") lucide.createIcons();
  }
}

function mostrarErro(mensagem) {
  const erroEl = document.getElementById("pg-erro");
  erroEl.textContent = mensagem;
  erroEl.classList.remove("hidden");
}

// ---------------- Cobranças ----------------
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

(async () => {
  try {
    if (typeof supabaseClient === "undefined") {
      throw new Error("Cliente Supabase não inicializado.");
    }
    const session = await checarSessao();
    if (session) {
      await aplicarTemaUsuario();
      await carregarNomeBarbearia();
      await carregarAssinatura();
      await carregarCobrancas();
    }
  } catch (err) {
    console.error(err);
    mostrarErro("Erro: " + err.message);
  }
})();
