if (typeof lucide !== "undefined") {
  lucide.createIcons();
} else {
  console.error("Lucide não carregou — verifique a conexão com unpkg.com");
}

let servicosCache = [];
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

async function obterProximoSku(barbeariaId) {
  const { data, error } = await supabaseClient
    .from("servicos")
    .select("sku")
    .eq("barbearia_id", barbeariaId)
    .order("sku", { ascending: false })
    .limit(1);

  if (error) throw error;

  const ultimoSku = data && data.length ? parseInt(data[0].sku, 10) : 0;
  const proximo = (isNaN(ultimoSku) ? 0 : ultimoSku) + 1;
  return String(proximo).padStart(3, "0");
}

async function carregarServicos() {
  const { data, error } = await supabaseClient
    .from("servicos")
    .select("id, sku, nome, preco, duracao_min, recorrencia")
    .order("nome", { ascending: true });

  const body = document.getElementById("tabela-servicos-body");

  if (error) {
    console.error(error);
    body.innerHTML =
      '<tr><td colspan="6" class="empty">Erro ao carregar serviços.</td></tr>';
    return;
  }

  servicosCache = data || [];
  renderizarTabela(servicosCache);
}

function renderizarTabela(lista) {
  const body = document.getElementById("tabela-servicos-body");
  body.innerHTML = "";

  if (lista.length === 0) {
    body.innerHTML =
      '<tr><td colspan="6" class="empty">Nenhum serviço cadastrado.</td></tr>';
    return;
  }

  lista.forEach((servico) => {
    const tr = document.createElement("tr");
    tr.className = "clickable";
    tr.addEventListener("click", () => abrirModalEdicao(servico));
    tr.innerHTML = `
      <td>${servico.sku}</td>
      <td>${servico.nome}</td>
      <td>R$ ${Number(servico.preco).toFixed(2)}</td>
      <td>${servico.duracao_min} min</td>
      <td>${servico.recorrencia} dias</td>
      <td class="col-acoes">
        <button class="icon-btn" data-excluir="${servico.id}" title="Excluir">
          <i data-lucide="trash-2" style="width:16px;height:16px"></i>
        </button>
      </td>
    `;
    body.appendChild(tr);
  });

  if (typeof lucide !== "undefined") lucide.createIcons();

  body.querySelectorAll("[data-excluir]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      excluirServico(btn.dataset.excluir);
    });
  });
}

function abrirModalNovo() {
  document.getElementById("form-servico").reset();
  document.getElementById("sv-id").value = "";
  document.getElementById("sv-sku-display").style.display = "none";
  document.getElementById("modal-servico-titulo").textContent = "Novo Serviço";
  document.getElementById("sv-erro").style.display = "none";
  document.getElementById("modal-servico").classList.remove("hidden");
}

function abrirModalEdicao(servico) {
  document.getElementById("sv-id").value = servico.id;
  document.getElementById("sv-sku-display").textContent = `SKU: ${servico.sku}`;
  document.getElementById("sv-sku-display").style.display = "block";
  document.getElementById("sv-nome").value = servico.nome;
  document.getElementById("sv-preco").value = servico.preco;
  document.getElementById("sv-duracao").value = servico.duracao_min;
  document.getElementById("sv-recorrencia").value = servico.recorrencia;
  document.getElementById("modal-servico-titulo").textContent =
    "Editar Serviço";
  document.getElementById("sv-erro").style.display = "none";
  document.getElementById("modal-servico").classList.remove("hidden");
}

async function excluirServico(id) {
  if (!confirm("Tem certeza que deseja excluir este serviço?")) return;

  const { error } = await supabaseClient.from("servicos").delete().eq("id", id);

  if (error) {
    if (error.code === "23503") {
      alert(
        "Não é possível excluir: este serviço já foi usado em atendimentos anteriores.",
      );
    } else {
      alert("Erro ao excluir serviço.");
    }
    return;
  }

  await carregarServicos();
}

document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.getElementById(btn.dataset.close).classList.add("hidden");
  });
});

document
  .getElementById("novo-servico-btn")
  .addEventListener("click", abrirModalNovo);

document
  .getElementById("form-servico")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = document.getElementById("sv-id").value;
    const nome = document.getElementById("sv-nome").value.trim();
    const preco = parseFloat(document.getElementById("sv-preco").value);
    const duracao_min = parseInt(
      document.getElementById("sv-duracao").value,
      10,
    );
    const recorrencia = parseInt(
      document.getElementById("sv-recorrencia").value,
      10,
    );
    const erroEl = document.getElementById("sv-erro");
    const salvarBtn = document.getElementById("sv-salvar-btn");

    erroEl.style.display = "none";
    salvarBtn.disabled = true;
    salvarBtn.textContent = "Salvando...";

    try {
      const barbeariaId = await obterBarbeariaId();

      if (id) {
        const { error } = await supabaseClient
          .from("servicos")
          .update({ nome, preco, duracao_min, recorrencia })
          .eq("id", id);
        if (error) throw error;
      } else {
        const sku = await obterProximoSku(barbeariaId);
        const { error } = await supabaseClient.from("servicos").insert({
          barbearia_id: barbeariaId,
          sku,
          nome,
          preco,
          duracao_min,
          recorrencia,
        });
        if (error) throw error;
      }

      document.getElementById("modal-servico").classList.add("hidden");
      await carregarServicos();
    } catch (err) {
      console.error(err);
      erroEl.textContent =
        err.code === "23505"
          ? "Já existe um serviço com esse SKU."
          : "Erro ao salvar serviço.";
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
      throw new Error("Cliente Supabase não inicializado.");
    }
    const session = await checarSessao();
    if (session) {
      await aplicarTemaUsuario();
      await carregarNomeBarbearia();
      await carregarServicos();
    }
  } catch (err) {
    console.error(err);
    document.getElementById("tabela-servicos-body").innerHTML =
      `<tr><td colspan="6" class="empty">Erro: ${err.message}</td></tr>`;
  }
})();
