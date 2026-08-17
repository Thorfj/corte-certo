if (typeof lucide !== "undefined") {
  lucide.createIcons();
} else {
  console.error("Lucide não carregou — verifique a conexão com unpkg.com");
}

let barbeariaCache = null;
let profissionalAtualCache = null;
let cobrancasCache = [];
let cnpjAtualCache = null;

// TODO: trocar pela URL real do webhook n8n que inicia o OAuth do Google
// (deve receber a barbearia_id como parâmetro pra saber onde salvar o retorno)
const GOOGLE_OAUTH_URL =
  "https://SEU-N8N.exemplo.com/webhook/google-oauth-start";

// TODO: ajustar para a URL real da Edge Function depois do deploy
const CRIAR_USUARIO_URL =
  "https://jzqiqrymqbzullysukja.supabase.co/functions/v1/criar-usuario";

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

// ---------------- ABA GERAL ----------------
async function carregarGeral() {
  const barbeariaId = await obterBarbeariaId();
  const { data, error } = await supabaseClient
    .from("barbearias")
    .select(
      "id, empresa, email, whatsapp, cliente, google_calendar_status, google_calendar_email",
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

  atualizarStatusPlano(data);
  await configurarAparenciaEGoogle(data);
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

  badge.textContent = conectado
    ? `Conectado ✅${barbearia.google_calendar_email ? " — " + barbearia.google_calendar_email : ""}`
    : "Desconectado";
  badge.classList.toggle("conectado", conectado);
  conectarBtn.textContent = conectado
    ? "Reconectar com Google"
    : "Conectar com Google";
  conectarBtn.href = `${GOOGLE_OAUTH_URL}?barbearia_id=${barbearia.id}`;
}

async function configurarAparenciaEGoogle(barbearia) {
  const profissional = await obterProfissionalAtual();
  marcarTemaAtivo(profissional.tema === "dark" ? "dark" : "light");

  const cardGoogle = document.getElementById("card-google");
  if (profissional.acesso === "admin") {
    cardGoogle.classList.remove("hidden");
    atualizarStatusGoogle(barbearia);
  } else {
    cardGoogle.classList.add("hidden");
  }
}

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
    .select("id, nome, email, acesso, agendas")
    .eq("barbearia_id", barbeariaId)
    .order("nome", { ascending: true });

  const body = document.getElementById("tabela-usuarios-body");

  if (error) {
    body.innerHTML =
      '<tr><td colspan="5" class="empty">Erro ao carregar usuários.</td></tr>';
    return;
  }

  if (!data || data.length === 0) {
    body.innerHTML =
      '<tr><td colspan="5" class="empty">Nenhum usuário cadastrado.</td></tr>';
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
      <td>${u.agendas || "—"}</td>
      <td class="col-acoes"><i data-lucide="pencil" style="width:16px;height:16px"></i></td>
    </tr>
  `,
    )
    .join("");

  if (typeof lucide !== "undefined") lucide.createIcons();

  body.querySelectorAll("[data-editar]").forEach((tr) => {
    tr.addEventListener("click", () => {
      const usuario = data.find((u) => String(u.id) === tr.dataset.editar);
      abrirModalUsuario(usuario);
    });
  });
}

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
    document.getElementById("us-agenda").value = usuario.agendas || "";
    senhaField.style.display = "none";
    senhaInput.required = false;
  } else {
    document.getElementById("modal-usuario-titulo").textContent =
      "Novo Usuário";
    document.getElementById("us-id").value = "";
    senhaField.style.display = "block";
    senhaInput.required = true;
  }

  // campo de UID manual removido do fluxo — a Edge Function cuida disso
  document.getElementById("modal-usuario").classList.remove("hidden");
}

document
  .getElementById("novo-usuario-btn")
  .addEventListener("click", () => abrirModalUsuario(null));

document
  .getElementById("form-usuario")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = document.getElementById("us-id").value;
    const nome = document.getElementById("us-nome").value.trim();
    const email = document.getElementById("us-email").value.trim();
    const acesso = document.getElementById("us-acesso").value;
    const agendas = document.getElementById("us-agenda").value.trim() || null;
    const senha = document.getElementById("us-senha").value;
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
          .update({ nome, email, acesso, agendas })
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
          body: JSON.stringify({ nome, email, acesso, agendas, senha }),
        });

        const resultado = await resp.json();
        if (!resp.ok || resultado.error) {
          throw new Error(resultado.error || "Erro ao criar usuário.");
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
      "Tem certeza que deseja cancelar a assinatura? O fluxo de mensagens será desativado.",
      "Cancelar assinatura",
      "danger",
    );
    if (!confirmado) return;

    try {
      const barbeariaId = await obterBarbeariaId();
      const { error } = await supabaseClient
        .from("barbearias")
        .update({ cliente: false })
        .eq("id", barbeariaId);
      if (error) throw error;

      barbeariaCache.cliente = false;
      atualizarStatusPlano(barbeariaCache);
    } catch (err) {
      console.error(err);
      alert("Erro ao cancelar assinatura. Você precisa ter papel de admin.");
    }
  });

// ---------------- Status do teste grátis ----------------
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
      card.classList.add("trial-banner-info");
      card.innerHTML = `
        <span>Configure suas informações, profissionais e serviços à vontade. Quando terminar, inicie seus 5 dias de teste grátis.</span>
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
    "A partir de agora você tem 5 dias de teste grátis. Essa ação não pode ser desfeita. Deseja continuar?",
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