if (typeof lucide !== "undefined") {
  lucide.createIcons();
} else {
  console.error("Lucide não carregou — verifique a conexão com unpkg.com");
}

let profissionalAtualCache = null;
let cobrancasCache = [];
let cnpjAtualCache = null;
let barbeariaCache = null;

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
      "id, cnpj, email, whatsapp, status_assinatura, subscription_status, asaas_customer_id, asaas_subscription_id, proximo_vencimento, criado_em",
    )
    .eq("id", barbeariaId)
    .single();

  if (error) {
    mostrarErro("Erro ao carregar dados da assinatura.");
    return;
  }

  cnpjAtualCache = data.cnpj || null;
  barbeariaCache = data;

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
    "Barbozap — R$ 69,00/mês";
  document.getElementById("pg-status-raw").textContent =
    data.subscription_status || "—";
  document.getElementById("pg-proximo-vencimento").textContent =
    formatarDataCurta(data.proximo_vencimento);

  const conectarBtn = document.getElementById("pg-conectar-btn");
  const conectadoMsg = document.getElementById("pg-conectado-msg");
  const emDia = data.status_assinatura === "pagante";

  conectadoMsg.classList.toggle("hidden", !emDia);
  conectarBtn.classList.add("hidden");
  document.getElementById("pg-cancelar-btn").classList.add("hidden");
  if (emDia && data.asaas_subscription_id) {
    obterProfissionalAtual()
      .then((p) => {
        if (p.acesso === "admin") {
          document.getElementById("pg-cancelar-btn").classList.remove("hidden");
        }
      })
      .catch(() => {});
  }
  if (!emDia) {
    try {
      const profissional = await obterProfissionalAtual();
      if (profissional.acesso === "admin") {
        conectarBtn.innerHTML = data.asaas_subscription_id
          ? '<i data-lucide="credit-card" style="width:16px;height:16px"></i> Pagar agora'
          : '<i data-lucide="credit-card" style="width:16px;height:16px"></i> Assinar agora';
        conectarBtn.classList.remove("hidden");
        if (typeof lucide !== "undefined") lucide.createIcons();
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
  btn.textContent = "Preparando...";

  try {
    if (!barbeariaCache?.asaas_subscription_id) {
      const { data, error } = await supabaseClient.functions.invoke(
        "criar-assinatura-asaas",
        { body: {} },
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await carregarAssinatura();
    }
    abrirModalPagamento();
  } catch (err) {
    console.error(err);
    mostrarErro(
      "Não foi possível processar sua assinatura agora. Tente novamente em instantes.",
    );
  } finally {
    btn.style.pointerEvents = "";
    btn.innerHTML = textoOriginal;
    if (typeof lucide !== "undefined") lucide.createIcons();
  }
}

// ---------------- Modal de pagamento (Pix / cartão) ----------------
// Fala com a Edge Function pagar-assinatura; quem confirma o pagamento é o
// webhook do Asaas, então a tela só fica conferindo o status da barbearia.
let pagamentoPoll = null;
let pixCarregado = false;

async function chamarPagamento(corpo) {
  const { data, error } = await supabaseClient.functions.invoke(
    "pagar-assinatura",
    { body: corpo },
  );
  if (error) {
    // erro 400 do Asaas vem no corpo da resposta
    let mensagem = "Não foi possível falar com o Asaas agora.";
    try {
      const detalhe = await error.context?.json();
      if (detalhe?.error) mensagem = detalhe.error;
    } catch {
      // mantém a mensagem padrão
    }
    throw new Error(mensagem);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

// Valor real da cobrança (vem do Asaas; no Sandbox pode ser o valor de teste)
function mostrarValorPlano(valor) {
  if (!valor) return;
  const texto = "R$ " + Number(valor).toFixed(2).replace(".", ",");
  document.querySelector(".pagar-valor").firstChild.textContent = texto + " ";
  document.getElementById("cc-pagar-btn").textContent = "Pagar " + texto;
}

function mostrarErroPagar(mensagem) {
  const el = document.getElementById("pagar-erro");
  el.textContent = mensagem || "";
  el.style.display = mensagem ? "block" : "none";
}

function trocarAba(aba) {
  document.querySelectorAll(".pagar-aba").forEach((b) =>
    b.classList.toggle("active", b.dataset.aba === aba),
  );
  document.getElementById("pagar-pix").classList.toggle("hidden", aba !== "pix");
  document.getElementById("pagar-cartao").classList.toggle("hidden", aba !== "cartao");
  mostrarErroPagar("");
  if (aba === "pix" && !pixCarregado) carregarPix();
}

function mostrarPagamentoConfirmado() {
  pararConferencia();
  document.getElementById("pagar-abas").classList.add("hidden");
  document.getElementById("pagar-pix").classList.add("hidden");
  document.getElementById("pagar-cartao").classList.add("hidden");
  document.getElementById("pagar-sucesso").classList.remove("hidden");
  mostrarErroPagar("");
  carregarAssinatura();
  carregarCobrancas();
}

function pararConferencia() {
  clearInterval(pagamentoPoll);
  pagamentoPoll = null;
}

// Confere a cada 4s se o webhook já marcou a barbearia como paga
function conferirPagamento() {
  pararConferencia();
  pagamentoPoll = setInterval(async () => {
    if (document.getElementById("modal-pagar").classList.contains("hidden")) {
      pararConferencia();
      carregarAssinatura();
      carregarCobrancas();
      return;
    }
    const { data } = await supabaseClient
      .from("barbearias")
      .select("status_assinatura")
      .eq("id", barbeariaCache.id)
      .single();
    if (data?.status_assinatura === "pagante") mostrarPagamentoConfirmado();
  }, 4000);
}

async function carregarPix() {
  const carregando = document.getElementById("pix-carregando");
  const conteudo = document.getElementById("pix-conteudo");
  carregando.textContent = "Gerando o Pix...";
  carregando.classList.remove("hidden");
  conteudo.classList.add("hidden");

  try {
    const pix = await chamarPagamento({ acao: "pix" });
    if (pix.ja_pago) {
      mostrarPagamentoConfirmado();
      return;
    }
    mostrarValorPlano(pix.valor);
    document.getElementById("pix-qr").src = "data:image/png;base64," + pix.qr_code;
    document.getElementById("pix-copia-cola").value = pix.copia_e_cola;
    carregando.classList.add("hidden");
    conteudo.classList.remove("hidden");
    pixCarregado = true;
  } catch (err) {
    console.error(err);
    carregando.textContent = "Não foi possível gerar o Pix agora.";
    mostrarErroPagar(err.message);
  }
}

function abrirModalPagamento() {
  pixCarregado = false;
  mostrarErroPagar("");
  document.getElementById("pagar-abas").classList.remove("hidden");
  document.getElementById("pagar-sucesso").classList.add("hidden");

  // dados do titular já preenchidos com os da barbearia
  const b = barbeariaCache || {};
  const preencher = (id, valor) => {
    const el = document.getElementById(id);
    if (!el.value && valor) el.value = valor;
  };
  preencher("cc-documento", b.cnpj);
  preencher("cc-email", b.email);
  preencher("cc-telefone", String(b.whatsapp || "").replace(/^55/, ""));

  document.getElementById("modal-pagar").classList.remove("hidden");
  trocarAba("pix");
  conferirPagamento();
}

document.querySelectorAll(".pagar-aba").forEach((b) =>
  b.addEventListener("click", () => trocarAba(b.dataset.aba)),
);

document.getElementById("pix-copiar-btn").addEventListener("click", async () => {
  const input = document.getElementById("pix-copia-cola");
  const btn = document.getElementById("pix-copiar-btn");
  try {
    await navigator.clipboard.writeText(input.value);
  } catch {
    input.select();
    document.execCommand("copy");
  }
  btn.textContent = "Copiado!";
  setTimeout(() => (btn.textContent = "Copiar"), 2000);
});

// máscaras simples dos campos do cartão
document.getElementById("cc-numero").addEventListener("input", (e) => {
  e.target.value = e.target.value.replace(/\D/g, "").slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ");
});
document.getElementById("cc-validade").addEventListener("input", (e) => {
  const d = e.target.value.replace(/\D/g, "").slice(0, 4);
  e.target.value = d.length > 2 ? d.slice(0, 2) + "/" + d.slice(2) : d;
});
["cc-cvv", "cc-documento", "cc-telefone"].forEach((id) =>
  document.getElementById(id).addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/\D/g, "");
  }),
);
document.getElementById("cc-cep").addEventListener("input", (e) => {
  const d = e.target.value.replace(/\D/g, "").slice(0, 8);
  e.target.value = d.length > 5 ? d.slice(0, 5) + "-" + d.slice(5) : d;
});

document.getElementById("pagar-cartao").addEventListener("submit", async (e) => {
  e.preventDefault();
  mostrarErroPagar("");

  const valor = (id) => document.getElementById(id).value.trim();
  const numero = valor("cc-numero").replace(/\D/g, "");
  const [mes, ano] = valor("cc-validade").split("/");
  const documento = valor("cc-documento").replace(/\D/g, "");

  if (numero.length < 13) return mostrarErroPagar("Confira o número do cartão.");
  if (!valor("cc-nome")) return mostrarErroPagar("Informe o nome impresso no cartão.");
  if (!mes || !ano || Number(mes) < 1 || Number(mes) > 12) return mostrarErroPagar("Validade no formato MM/AA.");
  if (valor("cc-cvv").length < 3) return mostrarErroPagar("Confira o CVV.");
  if (documento.length !== 11 && documento.length !== 14) return mostrarErroPagar("CPF (11 dígitos) ou CNPJ (14 dígitos) do titular.");
  if (valor("cc-cep").replace(/\D/g, "").length !== 8) return mostrarErroPagar("Confira o CEP.");
  if (!valor("cc-numero-end")) return mostrarErroPagar("Informe o número do endereço.");
  if (valor("cc-telefone").length < 10) return mostrarErroPagar("Telefone com DDD.");
  if (!valor("cc-email").includes("@")) return mostrarErroPagar("Confira o e-mail.");

  const btn = document.getElementById("cc-pagar-btn");
  btn.disabled = true;
  btn.textContent = "Processando...";

  try {
    const resultado = await chamarPagamento({
      acao: "cartao",
      cartao: { nome: valor("cc-nome"), numero, mes, ano, cvv: valor("cc-cvv") },
      titular: {
        nome: valor("cc-nome"),
        cpfCnpj: documento,
        cep: valor("cc-cep"),
        numeroEndereco: valor("cc-numero-end"),
        telefone: valor("cc-telefone"),
        email: valor("cc-email"),
      },
    });
    // limpa os dados do cartão da tela
    ["cc-numero", "cc-validade", "cc-cvv"].forEach((id) => (document.getElementById(id).value = ""));

    if (resultado.ja_pago || ["CONFIRMED", "RECEIVED"].includes(resultado.status)) {
      mostrarPagamentoConfirmado();
    } else {
      mostrarErroPagar("Pagamento enviado. Aguardando a confirmação do cartão...");
    }
  } catch (err) {
    console.error(err);
    mostrarErroPagar(err.message || "Pagamento não aprovado. Confira os dados ou use o Pix.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Pagar " + document.querySelector(".pagar-valor").firstChild.textContent.trim();
  }
});

// ---------------- Cancelar assinatura ----------------
document.getElementById("pg-cancelar-btn").addEventListener("click", () => {
  document.getElementById("cancelar-erro").style.display = "none";
  document.getElementById("modal-cancelar").classList.remove("hidden");
});

document.getElementById("cancelar-confirmar-btn").addEventListener("click", async () => {
  const btn = document.getElementById("cancelar-confirmar-btn");
  const erroEl = document.getElementById("cancelar-erro");
  btn.disabled = true;
  btn.textContent = "Cancelando...";
  try {
    // Cancela no Asaas (para de cobrar) e marca como cancelada no Barbozap
    const { data, error } = await supabaseClient.functions.invoke(
      "cancelar-assinatura",
      { body: {} },
    );
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    document.getElementById("modal-cancelar").classList.add("hidden");
    await carregarAssinatura();
    await carregarCobrancas();
  } catch (err) {
    console.error(err);
    erroEl.textContent = "Não foi possível cancelar agora. Tente novamente em instantes.";
    erroEl.style.display = "block";
  } finally {
    btn.disabled = false;
    btn.textContent = "Cancelar assinatura";
  }
});

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
      if (
        new URLSearchParams(window.location.search).get("pagar") &&
        barbeariaCache?.status_assinatura !== "pagante"
      ) {
        document.getElementById("pg-conectar-btn").click();
      }
    }
  } catch (err) {
    console.error(err);
    mostrarErro("Erro: " + err.message);
  }
})();
