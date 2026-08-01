if (typeof lucide !== "undefined") {
  lucide.createIcons();
} else {
  console.error("Lucide não carregou — verifique a conexão com unpkg.com");
}

const COLUNAS = [
  { status: "falar_com_humano", titulo: "Falar com humano" },
  { status: "em_atendimento", titulo: "Em atendimento" },
  { status: "agendado", titulo: "Agendado" },
  { status: "follow-up", titulo: "Follow-up" },
];

let atendimentosCache = [];
const sortOrder = {
  em_atendimento: "asc",
  agendado: "asc",
  "follow-up": "asc",
  perdido: "asc",
};

async function checarSessao() {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return null;
  }
  return session;
}

async function carregarNomeBarbearia() {
  const { data } = await supabaseClient
    .from("barbearias")
    .select("empresa")
    .single();
  if (data?.empresa) {
    document.querySelector(".logo-name").textContent = data.empresa;
  }
}

async function carregarNomeBarbearia() {
  const { data } = await supabaseClient
    .from("barbearias")
    .select("empresa")
    .single();
  if (data?.empresa) {
    document.querySelector(".logo-name").textContent = data.empresa;
  }
}

async function carregarAtendimentos(dataInicio, dataFim) {
  let query = supabaseClient
    .from("atendimentos")
    .select(
      `
  id, data_agend, horario, custo, duracao_atend, nps,
  clientes ( nome, telefone, status ),
  profissionais ( nome ),
  atendimento_servicos ( preco_cobrado, duracao_cobrada, servicos ( nome ) )
`,
    )
    .order("data_agend", { ascending: true });

  if (dataInicio) query = query.gte("data_agend", dataInicio);
  if (dataFim) query = query.lte("data_agend", dataFim);

  const { data, error } = await query;

  if (error) {
    console.error(error);
    document.getElementById("kanban").innerHTML =
      '<div class="empty">Erro ao carregar atendimentos. Confira a conexão com o Supabase.</div>';
    return;
  }

  atendimentosCache = data || [];
  renderizarMetricas(atendimentosCache);
  renderizarKanban(atendimentosCache);
}

function formatarData(dataISO, horario) {
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes} às ${horario ? horario.slice(0, 5) : ""}`;
}

function renderizarMetricas(lista) {
  const total = lista.length;
  const faturamento = lista.reduce(
    (soma, a) => soma + (Number(a.custo) || 0),
    0,
  );
  const npsValidos = lista
    .map((a) => a.nps)
    .filter((n) => n !== null && n !== undefined);
  const npsMedio = npsValidos.length
    ? (npsValidos.reduce((s, n) => s + n, 0) / npsValidos.length).toFixed(1)
    : "—";
  const duracaoTotalMin = lista.reduce(
    (soma, a) => soma + (Number(a.duracao_atend) || 0),
    0,
  );
  const horas = Math.floor(duracaoTotalMin / 60);
  const minutos = duracaoTotalMin % 60;
  const duracaoFormatada = duracaoTotalMin ? `${horas}h ${minutos}min` : "—";

  document.getElementById("metrics-grid").innerHTML = `
<div class="metric-card">
  <p class="metric-label">Total de atendimentos</p>
  <p class="metric-value">${total}</p>
</div>
<div class="metric-card">
  <p class="metric-label">Faturamento</p>
  <p class="metric-value">R$ ${faturamento.toFixed(2)}</p>
</div>
<div class="metric-card">
  <p class="metric-label">NPS médio</p>
  <p class="metric-value">${npsMedio}</p>
</div>
<div class="metric-card">
  <p class="metric-label">Tempo total ocupado</p>
  <p class="metric-value">${duracaoFormatada}</p>
