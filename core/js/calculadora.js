const defaults = {
  monthlyPrice: 69.0,
  clients: 10,
  asaasCost: 2.0,
  taxRate: 6.0,
};

// Custos da operação direta: cada item é por mês, por ano (vira 1/12 por mês)
// ou por cliente. A lista fica salva neste navegador para não precisar digitar de novo.
const defaultCosts = [
  { name: "Supabase", value: 120.0, type: "fixo" },
  { name: "n8n", value: 320.0, type: "fixo" },
  { name: "Evolution API", value: 400.0, type: "ano" },
  { name: "Domínio", value: 180.0, type: "ano" },
  { name: "WhatsApp", value: 30.0, type: "fixo" },
  { name: "Claude", value: 120.0, type: "fixo" },
];
const COSTS_KEY = "barbozap-calculadora-custos-v2";
const costList = document.getElementById("costList");
const costBreakdown = document.getElementById("costBreakdown");

function loadCosts() {
  try {
    const saved = JSON.parse(localStorage.getItem(COSTS_KEY));
    if (Array.isArray(saved)) return saved;
  } catch (err) {
    // sem armazenamento disponível: usa o exemplo
  }
  return defaultCosts.map((cost) => ({ ...cost }));
}

function saveCosts() {
  try {
    localStorage.setItem(COSTS_KEY, JSON.stringify(readCosts()));
  } catch (err) {
    // navegador sem armazenamento: a lista vale só nesta visita
  }
}

// quanto o custo pesa no mês
function monthlyAmount(cost, clients) {
  if (cost.type === "ano") return cost.value / 12;
  if (cost.type === "cliente") return cost.value * clients;
  return cost.value;
}

function costDetail(cost) {
  const per = { fixo: "/mês", ano: "/ano", cliente: " por cliente" }[cost.type] || "";
  return `${currency.format(cost.value)}${per}`;
}

function addCostRow(cost = { name: "", value: 0, type: "fixo" }) {
  const row = document.createElement("div");
  row.className = "cost-row";
  row.innerHTML = `
    <input class="cost-name" type="text" placeholder="Nome do custo" aria-label="Nome do custo">
    <div class="input-wrap">
      <span class="input-prefix">R$</span>
      <input class="cost-value" type="number" inputmode="decimal" min="0" step="0.01" aria-label="Valor do custo">
    </div>
    <select class="cost-type" aria-label="Frequência do custo">
      <option value="fixo">por mês</option>
      <option value="ano">por ano</option>
      <option value="cliente">por cliente</option>
    </select>
    <button class="cost-remove" type="button" aria-label="Remover custo" title="Remover custo">&times;</button>
  `;
  row.querySelector(".cost-name").value = cost.name || "";
  row.querySelector(".cost-value").value = Number(cost.value || 0).toFixed(2);
  row.querySelector(".cost-type").value = ["fixo", "ano", "cliente"].includes(cost.type) ? cost.type : "fixo";
  row.querySelectorAll("input, select").forEach((el) =>
    el.addEventListener("input", () => {
      saveCosts();
      calculate();
    }),
  );
  row.querySelector(".cost-remove").addEventListener("click", () => {
    row.remove();
    saveCosts();
    calculate();
  });
  costList.appendChild(row);
  return row;
}

function readCosts() {
  return [...costList.querySelectorAll(".cost-row")].map((row) => {
    const value = Number.parseFloat(row.querySelector(".cost-value").value);
    return {
      name: row.querySelector(".cost-name").value.trim(),
      value: Number.isFinite(value) && value >= 0 ? value : 0,
      type: row.querySelector(".cost-type").value,
    };
  });
}

function renderCosts(costs) {
  costList.innerHTML = "";
  costs.forEach((cost) => addCostRow(cost));
}

document.getElementById("addCost").addEventListener("click", () => {
  addCostRow().querySelector(".cost-name").focus();
  saveCosts();
  calculate();
});

const ids = Object.keys(defaults);
const inputs = Object.fromEntries(
  ids.map((id) => [id, document.getElementById(id)]),
);

