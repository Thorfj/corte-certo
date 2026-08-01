if (typeof lucide !== "undefined") {
  lucide.createIcons();
} else {
  console.error("Lucide não carregou — verifique a conexão com unpkg.com");
}

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

function formatarDataCurta(dataISO) {
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}`;
}
function formatarDataBr(dataISO) {
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

const NOMES_STATUS = {
  em_atendimento: "Em atendimento",
  agendado: "Agendado",
  "follow-up": "Follow-up",
  perdido: "Perdido",
};
const ORDEM_STATUS = ["em_atendimento", "agendado", "follow-up", "perdido"];
const DIAS_SEMANA = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

// ---------------- CARREGAR DADOS ----------------
async function carregarRelatorios(dataInicio, dataFim) {
  let queryAtend = supabaseClient
    .from("atendimentos")
    .select(
      `
      id, data_agend, horario, custo, duracao_atend, nps, id_cliente, id_prof,
      profissionais ( nome ),
      atendimento_servicos ( preco_cobrado, servicos ( nome ) )
    `,
    )
    .order("data_agend", { ascending: true });
  if (dataInicio) queryAtend = queryAtend.gte("data_agend", dataInicio);
  if (dataFim) queryAtend = queryAtend.lte("data_agend", dataFim);

  let queryClientes = supabaseClient
    .from("clientes")
    .select("id, nome, telefone, data_primeiro_contato, data_ult_agend, status")
    .not("data_primeiro_contato", "is", null)
    .order("data_primeiro_contato", { ascending: true });
  if (dataInicio)
    queryClientes = queryClientes.gte("data_primeiro_contato", dataInicio);
  if (dataFim)
    queryClientes = queryClientes.lte("data_primeiro_contato", dataFim);

  const [respAtend, respClientes] = await Promise.all([
    queryAtend,
    queryClientes,
  ]);

  if (respAtend.error || respClientes.error) {
    console.error(respAtend.error || respClientes.error);
    document.getElementById("metrics-grid").innerHTML =
      '<p class="empty">Erro ao carregar relatórios.</p>';
    return;
  }

  const atendimentos = respAtend.data || [];
  const clientes = respClientes.data || [];

  renderizarMetricas(atendimentos, clientes);
  renderizarNps(atendimentos);
  renderizarChart(
    "chart-atendimentos-dia",
    agruparPorDia(atendimentos, "data_agend"),
  );
  renderizarChart(
    "chart-contatos-dia",
    agruparPorDia(clientes, "data_primeiro_contato"),
  );
  renderizarFunil(clientes);
  renderizarConversaoFollowup(clientes);
  renderizarFaturamentoPorServico(atendimentos);
  renderizarOcupacao(atendimentos);
  renderizarPico(atendimentos);

  await carregarClientesEmAtraso();
}

function renderizarMetricas(atendimentos, clientes) {
  const total = atendimentos.length;
  const faturamento = atendimentos.reduce(
    (soma, a) => soma + (Number(a.custo) || 0),
    0,
  );
  const npsValidos = atendimentos
    .map((a) => a.nps)
    .filter((n) => n !== null && n !== undefined);
  const npsMedio = npsValidos.length
    ? (npsValidos.reduce((s, n) => s + n, 0) / npsValidos.length).toFixed(1)
    : "—";
  const novosContatos = clientes.length;

  document.getElementById("metrics-grid").innerHTML = `
    <div class="metric-card"><p class="metric-label">Atendimentos no período</p><p class="metric-value">${total}</p></div>
    <div class="metric-card"><p class="metric-label">Faturamento</p><p class="metric-value">R$ ${faturamento.toFixed(2)}</p></div>
    <div class="metric-card"><p class="metric-label">NPS médio</p><p class="metric-value">${npsMedio}</p></div>
    <div class="metric-card"><p class="metric-label">Novos contatos</p><p class="metric-value">${novosContatos}</p></div>
  `;
}

// ---------------- NPS POR PROFISSIONAL ----------------
function renderizarNps(atendimentos) {
  const porProf = new Map();
  atendimentos.forEach((a) => {
    if (a.nps === null || a.nps === undefined) return;
    const nome = a.profissionais?.nome || "Sem profissional";
    if (!porProf.has(nome)) porProf.set(nome, []);
    porProf.get(nome).push(a.nps);
  });

  const body = document.getElementById("tabela-nps-body");
  if (porProf.size === 0) {
    body.innerHTML =
      '<tr><td colspan="4" class="empty">Nenhuma avaliação de NPS no período.</td></tr>';
    return;
  }

  body.innerHTML = Array.from(porProf.entries())
    .map(([nome, valores]) => {
      const media = valores.reduce((s, n) => s + n, 0) / valores.length;
      const largura = (media / 5) * 100;
      return `
      <tr>
        <td>${nome}</td><td>${valores.length}</td><td>${media.toFixed(1)}</td>
        <td style="width:160px"><div class="bar-track"><div class="bar-fill" style="width:${largura}%;background:var(--brand)"></div></div></td>
      </tr>
    `;
    })
    .join("");
}

// ---------------- GRÁFICOS POR DIA ----------------
function agruparPorDia(lista, campoData) {
  const contagem = new Map();
  lista.forEach((item) => {
    const data = item[campoData];
    if (!data) return;
    contagem.set(data, (contagem.get(data) || 0) + 1);
  });
  return Array.from(contagem.entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
}

function renderizarChart(containerId, dados) {
  const container = document.getElementById(containerId);
  if (dados.length === 0) {
    container.innerHTML = '<p class="empty">Sem dados no período.</p>';
    return;
  }
  const max = Math.max(...dados.map(([, count]) => count));
  container.innerHTML = dados
    .map(([data, count]) => {
      const altura = Math.max((count / max) * 130, 4);
      return `
      <div class="chart-bar-col">
        <span class="chart-bar-value">${count}</span>
        <div class="chart-bar" style="height:${altura}px"></div>
        <span class="chart-bar-label">${formatarDataCurta(data)}</span>
      </div>
    `;
    })
    .join("");
}

// ---------------- FUNIL DE CLIENTES ----------------
function renderizarFunil(clientes) {
  const contagem = {
    em_atendimento: 0,
    agendado: 0,
    "follow-up": 0,
    perdido: 0,
  };
  clientes.forEach((c) => {
    if (contagem[c.status] !== undefined) contagem[c.status]++;
  });

  const total = clientes.length || 1;
  const container = document.getElementById("funil-container");

  container.innerHTML =
    ORDEM_STATUS.map((status) => {
      const qtd = contagem[status];
      const largura = (qtd / total) * 100;
      return `
      <div class="bar-row">
        <div class="bar-row-head"><span>${NOMES_STATUS[status]}</span><span>${qtd}</span></div>
        <div class="bar-track"><div class="bar-fill funil-${status}" style="width:${largura}%"></div></div>
      </div>
    `;
    }).join("") +
    `<p class="note">Baseado nos ${clientes.length} clientes com primeiro contato no período filtrado.</p>`;
}

// ---------------- CONVERSÃO DO FOLLOW-UP ----------------
function renderizarConversaoFollowup(clientes) {
  const emFollowupOuPerdido = clientes.filter(
    (c) => c.status === "follow-up" || c.status === "perdido",
  );
  const perdidos = clientes.filter((c) => c.status === "perdido");
  const totalCiclo = emFollowupOuPerdido.length;
  const taxaPerda = totalCiclo ? (perdidos.length / totalCiclo) * 100 : 0;
  const taxaRecuperacao = totalCiclo ? 100 - taxaPerda : 0;

  document.getElementById("conversao-container").innerHTML = `
    <div class="metrics-grid" style="margin-bottom:0">
      <div class="metric-card"><p class="metric-label">Entraram em follow-up</p><p class="metric-value">${totalCiclo}</p></div>
      <div class="metric-card"><p class="metric-label">Perdidos</p><p class="metric-value">${perdidos.length}</p></div>
      <div class="metric-card"><p class="metric-label">Taxa de recuperação</p><p class="metric-value">${taxaRecuperacao.toFixed(0)}%</p></div>
      <div class="metric-card"><p class="metric-label">Taxa de perda</p><p class="metric-value">${taxaPerda.toFixed(0)}%</p></div>
    </div>
    <p class="note">Estimativa com base no status atual dos clientes (follow-up + perdido). Um histórico de mudanças de status daria um número mais preciso — pode ser um próximo passo.</p>
  `;
}

// ---------------- CLIENTES EM ATRASO ----------------
async function carregarClientesEmAtraso() {
  const [respClientes, respAtend] = await Promise.all([
    supabaseClient
      .from("clientes")
      .select("id, nome, telefone, data_ult_agend, status")
      .neq("status", "perdido")
      .not("data_ult_agend", "is", null),
    supabaseClient
      .from("atendimentos")
      .select(
        "id_cliente, data_agend, atendimento_servicos ( servicos ( recorrencia ) )",
      ),
  ]);

  const body = document.getElementById("tabela-atraso-body");
  if (respClientes.error || respAtend.error) {
    body.innerHTML =
      '<tr><td colspan="4" class="empty">Erro ao carregar clientes em atraso.</td></tr>';
    return;
  }

  const clientes = respClientes.data || [];
  const atendimentos = respAtend.data || [];

  const ultimoPorCliente = new Map();
  atendimentos.forEach((a) => {
    const atual = ultimoPorCliente.get(a.id_cliente);
    if (!atual || a.data_agend > atual.data_agend)
      ultimoPorCliente.set(a.id_cliente, a);
  });

  const hoje = new Date();
  const linhas = [];

  clientes.forEach((c) => {
    const ultimoAtend = ultimoPorCliente.get(c.id);
    let recorrencia = 30;
    if (ultimoAtend) {
      const recorrencias = (ultimoAtend.atendimento_servicos || [])
        .map((s) => s.servicos?.recorrencia)
        .filter((r) => r !== null && r !== undefined);
      if (recorrencias.length) recorrencia = Math.min(...recorrencias);
    }

    const dataUlt = new Date(c.data_ult_agend + "T00:00:00");
    const dataEsperada = new Date(dataUlt);
    dataEsperada.setDate(dataEsperada.getDate() + recorrencia);

    const diasAtraso = Math.floor(
      (hoje - dataEsperada) / (1000 * 60 * 60 * 24),
    );
    if (diasAtraso > 0) {
      linhas.push({
        nome: c.nome,
        telefone: c.telefone,
        data_ult_agend: c.data_ult_agend,
        diasAtraso,
      });
    }
  });

  linhas.sort((a, b) => b.diasAtraso - a.diasAtraso);

  if (linhas.length === 0) {
    body.innerHTML =
      '<tr><td colspan="4" class="empty">Nenhum cliente em atraso no momento.</td></tr>';
    return;
  }

  body.innerHTML = linhas
    .map(
      (l) => `
    <tr>
      <td>${l.nome}</td>
      <td>${l.telefone}</td>
      <td>${formatarDataBr(l.data_ult_agend)}</td>
      <td>${l.diasAtraso} dia(s)</td>
    </tr>
  `,
    )
    .join("");
}

// ---------------- FATURAMENTO POR SERVIÇO ----------------
function renderizarFaturamentoPorServico(atendimentos) {
  const porServico = new Map();

  atendimentos.forEach((a) => {
    (a.atendimento_servicos || []).forEach((s) => {
      const nome = s.servicos?.nome || "Sem nome";
      const atual = porServico.get(nome) || { total: 0, qtd: 0 };
      atual.total += Number(s.preco_cobrado) || 0;
      atual.qtd += 1;
      porServico.set(nome, atual);
    });
  });

  const container = document.getElementById("faturamento-servico-container");
  if (porServico.size === 0) {
    container.innerHTML = '<p class="empty">Sem dados no período.</p>';
    return;
  }

  const entradas = Array.from(porServico.entries()).sort(
    (a, b) => b[1].total - a[1].total,
  );
  const max = Math.max(...entradas.map(([, v]) => v.total));

  container.innerHTML = entradas
    .map(([nome, v]) => {
      const largura = (v.total / max) * 100;
      return `
      <div class="bar-row">
        <div class="bar-row-head"><span>${nome} (${v.qtd}x)</span><span>R$ ${v.total.toFixed(2)}</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${largura}%;background:var(--brand)"></div></div>
      </div>
    `;
    })
    .join("");
}

// ---------------- OCUPAÇÃO POR PROFISSIONAL ----------------
function renderizarOcupacao(atendimentos) {
  const porProf = new Map();

  atendimentos.forEach((a) => {
    const nome = a.profissionais?.nome || "Sem profissional";
    const atual = porProf.get(nome) || { qtd: 0, minutos: 0, faturamento: 0 };
    atual.qtd += 1;
    atual.minutos += Number(a.duracao_atend) || 0;
    atual.faturamento += Number(a.custo) || 0;
    porProf.set(nome, atual);
  });

  const body = document.getElementById("tabela-ocupacao-body");
  if (porProf.size === 0) {
    body.innerHTML =
      '<tr><td colspan="4" class="empty">Sem dados no período.</td></tr>';
    return;
  }

  const entradas = Array.from(porProf.entries()).sort(
    (a, b) => b[1].minutos - a[1].minutos,
  );

  body.innerHTML = entradas
    .map(([nome, v]) => {
      const horas = (v.minutos / 60).toFixed(1);
      return `<tr><td>${nome}</td><td>${v.qtd}</td><td>${horas}h</td><td>R$ ${v.faturamento.toFixed(2)}</td></tr>`;
    })
    .join("");
}

// ---------------- HORÁRIO DE PICO ----------------
function renderizarPico(atendimentos) {
  const porHora = new Map();
  const porDiaSemana = new Map();

  atendimentos.forEach((a) => {
    if (a.horario) {
      const hora = parseInt(a.horario.slice(0, 2), 10);
      porHora.set(hora, (porHora.get(hora) || 0) + 1);
    }
    if (a.data_agend) {
      const dia = new Date(a.data_agend + "T00:00:00").getDay();
      porDiaSemana.set(dia, (porDiaSemana.get(dia) || 0) + 1);
    }
  });

  const dadosHora = Array.from(porHora.entries()).sort((a, b) => a[0] - b[0]);
  const dadosSemana = [0, 1, 2, 3, 4, 5, 6].map((dia) => [
    dia,
    porDiaSemana.get(dia) || 0,
  ]);

  renderizarChartGenerico("chart-pico-hora", dadosHora, (h) => `${h}h`);
  renderizarChartGenerico("chart-pico-semana", dadosSemana, (d) =>
    DIAS_SEMANA[d].slice(0, 3),
  );
}

function renderizarChartGenerico(containerId, dados, formatarLabel) {
  const container = document.getElementById(containerId);
  if (dados.length === 0 || dados.every(([, v]) => v === 0)) {
    container.innerHTML = '<p class="empty">Sem dados no período.</p>';
    return;
  }
  const max = Math.max(...dados.map(([, count]) => count), 1);
  container.innerHTML = dados
    .map(([chave, count]) => {
      const altura = Math.max((count / max) * 130, 2);
      return `
      <div class="chart-bar-col">
        <span class="chart-bar-value">${count}</span>
        <div class="chart-bar" style="height:${altura}px"></div>
        <span class="chart-bar-label">${formatarLabel(chave)}</span>
      </div>
    `;
    })
    .join("");
}

document.getElementById("filtrar-btn").addEventListener("click", () => {
  const inicio = document.getElementById("filtro-inicio").value || null;
  const fim = document.getElementById("filtro-fim").value || null;
  carregarRelatorios(inicio, fim);
});

document.getElementById("limpar-filtro-btn").addEventListener("click", () => {
  document.getElementById("filtro-inicio").value = "";
  document.getElementById("filtro-fim").value = "";
  carregarRelatorios(null, null);
});

document.getElementById("logout-link").addEventListener("click", async (e) => {
  e.preventDefault();
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
});

(async () => {
  try {
    if (typeof supabaseClient === "undefined") {
      throw new Error("Cliente Supabase não inicializado.");
    }
    const session = await checarSessao();
    if (session) {
      await aplicarTemaUsuario();
      await carregarNomeBarbearia();
      await carregarRelatorios(null, null);
    }
  } catch (err) {
    console.error(err);
    document.getElementById("metrics-grid").innerHTML =
      `<p class="empty">Erro: ${err.message}</p>`;
  }
})();