</div>
`;
}

function ordenarItens(itens, ordem) {
  const copia = [...itens];
  copia.sort((a, b) => {
    const chaveA = `${a.data_agend} ${a.horario || ""}`;
    const chaveB = `${b.data_agend} ${b.horario || ""}`;
    return ordem === "asc"
      ? chaveA.localeCompare(chaveB)
      : chaveB.localeCompare(chaveA);
  });
  return copia;
}

function renderizarKanban(atendimentos) {
  const kanban = document.getElementById("kanban");
  kanban.innerHTML = "";

  COLUNAS.forEach((coluna) => {
    let itens = atendimentos.filter(
      (a) => a.clientes?.status === coluna.status,
    );
    itens = ordenarItens(itens, sortOrder[coluna.status]);

    const colEl = document.createElement("div");
    colEl.className = "kanban-column";
    colEl.dataset.status = coluna.status;

    const headerEl = document.createElement("div");
    headerEl.className = "kanban-column-header";

    const tituloEl = document.createElement("div");
    tituloEl.className = "kanban-column-title";
    tituloEl.textContent = `${coluna.titulo} (${itens.length})`;

    const sortBtn = document.createElement("button");
    sortBtn.className = "sort-toggle";
    sortBtn.textContent =
      sortOrder[coluna.status] === "asc" ? "↑ Data" : "↓ Data";
    sortBtn.addEventListener("click", () => {
      sortOrder[coluna.status] =
        sortOrder[coluna.status] === "asc" ? "desc" : "asc";
      renderizarKanban(atendimentosCache);
    });

    headerEl.appendChild(tituloEl);
    headerEl.appendChild(sortBtn);
    colEl.appendChild(headerEl);

    if (itens.length === 0) {
      const vazio = document.createElement("div");
      vazio.className = "empty";
      vazio.textContent = "Nenhum atendimento";
      colEl.appendChild(vazio);
    }

    itens.forEach((atend) => {
      const servicos = (atend.atendimento_servicos || [])
        .map((s) => s.servicos?.nome)
        .filter(Boolean)
        .join(" + ");

      const card = document.createElement("div");
      card.className = "card atendimento-card";
      card.addEventListener("click", () => {
        window.location.href = `novo_atendimento.html?id=${atend.id}`;
      });

      const telefone = atend.clientes?.telefone || "";
      const telefoneLimpo = telefone.replace(/\D/g, "");

      card.innerHTML = `
    <p class="atendimento-nome">${atend.clientes?.nome || "Cliente"}</p>
    <p class="atendimento-detalhe">${servicos || "Sem serviço definido"} · ${atend.profissionais?.nome || ""}</p>
    <p class="atendimento-detalhe">${formatarData(atend.data_agend, atend.horario)}</p>
    ${telefoneLimpo ? `<p class="atendimento-detalhe"><a href="https://wa.me/${telefoneLimpo}" target="_blank" class="atendimento-telefone" rel="noopener">${telefone}</a></p>` : ""}
  `;

      const linkTelefone = card.querySelector(".atendimento-telefone");
      if (linkTelefone) {
        linkTelefone.addEventListener("click", (e) => e.stopPropagation());
      }

      colEl.appendChild(card);
    });

    kanban.appendChild(colEl);
  });
}

document.getElementById("logout-link").addEventListener("click", async (e) => {
  e.preventDefault();
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
});

document
  .getElementById("novo-atendimento-btn")
  .addEventListener("click", () => {
    window.location.href = "novo_atendimento.html";
  });

document.getElementById("filtrar-btn").addEventListener("click", () => {
  const inicio = document.getElementById("filtro-inicio").value || null;
  const fim = document.getElementById("filtro-fim").value || null;
  carregarAtendimentos(inicio, fim);
});

document.getElementById("limpar-filtro-btn").addEventListener("click", () => {
  document.getElementById("filtro-inicio").value = "";
  document.getElementById("filtro-fim").value = "";
  carregarAtendimentos(null, null);
});

(async () => {
  try {
    if (typeof supabaseClient === "undefined") {
      throw new Error(
        "Cliente Supabase não inicializado — verifique se supabase-config.js foi carregado e se as credenciais estão corretas.",
      );
    }
    const session = await checarSessao();
    if (session) {
      await aplicarTemaUsuario();
      await carregarNomeBarbearia();
      await carregarAtendimentos(null, null);
    }
  } catch (err) {
    console.error(err);
    document.getElementById("kanban").innerHTML =
      `<div class="empty">Erro: ${err.message}</div>`;
  }
})();