const output = {
  netProfit: document.getElementById("netProfit"),
  revenue: document.getElementById("revenue"),
  profitPerClient: document.getElementById("profitPerClient"),
  costPerClient: document.getElementById("costPerClient"),
  breakEven: document.getElementById("breakEven"),
  taxes: document.getElementById("taxes"),
  asaasTotal: document.getElementById("asaasTotal"),
  partnerCommissionCost: document.getElementById("partnerCommissionCost"),
  totalCosts: document.getElementById("totalCosts"),
  marginPill: document.getElementById("marginPill"),
  statusPill: document.getElementById("statusPill"),
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const percent = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function getNumber(id) {
  const value = Number.parseFloat(inputs[id].value);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function calculate() {
  const price = getNumber("monthlyPrice");
  const clients = Math.floor(getNumber("clients"));
  const asaasPerClient = getNumber("asaasCost");
  const taxRate = Math.min(getNumber("taxRate"), 100) / 100;
  const costs = readCosts();
  const fixedCosts = costs
    .filter((cost) => cost.type !== "cliente")
    .reduce((total, cost) => total + monthlyAmount(cost, clients), 0);
  const otherPerClient = costs
    .filter((cost) => cost.type === "cliente")
    .reduce((total, cost) => total + monthlyAmount(cost, 1), 0);

  const revenue = price * clients;
  const taxes = revenue * taxRate;
  const asaasTotal = asaasPerClient * clients;
  const listedCosts = fixedCosts + otherPerClient * clients;

  const channelClients = Math.min(
    clients,
    Math.floor(
      Number.parseFloat(document.getElementById("partnerClients")?.value) || 0,
    ),
  );
  const commissionRate =
    Math.min(
      Number.parseFloat(document.getElementById("commissionRate")?.value) || 0,
      100,
    ) / 100;
  const fixedCommission =
    Number.parseFloat(document.getElementById("fixedCommission")?.value) || 0;
  const acquisitionBonus =
    Number.parseFloat(document.getElementById("acquisitionBonus")?.value) || 0;
  const partnerRevenue = price * channelClients;
  const partnerCommissionTotal =
    partnerRevenue * commissionRate +
    (fixedCommission + acquisitionBonus) * channelClients;

  const totalCosts = taxes + asaasTotal + listedCosts + partnerCommissionTotal;
  const netProfit = revenue - totalCosts;
  const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const profitPerClient = clients > 0 ? netProfit / clients : 0;
  const costPerClient = clients > 0 ? totalCosts / clients : fixedCosts;

  const contributionPerClient = price * (1 - taxRate) - asaasPerClient - otherPerClient;
  const breakEvenClients =
    contributionPerClient > 0
      ? Math.ceil(fixedCosts / contributionPerClient)
      : null;

  output.revenue.textContent = currency.format(revenue);
  output.taxes.textContent = currency.format(taxes);
  output.asaasTotal.textContent = currency.format(asaasTotal);
  costBreakdown.innerHTML = "";
  costs.forEach((cost) => {
    const line = document.createElement("div");
    line.className = "breakdown-row";
    const label = document.createElement("span");
    label.textContent = `${cost.name || "Custo sem nome"} (${costDetail(cost)})`;
    const amount = document.createElement("strong");
    amount.textContent = currency.format(monthlyAmount(cost, clients));
    line.append(label, amount);
    costBreakdown.appendChild(line);
  });
  output.partnerCommissionCost.textContent = currency.format(
    partnerCommissionTotal,
  );
  output.totalCosts.textContent = currency.format(totalCosts);
  output.netProfit.textContent = currency.format(netProfit);
  output.profitPerClient.textContent = currency.format(profitPerClient);
  output.costPerClient.textContent = currency.format(costPerClient);
  output.marginPill.textContent = `Margem: ${percent.format(margin)}%`;
  output.breakEven.textContent =
    breakEvenClients === null
      ? "Não atingível"
      : `${breakEvenClients} ${breakEvenClients === 1 ? "cliente" : "clientes"}`;

  output.netProfit.classList.toggle("positive", netProfit >= 0);
  output.netProfit.classList.toggle("negative", netProfit < 0);
  output.statusPill.textContent =
    netProfit >= 0 ? "Operação positiva" : "Operação no prejuízo";
}

ids.forEach((id) => inputs[id].addEventListener("input", calculate));

document.getElementById("resetButton").addEventListener("click", () => {
  ids.forEach((id) => {
    inputs[id].value = defaults[id];
  });
  renderCosts(defaultCosts);
  saveCosts();
  calculate();
  if (typeof calculatePartnerships === "function") calculatePartnerships();
});

const partnerDefaults = {
  partnerClients: 10,
  commissionRate: 20.0,
  fixedCommission: 0.0,
  acquisitionBonus: 0.0,
};
const partnerInputs = Object.fromEntries(
  Object.keys(partnerDefaults).map((id) => [id, document.getElementById(id)]),
);
const partnerOutputIds = [
  "partnerNetProfit",
  "partnerRevenue",
  "partnerCommissionTotal",
  "partnerProfitPerClient",
  "partnerCostPerClient",
  "partnerPercentageCommission",
  "partnerFixedCommissionTotal",
  "partnerBonusTotal",
  "partnerTaxes",
  "partnerAsaasTotal",
  "partnerTotalCosts",
  "partnerMarginPill",
  "partnerStatusPill",
  "commissionSummary",
];
const partnerOutput = Object.fromEntries(
  partnerOutputIds.map((id) => [id, document.getElementById(id)]),
);

function partnerNumber(id) {
  const value = Number.parseFloat(partnerInputs[id].value);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function calculatePartnerships() {
  const price = getNumber("monthlyPrice");
  const clients = Math.floor(partnerNumber("partnerClients"));
  const rate = Math.min(partnerNumber("commissionRate"), 100) / 100;
  const fixedCommission = partnerNumber("fixedCommission");
  const bonus = partnerNumber("acquisitionBonus");
  const taxRate = Math.min(getNumber("taxRate"), 100) / 100;
  const asaas = getNumber("asaasCost");

  const revenue = price * clients;
  const percentageCommission = revenue * rate;
  const fixedCommissionTotal = fixedCommission * clients;
  const bonusTotal = bonus * clients;
  const commissionTotal =
    percentageCommission + fixedCommissionTotal + bonusTotal;
  const taxes = revenue * taxRate;
  const asaasTotal = asaas * clients;
  const totalCosts = commissionTotal + taxes + asaasTotal;
  const profit = revenue - totalCosts;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  const profitPerClient = clients > 0 ? profit / clients : 0;
  const partnershipCostPerClient = clients > 0 ? commissionTotal / clients : 0;

  partnerOutput.partnerRevenue.textContent = currency.format(revenue);
  partnerOutput.partnerPercentageCommission.textContent =
    currency.format(percentageCommission);
  partnerOutput.partnerFixedCommissionTotal.textContent =
    currency.format(fixedCommissionTotal);
  partnerOutput.partnerBonusTotal.textContent = currency.format(bonusTotal);
  partnerOutput.partnerCommissionTotal.textContent =
    currency.format(commissionTotal);
  partnerOutput.partnerTaxes.textContent = currency.format(taxes);
  partnerOutput.partnerAsaasTotal.textContent = currency.format(asaasTotal);
  partnerOutput.partnerTotalCosts.textContent = currency.format(totalCosts);
  partnerOutput.partnerNetProfit.textContent = currency.format(profit);
  partnerOutput.partnerProfitPerClient.textContent =
    currency.format(profitPerClient);
  partnerOutput.partnerCostPerClient.textContent = currency.format(
    partnershipCostPerClient,
  );
  partnerOutput.partnerMarginPill.textContent = `Margem: ${percent.format(margin)}%`;
  partnerOutput.partnerStatusPill.textContent =
    profit >= 0 ? "Canal positivo" : "Canal no prejuízo";
  if (partnerOutput.commissionSummary) {
    partnerOutput.commissionSummary.textContent = `O parceiro receberá ${currency.format(commissionTotal)} no mês, equivalente a ${currency.format(partnershipCostPerClient)} por cliente.`;
  }
  partnerOutput.partnerNetProfit.classList.toggle("positive", profit >= 0);
  partnerOutput.partnerNetProfit.classList.toggle("negative", profit < 0);

  const directCommissionRate = document.getElementById("directCommissionRate");
  if (directCommissionRate)
    directCommissionRate.value = percent.format(rate * 100).replace(",", ".");
}

Object.keys(partnerDefaults).forEach((id) =>
  partnerInputs[id].addEventListener("input", () => {
    calculatePartnerships();
    calculate();
  }),
);
document.getElementById("resetPartnerButton").addEventListener("click", () => {
  Object.keys(partnerDefaults).forEach((id) => {
    partnerInputs[id].value = partnerDefaults[id];
  });
  calculatePartnerships();
  calculate();
});

["monthlyPrice", "taxRate", "asaasCost"].forEach((id) => {
  inputs[id].addEventListener("input", calculatePartnerships);
});

document.querySelectorAll(".tab-button").forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.tab;
    document.querySelectorAll(".tab-button").forEach((item) => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-selected", String(active));
    });
    document
      .querySelectorAll(".tab-panel")
      .forEach((panel) =>
        panel.classList.toggle("active", panel.dataset.panel === target),
      );
  });
});

renderCosts(loadCosts());
calculatePartnerships();
calculate();
