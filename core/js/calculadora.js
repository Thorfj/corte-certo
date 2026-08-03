const defaults = {
  monthlyPrice: 69.0,
  clients: 10,
  asaasCost: 2.0,
  taxRate: 6.0,
  vpnCost: 100.0,
  otherFixedCost: 0.0,
};

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
  coreFixedCosts: document.getElementById("coreFixedCosts"),
  partnerCommissionCost: document.getElementById("partnerCommissionCost"),
  otherFixedTotal: document.getElementById("otherFixedTotal"),
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
  const vpn = getNumber("vpnCost");
  const otherFixed = getNumber("otherFixedCost");

  const revenue = price * clients;
  const taxes = revenue * taxRate;
  const asaasTotal = asaasPerClient * clients;
  const fixedCosts = vpn + otherFixed;

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

  const totalCosts = taxes + asaasTotal + fixedCosts + partnerCommissionTotal;
  const netProfit = revenue - totalCosts;
  const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const profitPerClient = clients > 0 ? netProfit / clients : 0;
  const costPerClient = clients > 0 ? totalCosts / clients : fixedCosts;

  const contributionPerClient = price * (1 - taxRate) - asaasPerClient;
  const breakEvenClients =
    contributionPerClient > 0
      ? Math.ceil(fixedCosts / contributionPerClient)
      : null;

  output.revenue.textContent = currency.format(revenue);
  output.taxes.textContent = currency.format(taxes);
  output.asaasTotal.textContent = currency.format(asaasTotal);
  output.coreFixedCosts.textContent = currency.format(vpn);
  output.partnerCommissionCost.textContent = currency.format(
    partnerCommissionTotal,
  );
  output.otherFixedTotal.textContent = currency.format(otherFixed);
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
  partnerOutput.commissionSummary.textContent = `O parceiro receberá ${currency.format(commissionTotal)} no mês, equivalente a ${currency.format(partnershipCostPerClient)} por cliente.`;
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

calculatePartnerships();
calculate();
