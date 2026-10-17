/* ============================================================
   BARBOZAP — FINANCEIRO.JS
   Números financeiros da barbearia e por profissional, a partir dos
   atendimentos (o valor de cada um, `custo`, é a soma dos serviços,
   mantida pelo banco).

   Regras:
     - realizado  = horário já passou e o cliente não faltou
     - recebido   = realizado e marcado como pago
     - fiado      = realizado e ainda não pago
     - previsto   = horário ainda não chegou (dentro do período)
     - faltas     = marcado "cliente não compareceu"
   Atendimentos antigos (antes do controle de pagamento) não têm
   pagamento informado: entram no faturamento, mas nem como pago nem
   como fiado.
   ============================================================ */

if (typeof lucide !== "undefined") lucide.createIcons();

const FORMAS = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  debito: "Cartão de débito",
  credito: "Cartão de crédito",
  outro: "Outro",
};

const moeda = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const isoLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const dataBr = (iso) => {
  const [a, m, d] = String(iso).split("-");
  return `${d}/${m}/${a}`;
};

function inicioDoAtendimento(a) {
  return new Date(`${a.data_agend}T${String(a.horario || "00:00").slice(0, 5)}:00`);
}

function classificar(a, agora) {
  if (a.compareceu === false) return "falta";
  return inicioDoAtendimento(a) <= agora ? "realizado" : "previsto";
}

// ---------------- Período ----------------
function intervaloDoAtalho(periodo) {
  const hoje = new Date();
  const y = hoje.getFullYear();
  const m = hoje.getMonth();
  if (periodo === "hoje") return [isoLocal(hoje), isoLocal(hoje)];
  if (periodo === "7dias") {
    const ini = new Date(hoje);
    ini.setDate(ini.getDate() - 6);
    return [isoLocal(ini), isoLocal(hoje)];
  }
  if (periodo === "mes-passado") {
    return [isoLocal(new Date(y, m - 1, 1)), isoLocal(new Date(y, m, 0))];
  }
  return [isoLocal(new Date(y, m, 1)), isoLocal(new Date(y, m + 1, 0))];
}

function aplicarAtalho(periodo) {
  document.querySelectorAll(".fin-atalho").forEach((b) =>
    b.classList.toggle("active", b.dataset.periodo === periodo),
  );
  const [ini, fim] = intervaloDoAtalho(periodo);
  document.getElementById("fin-inicio").value = ini;
  document.getElementById("fin-fim").value = fim;
  carregarFinanceiro();
}

document.querySelectorAll(".fin-atalho").forEach((b) =>
  b.addEventListener("click", () => aplicarAtalho(b.dataset.periodo)),
);

document.getElementById("fin-filtrar-btn").addEventListener("click", () => {
  document.querySelectorAll(".fin-atalho").forEach((b) => b.classList.remove("active"));
  carregarFinanceiro();
});

// ---------------- Carregamento ----------------
async function carregarFinanceiro() {
  const inicio = document.getElementById("fin-inicio").value;
  const fim = document.getElementById("fin-fim").value;
  const erroEl = document.getElementById("fin-erro");
  erroEl.classList.add("hidden");

  if (!inicio || !fim || inicio > fim) {
    erroEl.textContent = "Escolha um período válido.";
    erroEl.classList.remove("hidden");
    return;
  }

  try {
    const barbeariaId = await obterBarbeariaId();
    const { data, error } = await supabaseClient
      .from("atendimentos")
      .select(
        "id, data_agend, horario, custo, compareceu, pagamento, forma_pagamento, nps, id_prof, profissionais ( nome ), atendimento_servicos ( preco_cobrado, servicos ( nome ) )",
      )
      .eq("barbearia_id", barbeariaId)
      .gte("data_agend", inicio)
      .lte("data_agend", fim);
    if (error) throw error;

    const agora = new Date();
    const lista = (data || []).map((a) => ({ ...a, situacao: classificar(a, agora), valor: Number(a.custo) || 0 }));

    renderizarKpis(lista);
    renderizarGrafico(lista, inicio, fim);
    renderizarFormas(lista);
    renderizarServicos(lista);
    renderizarProfissionais(lista);
  } catch (err) {
    console.error(err);
    erroEl.textContent = "Não foi possível carregar o financeiro agora.";
    erroEl.classList.remove("hidden");
  }

  carregarFiadoEmAberto();
}

