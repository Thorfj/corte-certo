if (typeof lucide !== "undefined") {
  lucide.createIcons();
} else {
  console.error("Lucide não carregou — verifique a conexão com unpkg.com");
}

const DIAS_SEMANA_NOMES = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

const DIAS_SEMANA_CURTO = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const MESES_NOMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

let profissionaisCache = [];
let profSelecionados = new Set();
let corPorProfissional = new Map();
let atendimentosPeriodoCache = [];
let bloqueiosTodosCache = [];
let viewMode = "dia"; // "dia" | "mes" | "bloqueios"
let dataFoco = new Date();
dataFoco.setHours(0, 0, 0, 0);

const PALETA_CORES = [
  "#0f6e56",
  "#d97706",
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#059669",
  "#dc2626",
  "#4b5563",
];

// ---------------- DATAS ----------------
function getSegunda(data) {
  const d = new Date(data);
  const dia = d.getDay(); // 0 = domingo
  const diff = dia === 0 ? -6 : 1 - dia;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function paraISO(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function formatarDataCurta(data) {
  const dia = String(data.getDate()).padStart(2, "0");
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}`;
}

function getPrimeiroDiaMes(data) {
  return new Date(data.getFullYear(), data.getMonth(), 1);
}

function bloqueioAplicaEm(bloqueio, dataISO, idProf) {
  if (bloqueio.id_prof && bloqueio.id_prof !== idProf) return false;

  if (bloqueio.tipo === "unico") {
    return bloqueio.data_inicio === dataISO;
  }
  if (bloqueio.tipo === "periodo") {
    return dataISO >= bloqueio.data_inicio && dataISO <= bloqueio.data_fim;
  }
  if (bloqueio.tipo === "recorrente") {
    const diaSemana = new Date(dataISO + "T00:00:00").getDay();
    return diaSemana === bloqueio.dia_semana;
  }
  return false;
}

function bloqueiosParaData(dataISO, idProf) {
  return bloqueiosTodosCache.filter((b) =>
    bloqueioAplicaEm(b, dataISO, idProf),
  );
}

function descreverHorarioBloqueio(bloqueio) {
  if (bloqueio.horario_inicio && bloqueio.horario_fim) {
    return `${bloqueio.horario_inicio.slice(0, 5)}–${bloqueio.horario_fim.slice(0, 5)}`;
  }
  return "Dia inteiro";
}

function getUltimoDiaMes(data) {
  return new Date(data.getFullYear(), data.getMonth() + 1, 0);
}

function obterIntervalo() {
  if (viewMode === "mes") {
    const primeiro = getPrimeiroDiaMes(dataFoco);
    const ultimo = getUltimoDiaMes(dataFoco);
    const inicioGrid = getSegunda(primeiro);
    const fimGrid = new Date(getSegunda(ultimo));
    fimGrid.setDate(fimGrid.getDate() + 6);
    return { inicio: inicioGrid, fim: fimGrid };
  }
  return { inicio: dataFoco, fim: dataFoco };
}

function atualizarLabel() {
  const labelEl = document.getElementById("semana-label");
  if (viewMode === "mes") {
    labelEl.textContent = `${MESES_NOMES[dataFoco.getMonth()]} de ${dataFoco.getFullYear()}`;
  } else {
    labelEl.textContent = `${DIAS_SEMANA_NOMES[dataFoco.getDay()]}, ${formatarDataCurta(dataFoco)}/${dataFoco.getFullYear()}`;
  }
}

// ---------------- PROFISSIONAIS (seletor) ----------------
async function carregarProfissionais() {
  const barbeariaId = await obterBarbeariaId();
  const meuProf = await obterMeuProfissional();

  const { data, error } = await supabaseClient
    .from("profissionais")
    .select("id, nome")
    .eq("barbearia_id", barbeariaId)
    .order("nome", { ascending: true });

  const container = document.getElementById("prof-selector");

  if (error || !data) {
    container.innerHTML =
      '<span class="empty">Erro ao carregar profissionais.</span>';
    return;
  }

  // papel "usuario" só enxerga a própria agenda — nem mostra os
  // outros profissionais como opção de filtro
  const listaExibida =
    meuProf.acesso === "usuario"
      ? data.filter((p) => p.id === meuProf.id)
      : data;

  profissionaisCache = listaExibida;
  profSelecionados = new Set(listaExibida.map((p) => p.id));
  corPorProfissional = new Map(
    listaExibida.map((p, i) => [p.id, PALETA_CORES[i % PALETA_CORES.length]]),
  );

  if (meuProf.acesso === "usuario") {
    // só ele mesmo — sem chip clicável, não tem o que filtrar
    container.innerHTML = listaExibida
      .map(
        (p) => `
      <span class="prof-chip active" style="cursor:default">
        <span class="prof-dot" style="background:${corPorProfissional.get(p.id)}"></span>
        ${p.nome}
      </span>
    `,
      )
      .join("");
    return;
  }

  container.innerHTML = data
    .map(
      (p) => `
      <button type="button" class="prof-chip active" data-id="${p.id}">
        <span class="prof-dot" style="background:${corPorProfissional.get(p.id)}"></span>
        ${p.nome}
      </button>
    `,
    )
    .join("");

  container.querySelectorAll(".prof-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const id = Number(chip.dataset.id);
      if (profSelecionados.has(id)) {
        profSelecionados.delete(id);
        chip.classList.remove("active");
      } else {
        profSelecionados.add(id);
        chip.classList.add("active");
      }
      renderizarPeriodo(atendimentosPeriodoCache);
    });
  });
}

// ---------------- CARREGAR ATENDIMENTOS DO PERÍODO ----------------
async function carregarPeriodo() {
  atualizarLabel();

  const { inicio, fim } = obterIntervalo();
  const inicioISO = paraISO(inicio);
  const fimISO = paraISO(fim);
  const barbeariaId = await obterBarbeariaId();

  // TODO: quando o n8n tiver os webhooks do Google Calendar prontos,
  // trocar esta consulta pela chamada ao webhook que lê os eventos reais
  // do Google. Por enquanto, a fonte de verdade é a tabela `atendimentos`.
  const [respAtend, respBloqueios] = await Promise.all([
    supabaseClient
      .from("atendimentos")
      .select(
        `
        id, data_agend, horario, id_prof,
        clientes ( nome ),
        atendimento_servicos ( servicos ( nome ) )
      `,
      )
      .eq("barbearia_id", barbeariaId)
      .gte("data_agend", inicioISO)
      .lte("data_agend", fimISO)
      .order("horario", { ascending: true }),
    supabaseClient
      .from("bloqueios_agenda")
      .select(
        "id, id_prof, tipo, data_inicio, data_fim, dia_semana, horario_inicio, horario_fim, motivo",
      )
      .eq("barbearia_id", barbeariaId),
  ]);

  const container = document.getElementById("agenda-semana");

  if (respAtend.error) {
    console.error(respAtend.error);
    container.innerHTML = '<p class="empty">Erro ao carregar a agenda.</p>';
    return;
  }

  atendimentosPeriodoCache = respAtend.data || [];
  bloqueiosTodosCache = respBloqueios.data || [];
  renderizarPeriodo(atendimentosPeriodoCache);
}

function renderizarPeriodo(atendimentos) {
  if (viewMode === "mes") {
    renderizarMes(atendimentos);
  } else {
    renderizarDia(atendimentos);
  }
}

function renderizarDia(atendimentos) {
  const container = document.getElementById("agenda-semana");
  const iso = paraISO(dataFoco);

  const profsAtivos = profissionaisCache.filter((p) =>
    profSelecionados.has(p.id),
  );

  if (profsAtivos.length === 0) {
    container.innerHTML =
      '<p class="empty">Selecione ao menos um profissional.</p>';
    return;
  }

  const itensDoDia = atendimentos.filter((a) => a.data_agend === iso);

  const subcolunasHtml = profsAtivos
    .map((prof) => {
      const cor = corPorProfissional.get(prof.id) || "var(--border-strong)";
      const itensProf = itensDoDia
        .filter((a) => a.id_prof === prof.id)
        .sort((a, b) => (a.horario || "").localeCompare(b.horario || ""));

      const bloqueiosDoDia = bloqueiosParaData(iso, prof.id);
      const bloqueioHtml = bloqueiosDoDia
        .map(
          (b) => `
          <div class="bloqueio-banner">
            🚫 Bloqueado — ${descreverHorarioBloqueio(b)}${b.motivo ? ` · ${b.motivo}` : ""}
          </div>
        `,
        )
        .join("");

      const itensHtml = itensProf.length
        ? itensProf
            .map((a) => {
              const servicos = (a.atendimento_servicos || [])
                .map((s) => s.servicos?.nome)
                .filter(Boolean)
                .join(" + ");
              const horario = a.horario ? a.horario.slice(0, 5) : "";
              return `
                <div class="agenda-item" style="--prof-cor:${cor}">
                  <p class="agenda-item-horario">${horario}</p>
                  <p class="agenda-item-detalhe">${a.clientes?.nome || "Cliente"}</p>
                  <p class="agenda-item-detalhe">${servicos || "Sem serviço definido"}</p>
                </div>
              `;
            })
            .join("")
        : '<p class="empty">Nenhum atendimento</p>';

      return `
        <div class="prof-subcolumn" style="--prof-cor:${cor}">
          <p class="prof-subcolumn-title"><span class="prof-dot" style="background:${cor}"></span>${prof.nome}</p>
          ${bloqueioHtml}
          ${itensHtml}
        </div>
      `;
    })
    .join("");

  container.innerHTML = `
    <div class="dia-view">
      <div class="prof-subcolumns">${subcolunasHtml}</div>
    </div>
  `;
}

function renderizarMes(atendimentos) {
  const container = document.getElementById("agenda-semana");
  const hojeISO = paraISO(new Date());
  const mesReferencia = dataFoco.getMonth();
  const primeiro = getPrimeiroDiaMes(dataFoco);
  const ultimo = getUltimoDiaMes(dataFoco);
  const inicioGrid = getSegunda(primeiro);
  const fimGrid = new Date(getSegunda(ultimo));
  fimGrid.setDate(fimGrid.getDate() + 6);

  const totalDias =
    Math.round((fimGrid - inicioGrid) / (1000 * 60 * 60 * 24)) + 1;

  const nomesHtml = DIAS_SEMANA_CURTO.map(
    (nome) => `<p class="mes-dia-nome">${nome}</p>`,
  ).join("");

  const celulasHtml = [];
  for (let i = 0; i < totalDias; i++) {
    const dataDia = new Date(inicioGrid);
    dataDia.setDate(dataDia.getDate() + i);
    const iso = paraISO(dataDia);
    const foraMes = dataDia.getMonth() !== mesReferencia;
    const isHoje = iso === hojeISO;

    const itensDoDia = atendimentos
      .filter((a) => a.data_agend === iso)
      .filter((a) => profSelecionados.has(a.id_prof))
      .sort((a, b) => (a.horario || "").localeCompare(b.horario || ""));

    const temBloqueio =
      Array.from(profSelecionados).some(
        (idProf) => bloqueiosParaData(iso, idProf).length > 0,
      ) || bloqueiosParaData(iso, null).length > 0;

    const limiteVisivel = 3;
    const chipsHtml = itensDoDia
      .slice(0, limiteVisivel)
      .map((a) => {
        const cor = corPorProfissional.get(a.id_prof) || "var(--border-strong)";
        const horario = a.horario ? a.horario.slice(0, 5) : "";
        return `<p class="mes-item-chip" style="--prof-cor:${cor}">${horario} ${a.clientes?.nome || "Cliente"}</p>`;
      })
      .join("");
    const maisHtml =
      itensDoDia.length > limiteVisivel
        ? `<p class="mes-cell-mais">+${itensDoDia.length - limiteVisivel}</p>`
        : "";

    celulasHtml.push(`
      <div class="mes-cell${foraMes ? " fora-mes" : ""}${isHoje ? " hoje" : ""}${temBloqueio ? " bloqueado" : ""}" data-iso="${iso}">
        <p class="mes-cell-numero">${dataDia.getDate()}</p>
        <div class="mes-cell-itens">${chipsHtml}${maisHtml}</div>
      </div>
    `);
  }

  container.innerHTML = `
    <div class="mes-dias-nomes">${nomesHtml}</div>
    <div class="mes-grid">${celulasHtml.join("")}</div>
  `;

  container.querySelectorAll(".mes-cell").forEach((cell) => {
    cell.addEventListener("click", () => {
      const [ano, mes, dia] = cell.dataset.iso.split("-").map(Number);
      dataFoco = new Date(ano, mes - 1, dia);
      definirViewMode("dia");
    });
  });
}

// ---------------- MODO DE VISUALIZAÇÃO ----------------
function definirViewMode(modo) {
  viewMode = modo;
  document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === modo);
  });

  const ehBloqueios = modo === "bloqueios";

  document.getElementById("semana-nav").classList.toggle("hidden", ehBloqueios);
  document
    .getElementById("prof-selector")
    .classList.toggle("hidden", ehBloqueios);
  document
    .getElementById("agenda-semana")
    .classList.toggle("hidden", ehBloqueios);
  document
    .getElementById("bloqueios-panel")
    .classList.toggle("hidden", !ehBloqueios);
  document
    .getElementById("bloqueios-toolbar")
    .classList.toggle("hidden", !ehBloqueios);

  if (ehBloqueios) {
    carregarBloqueios();
  } else {
    carregarPeriodo();
  }
}

document.querySelectorAll(".view-btn").forEach((btn) => {
  btn.addEventListener("click", () => definirViewMode(btn.dataset.view));
});

// ---------------- NAVEGAÇÃO DE PERÍODO ----------------
function avancarPeriodo(direcao) {
  if (viewMode === "mes") {
    dataFoco.setMonth(dataFoco.getMonth() + direcao);
  } else {
    dataFoco.setDate(dataFoco.getDate() + direcao);
  }
  carregarPeriodo();
}

document.getElementById("semana-anterior-btn").addEventListener("click", () => {
  avancarPeriodo(-1);
});

document.getElementById("semana-seguinte-btn").addEventListener("click", () => {
  avancarPeriodo(1);
});

document.getElementById("hoje-btn").addEventListener("click", () => {
  dataFoco = new Date();
  dataFoco.setHours(0, 0, 0, 0);
  carregarPeriodo();
});

// ---------------- BLOQUEIOS DE AGENDA ----------------
let bloqueiosCache = [];

async function popularSelectProfBloqueio() {
  const select = document.getElementById("bl-prof");
  const meuProf = await obterMeuProfissional();

  // "usuario" só pode bloquear a própria agenda — nada de escolher
  // outro profissional ou "barbearia inteira"
  if (meuProf.acesso === "usuario") {
    const eu = profissionaisCache.find((p) => p.id === meuProf.id);
    select.innerHTML = eu ? `<option value="${eu.id}">${eu.nome}</option>` : "";
    select.disabled = true;
    return;
  }

  select.disabled = false;
  const opcoesProf = profissionaisCache
    .map((p) => `<option value="${p.id}">${p.nome}</option>`)
    .join("");
  select.innerHTML = `<option value="">Barbearia inteira</option>${opcoesProf}`;
}

async function carregarBloqueios() {
  const barbeariaId = await obterBarbeariaId();
  const { data, error } = await supabaseClient
    .from("bloqueios_agenda")
    .select(
      "id, id_prof, tipo, data_inicio, data_fim, dia_semana, horario_inicio, horario_fim, motivo, origem",
    )
    .eq("barbearia_id", barbeariaId)
    .order("criado_em", { ascending: false });

  const body = document.getElementById("tabela-bloqueios-body");

  if (error) {
    body.innerHTML =
      '<tr><td colspan="4" class="empty">Erro ao carregar bloqueios.</td></tr>';
    return;
  }

  bloqueiosCache = data || [];
  renderizarBloqueios();
}

function nomeProfissional(idProf) {
  if (!idProf) return "Barbearia inteira";
  const prof = profissionaisCache.find((p) => p.id === idProf);
  return prof ? prof.nome : "—";
}

function descreverQuando(bloqueio) {
  const horarioTexto =
    bloqueio.horario_inicio && bloqueio.horario_fim
      ? ` · ${bloqueio.horario_inicio.slice(0, 5)}–${bloqueio.horario_fim.slice(0, 5)}`
      : " · Dia inteiro";

  if (bloqueio.tipo === "unico") {
    return `${formatarDataCurta(new Date(bloqueio.data_inicio + "T00:00:00"))}${horarioTexto}`;
  }
  if (bloqueio.tipo === "periodo") {
    const inicio = formatarDataCurta(
      new Date(bloqueio.data_inicio + "T00:00:00"),
    );
    const fim = formatarDataCurta(new Date(bloqueio.data_fim + "T00:00:00"));
    return `${inicio} até ${fim}${horarioTexto}`;
  }
  return `Toda ${DIAS_SEMANA_NOMES[bloqueio.dia_semana]}${horarioTexto}`;
}

function renderizarBloqueios() {
  const body = document.getElementById("tabela-bloqueios-body");

  if (bloqueiosCache.length === 0) {
    body.innerHTML =
      '<tr><td colspan="4" class="empty">Nenhum bloqueio cadastrado.</td></tr>';
    return;
  }

  body.innerHTML = bloqueiosCache
    .map(
      (b) => `
      <tr>
        <td>${nomeProfissional(b.id_prof)}</td>
        <td>${descreverQuando(b)}</td>
        <td>${b.motivo || "—"}${b.origem === "google_calendar" ? '<br><span class="bloqueio-origem">Sincronizado do Google Calendar</span>' : ""}</td>
        <td class="col-acoes"><button type="button" class="icon-btn" data-excluir="${b.id}" title="Excluir">✕</button></td>
      </tr>
    `,
    )
    .join("");

  body.querySelectorAll("[data-excluir]").forEach((btn) => {
    btn.addEventListener("click", () => excluirBloqueio(btn.dataset.excluir));
  });
}

async function excluirBloqueio(id) {
  if (!confirm("Tem certeza que deseja excluir este bloqueio?")) return;
  const { error } = await supabaseClient
    .from("bloqueios_agenda")
    .delete()
    .eq("id", id);
  if (error) {
    alert("Erro ao excluir bloqueio.");
    return;
  }
  await carregarBloqueios();
}

// Alterna os campos visíveis do form conforme o tipo escolhido
document.getElementById("bl-tipo").addEventListener("change", (e) => {
  const tipo = e.target.value;
  document
    .getElementById("bl-campo-unico")
    .classList.toggle("hidden", tipo !== "unico");
  document
    .getElementById("bl-campo-periodo")
    .classList.toggle("hidden", tipo !== "periodo");
  document
    .getElementById("bl-campo-recorrente")
    .classList.toggle("hidden", tipo !== "recorrente");
});

// Alterna o campo de horário conforme "dia inteiro"
document.getElementById("bl-dia-inteiro").addEventListener("change", (e) => {
  document
    .getElementById("bl-campo-horario")
    .classList.toggle("hidden", e.target.checked);
});

document.getElementById("novo-bloqueio-btn").addEventListener("click", async () => {
  document.getElementById("form-bloqueio").reset();
  await popularSelectProfBloqueio();
  document.getElementById("bl-campo-unico").classList.remove("hidden");
  document.getElementById("bl-campo-periodo").classList.add("hidden");
  document.getElementById("bl-campo-recorrente").classList.add("hidden");
  document.getElementById("bl-campo-horario").classList.add("hidden");
  document.getElementById("bl-erro").style.display = "none";
  document.getElementById("modal-bloqueio").classList.remove("hidden");
});

document
  .getElementById("form-bloqueio")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const tipo = document.getElementById("bl-tipo").value;
    const idProf = document.getElementById("bl-prof").value || null;
    const diaInteiro = document.getElementById("bl-dia-inteiro").checked;
    const motivo = document.getElementById("bl-motivo").value.trim() || null;
    const erroEl = document.getElementById("bl-erro");
    const salvarBtn = document.getElementById("bl-salvar-btn");

    erroEl.style.display = "none";

    const payload = {
      id_prof: idProf,
      tipo,
      motivo,
      origem: "manual",
      horario_inicio: diaInteiro
        ? null
        : document.getElementById("bl-horario-inicio").value || null,
      horario_fim: diaInteiro
        ? null
        : document.getElementById("bl-horario-fim").value || null,
      data_inicio: null,
      data_fim: null,
      dia_semana: null,
    };

    if (tipo === "unico") {
      const data = document.getElementById("bl-data-unica").value;
      if (!data) {
        erroEl.textContent = "Escolha uma data.";
        erroEl.style.display = "block";
        return;
      }
      payload.data_inicio = data;
    } else if (tipo === "periodo") {
      const inicio = document.getElementById("bl-data-inicio").value;
      const fim = document.getElementById("bl-data-fim").value;
      if (!inicio || !fim) {
        erroEl.textContent = "Preencha as duas datas do período.";
        erroEl.style.display = "block";
        return;
      }
      payload.data_inicio = inicio;
      payload.data_fim = fim;
    } else {
      payload.dia_semana = Number(
        document.getElementById("bl-dia-semana").value,
      );
    }

    salvarBtn.disabled = true;
    salvarBtn.textContent = "Salvando...";

    try {
      const barbeariaId = await obterBarbeariaId();
      const { error } = await supabaseClient
        .from("bloqueios_agenda")
        .insert({ barbearia_id: barbeariaId, ...payload });
      if (error) throw error;

      document.getElementById("modal-bloqueio").classList.add("hidden");
      await carregarBloqueios();
    } catch (err) {
      console.error(err);
      erroEl.textContent = "Erro ao salvar bloqueio.";
      erroEl.style.display = "block";
    } finally {
      salvarBtn.disabled = false;
      salvarBtn.textContent = "Salvar bloqueio";
    }
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
      await carregarProfissionais();
      await carregarPeriodo();
    }
  } catch (err) {
    console.error(err);
    document.getElementById("agenda-semana").innerHTML =
      `<p class="empty">Erro: ${err.message}</p>`;
  }
})();