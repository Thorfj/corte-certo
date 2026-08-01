if (typeof lucide !== "undefined") {
  lucide.createIcons();
} else {
  console.error("Lucide não carregou — verifique a conexão com unpkg.com");
}

let clientesCache = [];
let barbeariaIdCache = null;

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

async function obterBarbeariaId() {
  if (barbeariaIdCache) return barbeariaIdCache;
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  const { data, error } = await supabaseClient
    .from("profissionais")
    .select("barbearia_id")
    .eq("auth_user_id", user.id)
    .single();
  if (error) throw error;
  barbeariaIdCache = data.barbearia_id;
  return barbeariaIdCache;
}

function formatarDataSimples(dataISO) {
  if (!dataISO) return "—";
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

function statusLabel(status) {
  const mapa = {
    em_atendimento: "Em atendimento",
    agendado: "Agendado",
    "follow-up": "Follow-up",
    perdido: "Perdido",
  };
  return mapa[status] || status || "—";
}

async function carregarClientes() {
  const { data, error } = await supabaseClient
    .from("clientes")
    .select(
      "id, nome, telefone, status, atend_realizados, media_nps, data_ult_agend",
    )
    .order("nome", { ascending: true });

  if (error) {
    console.error(error);
    document.getElementById("tabela-clientes-body").innerHTML =
      '<tr><td colspan="6" class="empty">Erro ao carregar contatos.</td></tr>';
    return;
  }

  clientesCache = data || [];
  renderizarTabela(clientesCache);
}

function renderizarTabela(lista) {
  const body = document.getElementById("tabela-clientes-body");
  body.innerHTML = "";

  if (lista.length === 0) {
    body.innerHTML =
      '<tr><td colspan="6" class="empty">Nenhum contato encontrado.</td></tr>';
    return;
  }

  lista.forEach((cliente) => {
    const tr = document.createElement("tr");
    tr.className = "clickable";
    tr.addEventListener("click", () => abrirHistorico(cliente));
    tr.innerHTML = `
      <td>${cliente.nome || "—"}</td>
      <td>${cliente.telefone || "—"}</td>
      <td><span class="badge">${statusLabel(cliente.status)}</span></td>
      <td>${cliente.atend_realizados ?? 0}</td>
      <td>${cliente.media_nps ?? "—"}</td>
      <td>${formatarDataSimples(cliente.data_ult_agend)}</td>
    `;
    body.appendChild(tr);
  });
}

document.getElementById("busca-input").addEventListener("input", (e) => {
  const termo = e.target.value.trim().toLowerCase();
  const filtrado = clientesCache.filter(
    (c) =>
      (c.nome || "").toLowerCase().includes(termo) ||
      (c.telefone || "").toLowerCase().includes(termo),
  );
  renderizarTabela(filtrado);
});

async function abrirHistorico(cliente) {
  document.getElementById("hist-nome").textContent =
    `Histórico — ${cliente.nome || "Cliente"}`;
  document.getElementById("hist-lista").innerHTML =
    '<div class="loading">Carregando histórico...</div>';
  document.getElementById("modal-historico").classList.remove("hidden");

  const { data, error } = await supabaseClient
    .from("atendimentos")
    .select(
      `
      id, data_agend, horario, custo,
      profissionais ( nome ),
      atendimento_servicos ( servicos ( nome ) )
    `,
    )
    .eq("id_cliente", cliente.id)
    .order("data_agend", { ascending: false });

  if (error) {
    console.error(error);
    document.getElementById("hist-lista").innerHTML =
      '<div class="empty">Erro ao carregar histórico.</div>';
    return;
  }

  if (!data || data.length === 0) {
    document.getElementById("hist-lista").innerHTML =
      '<div class="empty">Nenhum atendimento registrado.</div>';
    return;
  }

  document.getElementById("hist-lista").innerHTML = data
    .map((atend) => {
      const servicos =
        (atend.atendimento_servicos || [])
          .map((s) => s.servicos?.nome)
          .filter(Boolean)
          .join(" + ") || "Sem serviço definido";
      const [ano, mes, dia] = atend.data_agend.split("-");
      const horario = atend.horario ? atend.horario.slice(0, 5) : "";
      return `
      <div class="historico-item">
        <p class="historico-data">${dia}/${mes}/${ano} às ${horario}</p>
        <p class="historico-detalhe">${servicos} · ${atend.profissionais?.nome || ""}</p>
        <p class="historico-detalhe">R$ ${Number(atend.custo || 0).toFixed(2)}</p>
      </div>
    `;
    })
    .join("");
}

document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.getElementById(btn.dataset.close).classList.add("hidden");
  });
});

document.querySelectorAll(".modal-overlay").forEach((overlay) => {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      overlay.classList.add("hidden");
    }
  });
});

document.getElementById("novo-contato-btn").addEventListener("click", () => {
  document.getElementById("form-novo-contato").reset();
  document.getElementById("nc-erro").style.display = "none";
  document.getElementById("modal-novo-contato").classList.remove("hidden");
});

document
  .getElementById("form-novo-contato")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const nome = document.getElementById("nc-nome").value.trim();
    const telefone = document.getElementById("nc-telefone").value.trim();
    const email = document.getElementById("nc-email").value.trim() || null;
    const erroEl = document.getElementById("nc-erro");
    const salvarBtn = document.getElementById("nc-salvar-btn");

    erroEl.style.display = "none";
    salvarBtn.disabled = true;
    salvarBtn.textContent = "Salvando...";

    try {
      const barbeariaId = await obterBarbeariaId();
      const { error } = await supabaseClient.from("clientes").insert({
        barbearia_id: barbeariaId,
        nome,
        telefone,
        email,
        status: "em_atendimento",
        data_primeiro_contato: new Date().toISOString().slice(0, 10),
      });

      if (error) {
        if (error.code === "23505") {
          erroEl.textContent = "Já existe um contato com esse telefone.";
        } else {
          erroEl.textContent = "Erro ao salvar contato.";
        }
        erroEl.style.display = "block";
        return;
      }

      document.getElementById("modal-novo-contato").classList.add("hidden");
      await carregarClientes();
    } catch (err) {
      console.error(err);
      erroEl.textContent = "Erro inesperado ao salvar contato.";
      erroEl.style.display = "block";
    } finally {
      salvarBtn.disabled = false;
      salvarBtn.textContent = "Salvar";
    }
  });

document.getElementById("logout-link").addEventListener("click", async (e) => {
  e.preventDefault();
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
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
      await carregarClientes();
    }
  } catch (err) {
    console.error(err);
    document.getElementById("tabela-clientes-body").innerHTML =
      `<tr><td colspan="6" class="empty">Erro: ${err.message}</td></tr>`;
  }
})();
