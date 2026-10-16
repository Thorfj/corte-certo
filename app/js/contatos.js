if (typeof lucide !== "undefined") {
  lucide.createIcons();
}

let clientesCache = [];

const STATUS_LABELS = {
  falar_com_humano: "Falar com humano",
  em_atendimento: "Em atendimento",
  agendado: "Agendado",
  "follow-up": "Follow-up",
  perdido: "Perdido",
};

function escaparHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatarData(valor) {
  if (!valor) return "—";
  const data = String(valor).slice(0, 10).split("-");
  return data.length === 3 ? `${data[2]}/${data[1]}/${data[0]}` : valor;
}

function formatarNps(valor) {
  return valor === null || valor === undefined || valor === ""
    ? "—"
    : Number(valor).toFixed(1);
}

function renderizarClientes(lista) {
  const tbody = document.getElementById("tabela-clientes-body");

  if (!lista.length) {
    tbody.innerHTML =
      '<tr><td colspan="6" class="empty">Nenhum contato encontrado.</td></tr>';
    return;
  }

  tbody.innerHTML = lista
    .map(
      (cliente) => `
        <tr class="cliente-row" data-id="${escaparHtml(cliente.id)}" tabindex="0">
          <td>${escaparHtml(cliente.nome)}</td>
          <td>${escaparHtml(cliente.telefone)}</td>
          <td>${escaparHtml(STATUS_LABELS[cliente.status] || cliente.status || "—")}</td>
          <td>${Number(cliente.atend_realizados) || 0}</td>
          <td>${formatarNps(cliente.media_nps)}</td>
          <td>${formatarData(cliente.data_ult_agend)}</td>
        </tr>
      `,
    )
    .join("");

  tbody.querySelectorAll(".cliente-row").forEach((linha) => {
    const abrir = () => abrirHistorico(linha.dataset.id);
    linha.addEventListener("click", abrir);
    linha.addEventListener("keydown", (evento) => {
      if (evento.key === "Enter" || evento.key === " ") {
        evento.preventDefault();
        abrir();
      }
    });
  });
}

async function carregarClientes() {
  const tbody = document.getElementById("tabela-clientes-body");

  try {
    const barbeariaId = await obterBarbeariaId();
    const { data, error } = await supabaseClient
      .from("clientes")
      .select(
        "id, barbearia_id, telefone, email, nome, atend_autom, data_primeiro_contato, data_primeiro_agend, data_ult_agend, status, atend_realizados, media_nps, criado_em",
      )
      .eq("barbearia_id", barbeariaId)
      .order("nome", { ascending: true });

    if (error) throw error;
    clientesCache = data || [];
    renderizarClientes(clientesCache);
  } catch (erro) {
    console.error("Erro ao carregar contatos:", erro);
    tbody.innerHTML = `<tr><td colspan="6" class="empty">Erro ao carregar contatos: ${escaparHtml(erro.message)}</td></tr>`;
  }
}

function abrirModal(id) {
  document.getElementById(id)?.classList.remove("hidden");
}

function fecharModal(id) {
  document.getElementById(id)?.classList.add("hidden");
}

async function abrirHistorico(clienteId) {
  const cliente = clientesCache.find(
    (item) => String(item.id) === String(clienteId),
  );
  document.getElementById("hist-nome").textContent =
    `Histórico — ${cliente?.nome || "Cliente"}`;
  const lista = document.getElementById("hist-lista");
  lista.innerHTML = '<div class="loading">Carregando histórico...</div>';
  abrirModal("modal-historico");

  const { data, error } = await supabaseClient
    .from("atendimentos")
    .select(
      "id, data_agend, horario, custo, nps, profissionais(nome), atendimento_servicos(servicos(nome))",
    )
    .eq("id_cliente", clienteId)
    .order("data_agend", { ascending: false });

  if (error) {
    console.error("Erro ao carregar histórico:", error);
    lista.innerHTML = `<p class="empty">Erro ao carregar histórico: ${escaparHtml(error.message)}</p>`;
    return;
  }

  if (!data?.length) {
    lista.innerHTML =
      '<p class="empty">Este contato ainda não possui atendimentos.</p>';
    return;
  }

  lista.innerHTML = data
    .map((atendimento) => {
      const servicos = (atendimento.atendimento_servicos || [])
        .map((item) => item.servicos?.nome)
        .filter(Boolean)
        .join(" + ");
      const hora = atendimento.horario
        ? String(atendimento.horario).slice(0, 5)
        : "";
      return `
        <div class="card" style="margin-bottom:10px">
          <p><strong>${formatarData(atendimento.data_agend)}${hora ? ` às ${escaparHtml(hora)}` : ""}</strong></p>
          <p>${escaparHtml(servicos || "Sem serviço informado")}</p>
          <p>${escaparHtml(atendimento.profissionais?.nome || "Profissional não informado")}</p>
          <p>NPS: ${formatarNps(atendimento.nps)}</p>
        </div>
      `;
    })
    .join("");
}