// ---------------- Barbearia ----------------
function renderizarKpis(lista) {
  const realizados = lista.filter((a) => a.situacao === "realizado");
  const soma = (l) => l.reduce((s, a) => s + a.valor, 0);

  const faturamento = soma(realizados);
  const recebidos = realizados.filter((a) => a.pagamento === "pago");
  const fiados = realizados.filter((a) => a.pagamento === "pendente");
  const semInfo = realizados.filter((a) => !a.pagamento);
  const previstos = lista.filter((a) => a.situacao === "previsto");
  const faltas = lista.filter((a) => a.situacao === "falta");
  const ticket = realizados.length ? faturamento / realizados.length : 0;

  const kpi = (rotulo, valor, sub = "", classe = "") => `
    <div class="metric-card ${classe}">
      <p class="metric-label">${rotulo}</p>
      <p class="metric-value">${valor}</p>
      ${sub ? `<p class="metric-sub">${sub}</p>` : ""}
    </div>`;

  document.getElementById("fin-kpis").innerHTML = [
    kpi("Faturamento", moeda(faturamento), `${realizados.length} atendimento(s) realizado(s)`, "fin-destaque"),
    kpi("Recebido", moeda(soma(recebidos)), `${recebidos.length} pago(s)`),
    kpi("Fiado a receber", moeda(soma(fiados)), `${fiados.length} sem pagamento`, fiados.length ? "fin-alerta" : ""),
    kpi("Ticket médio", moeda(ticket), "por atendimento realizado"),
    kpi("Previsto", moeda(soma(previstos)), `${previstos.length} agendado(s) no período`),
    kpi("Perdido com faltas", moeda(soma(faltas)), `${faltas.length} falta(s)`),
  ].join("");

  const nota = document.getElementById("fin-nota");
  if (semInfo.length) {
    nota.textContent = `${semInfo.length} atendimento(s) (${moeda(soma(semInfo))}) são de antes do controle de pagamento: entram no faturamento, mas não aparecem como pagos nem como fiado.`;
    nota.classList.remove("hidden");
  } else {
    nota.classList.add("hidden");
  }
}

function renderizarGrafico(lista, inicio, fim) {
  const porDia = new Map();
  for (const a of lista) {
    if (a.situacao !== "realizado") continue;
    porDia.set(a.data_agend, (porDia.get(a.data_agend) || 0) + a.valor);
  }

  // um ponto por dia do período (até 62 dias, pra não virar uma linha de pó)
  const dias = [];
  const d = new Date(`${inicio}T12:00:00`);
  const ultimo = new Date(`${fim}T12:00:00`);
  while (d <= ultimo && dias.length < 62) {
    dias.push(isoLocal(d));
    d.setDate(d.getDate() + 1);
  }

  const maior = Math.max(0, ...dias.map((dia) => porDia.get(dia) || 0));
  const el = document.getElementById("fin-grafico");
  if (!maior) {
    el.innerHTML = '<p class="fin-vazio">Nenhum atendimento realizado no período.</p>';
    return;
  }

  el.innerHTML = `
    <div class="fin-barras">
      ${dias
        .map((dia) => {
          const v = porDia.get(dia) || 0;
          const h = Math.max(v ? 4 : 0, Math.round((v / maior) * 100));
          return `<div class="fin-barra-col" title="${dataBr(dia)}: ${moeda(v)}">
            <div class="fin-barra" style="height:${h}%"></div>
            <span class="fin-barra-dia">${dia.slice(8)}</span>
          </div>`;
        })
        .join("")}
    </div>`;
}

function listaHorizontal(itens, total, vazio) {
  if (!itens.length) return `<p class="fin-vazio">${vazio}</p>`;
  return `<ul class="fin-lista">
    ${itens
      .map(
        (i) => `
      <li>
        <div class="fin-lista-topo"><span>${i.nome}${i.qtd != null ? ` <small>· ${i.qtd}</small>` : ""}</span><strong>${moeda(i.valor)}</strong></div>
        <div class="fin-lista-barra"><span style="width:${total ? Math.round((i.valor / total) * 100) : 0}%"></span></div>
      </li>`,
      )
      .join("")}
  </ul>`;
}

function renderizarFormas(lista) {
  const pagos = lista.filter((a) => a.situacao === "realizado" && a.pagamento === "pago");
  const mapa = new Map();
  for (const a of pagos) {
    const nome = FORMAS[a.forma_pagamento] || "Não informada";
    const atual = mapa.get(nome) || { nome, valor: 0, qtd: 0 };
    atual.valor += a.valor;
    atual.qtd += 1;
    mapa.set(nome, atual);
  }
  const itens = [...mapa.values()].sort((a, b) => b.valor - a.valor);
  const total = itens.reduce((s, i) => s + i.valor, 0);
  document.getElementById("fin-formas").innerHTML = listaHorizontal(itens, total, "Nenhum pagamento registrado no período.");
}

function renderizarServicos(lista) {
  const mapa = new Map();
  for (const a of lista) {
    if (a.situacao !== "realizado") continue;
    for (const s of a.atendimento_servicos || []) {
      const nome = s.servicos?.nome || "Serviço removido";
      const atual = mapa.get(nome) || { nome, valor: 0, qtd: 0 };
      atual.valor += Number(s.preco_cobrado) || 0;
      atual.qtd += 1;
      mapa.set(nome, atual);
    }
  }
  const itens = [...mapa.values()].sort((a, b) => b.valor - a.valor);
  const total = itens.reduce((s, i) => s + i.valor, 0);
  document.getElementById("fin-servicos").innerHTML = listaHorizontal(itens, total, "Nenhum serviço realizado no período.");
}

// ---------------- Por profissional ----------------
function renderizarProfissionais(lista) {
  const mapa = new Map();
  for (const a of lista) {
    const chave = a.id_prof;
    const p = mapa.get(chave) || {
      nome: a.profissionais?.nome || "—",
      realizados: 0, faturamento: 0, recebido: 0, fiado: 0, faltas: 0, notas: [],
    };
    if (a.situacao === "realizado") {
      p.realizados += 1;
      p.faturamento += a.valor;
      if (a.pagamento === "pago") p.recebido += a.valor;
      if (a.pagamento === "pendente") p.fiado += a.valor;
      if (a.nps != null) p.notas.push(Number(a.nps));
    }
    if (a.situacao === "falta") p.faltas += 1;
    mapa.set(chave, p);
  }

  const profs = [...mapa.values()].sort((a, b) => b.faturamento - a.faturamento);
  const totalGeral = profs.reduce((s, p) => s + p.faturamento, 0);
  const body = document.getElementById("fin-prof-body");

  if (!profs.length) {
    body.innerHTML = '<tr><td colspan="9" class="empty">Nenhum atendimento no período.</td></tr>';
    return;
  }

  body.innerHTML = profs
    .map((p) => {
      const ticket = p.realizados ? p.faturamento / p.realizados : 0;
      const pct = totalGeral ? Math.round((p.faturamento / totalGeral) * 100) : 0;
      const nota = p.notas.length ? (p.notas.reduce((s, n) => s + n, 0) / p.notas.length).toFixed(1) : "—";
      return `
      <tr>
        <td><strong>${p.nome}</strong></td>
        <td class="num">${p.realizados}</td>
        <td class="num">${moeda(p.faturamento)}</td>
        <td class="num">${moeda(p.recebido)}</td>
        <td class="num${p.fiado ? " fin-texto-alerta" : ""}">${moeda(p.fiado)}</td>
        <td class="num">${moeda(ticket)}</td>
        <td class="num">${p.faltas}</td>
        <td class="num">
          <div class="fin-pct"><span style="width:${pct}%"></span></div>${pct}%
        </td>
        <td class="num">${nota}</td>
      </tr>`;
    })
    .join("");
}

// ---------------- Fiado em aberto (todos os períodos) ----------------
async function carregarFiadoEmAberto() {
  const body = document.getElementById("fin-fiado-body");
  try {
    const barbeariaId = await obterBarbeariaId();
    const { data, error } = await supabaseClient
      .from("atendimentos")
      .select("id, data_agend, horario, custo, compareceu, clientes ( nome, telefone ), profissionais ( nome )")
      .eq("barbearia_id", barbeariaId)
      .eq("pagamento", "pendente")
      .lte("data_agend", isoLocal(new Date()))
      .order("data_agend", { ascending: true });
    if (error) throw error;

    const agora = new Date();
    const fiados = (data || []).filter((a) => a.compareceu !== false && inicioDoAtendimento(a) <= agora);

    if (!fiados.length) {
      body.innerHTML = '<tr><td colspan="5" class="empty">Nenhum fiado em aberto. 👍</td></tr>';
      return;
    }

    body.innerHTML = fiados
      .map(
        (a) => `
      <tr>
        <td>${a.clientes?.nome || "Cliente"}${a.clientes?.telefone ? `<br><a class="fin-tel" href="https://wa.me/${String(a.clientes.telefone).replace(/\D/g, "")}" target="_blank" rel="noopener">${a.clientes.telefone}</a>` : ""}</td>
        <td>${dataBr(a.data_agend)}</td>
        <td>${a.profissionais?.nome || "—"}</td>
        <td class="num">${moeda(a.custo)}</td>
        <td class="num"><button type="button" class="btn btn-sm" data-pagar="${a.id}">Marcar pago</button></td>
      </tr>`,
      )
      .join("");

    body.querySelectorAll("[data-pagar]").forEach((btn) =>
      btn.addEventListener("click", () => marcarPago(btn.dataset.pagar, btn)),
    );
  } catch (err) {
    console.error(err);
    body.innerHTML = '<tr><td colspan="5" class="empty">Erro ao carregar o fiado.</td></tr>';
  }
}

async function marcarPago(atendId, btn) {
  btn.disabled = true;
  btn.textContent = "Salvando...";
  const { error } = await supabaseClient
    .from("atendimentos")
    .update({ pagamento: "pago", pago_em: new Date().toISOString() })
    .eq("id", atendId);
  if (error) {
    console.error(error);
    btn.disabled = false;
    btn.textContent = "Marcar pago";
    alert("Não foi possível marcar como pago agora.");
    return;
  }
  carregarFinanceiro();
}

// ---------------- Início ----------------
(async () => {
  try {
    const session = await checarSessao();
    if (!session) return;
    await aplicarTemaUsuario();
    await carregarNomeBarbearia();
    aplicarAtalho("mes");
  } catch (err) {
    console.error(err);
  }
})();