document.getElementById("busca-input").addEventListener("input", (evento) => {
  const termo = evento.target.value.trim().toLocaleLowerCase("pt-BR");
  const somenteDigitos = termo.replace(/\D/g, "");
  const filtrados = clientesCache.filter((cliente) => {
    const nome = String(cliente.nome || "").toLocaleLowerCase("pt-BR");
    const telefone = String(cliente.telefone || "");
    return (
      nome.includes(termo) ||
      telefone.toLocaleLowerCase("pt-BR").includes(termo) ||
      (somenteDigitos && telefone.replace(/\D/g, "").includes(somenteDigitos))
    );
  });
  renderizarClientes(filtrados);
});

document.getElementById("novo-contato-btn").addEventListener("click", () => {
  document.getElementById("form-novo-contato").reset();
  document.getElementById("nc-erro").textContent = "";
  abrirModal("modal-novo-contato");
});

document.querySelectorAll("[data-close]").forEach((botao) => {
  botao.addEventListener("click", () => fecharModal(botao.dataset.close));
});

document.querySelectorAll(".modal-overlay").forEach((modal) => {
  modal.addEventListener("click", (evento) => {
    if (evento.target === modal) fecharModal(modal.id);
  });
});

document
  .getElementById("form-novo-contato")
  .addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const erroEl = document.getElementById("nc-erro");
    const salvarBtn = document.getElementById("nc-salvar-btn");
    const nome = document.getElementById("nc-nome").value.trim();
    const telefone = document.getElementById("nc-telefone").value.trim();
    const email = document.getElementById("nc-email").value.trim() || null;

    erroEl.textContent = "";
    salvarBtn.disabled = true;
    salvarBtn.textContent = "Salvando...";

    try {
      const barbeariaId = await obterBarbeariaId();
      const { data: existente, error: erroBusca } = await supabaseClient
        .from("clientes")
        .select("id")
        .eq("barbearia_id", barbeariaId)
        .eq("telefone", telefone)
        .maybeSingle();

      if (erroBusca) throw erroBusca;
      if (existente) throw new Error("Já existe um contato com este telefone.");

      const hoje = new Date().toISOString().slice(0, 10);
      const { error } = await supabaseClient.from("clientes").insert({
        barbearia_id: barbeariaId,
        nome,
        telefone,
        email,
        status: "em_atendimento",
        data_primeiro_contato: hoje,
      });

      if (error) throw error;
      fecharModal("modal-novo-contato");
      await carregarClientes();
    } catch (erro) {
      console.error("Erro ao criar contato:", erro);
      erroEl.textContent = erro.message || "Erro ao salvar contato.";
    } finally {
      salvarBtn.disabled = false;
      salvarBtn.textContent = "Salvar";
    }
  });

(async () => {
  try {
    if (typeof supabaseClient === "undefined") {
      throw new Error("Cliente Supabase não inicializado.");
    }
    const session = await checarSessao();
    if (!session) return;
    await aplicarTemaUsuario();
    await carregarNomeBarbearia();
    await carregarClientes();
  } catch (erro) {
    console.error("Erro ao iniciar contatos:", erro);
    document.getElementById("tabela-clientes-body").innerHTML =
      `<tr><td colspan="6" class="empty">Erro: ${escaparHtml(erro.message)}</td></tr>`;
  }
})();
