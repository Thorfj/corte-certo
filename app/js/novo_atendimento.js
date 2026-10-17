if (typeof lucide !== "undefined") {
  lucide.createIcons();
} else {
  console.error("Lucide não carregou — verifique a conexão com unpkg.com");
}

const params = new URLSearchParams(window.location.search);
const idAtend = params.get("id");
const modoEdicao = !!idAtend;

let servicosCache = [];
let clienteEncontradoId = null;
let pagamentoAnterior = null;
let pagoEmAnterior = null;

// "Forma de pagamento" só faz sentido quando está pago
function atualizarCampoForma() {
  const pago = document.getElementById("pagamento-select").value === "pago";
  document.getElementById("forma-field").style.display = pago ? "" : "none";
}
document.getElementById("pagamento-select").addEventListener("change", atualizarCampoForma);

function dadosPagamento() {
  const pago = document.getElementById("pagamento-select").value === "pago";
  return {
    pagamento: pago ? "pago" : "pendente",
    forma_pagamento: pago ? document.getElementById("forma-select").value || null : null,
    // mantém a data original se já estava pago
    pago_em: pago ? (pagamentoAnterior === "pago" && pagoEmAnterior ? pagoEmAnterior : new Date().toISOString()) : null,
  };
}
let idClienteAtual = null;

// idProfAtual: na edição, mantém na lista o profissional do atendimento
// mesmo que ele já tenha sido excluído (pra não trocar sem querer)
async function carregarProfissionais(idProfAtual = null) {
  const barbeariaId = await obterBarbeariaId();
  const { data: todos, error } = await supabaseClient
    .from("profissionais")
    .select("id, nome, removido_em")
    .eq("barbearia_id", barbeariaId)
    .order("nome", { ascending: true });
  const data = (todos || []).filter(
    (p) => !p.removido_em || String(p.id) === String(idProfAtual),
  );

  const select = document.getElementById("prof-select");
  if (error || !data) {
    select.innerHTML = '<option value="">Erro ao carregar</option>';
    return;
  }
  // papel "usuario" só agenda pra si mesmo (o banco também barra os outros)
  const meuProf = await obterMeuProfissional();
  const lista =
    meuProf.acesso === "usuario" ? data.filter((p) => p.id === meuProf.id) : data;
  select.innerHTML = lista
    .map((p) => `<option value="${p.id}">${p.nome}</option>`)
    .join("");
  select.disabled = meuProf.acesso === "usuario";
}

async function carregarServicos(selecionados = []) {
  const barbeariaId = await obterBarbeariaId();
  const { data, error } = await supabaseClient
    .from("servicos")
    .select("id, nome, preco, duracao_min")
    .eq("barbearia_id", barbeariaId)
    .order("nome", { ascending: true });

  const lista = document.getElementById("servicos-lista");
  if (error || !data) {
    lista.innerHTML = '<p class="empty">Erro ao carregar serviços.</p>';
    return;
  }

  servicosCache = data;
  lista.innerHTML = data
    .map(
      (s) => `
    <div class="servico-item">
      <input type="checkbox" data-id="${s.id}" data-preco="${s.preco}" data-duracao="${s.duracao_min}"
        id="servico-${s.id}" ${selecionados.includes(s.id) ? "checked" : ""}>
      <label for="servico-${s.id}">${s.nome}</label>
      <span class="servico-preco">R$ ${Number(s.preco).toFixed(2)} · ${s.duracao_min}min</span>
    </div>
  `,
    )
    .join("");

  lista.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener("change", atualizarResumo);
  });
  atualizarResumo();
}

function atualizarResumo() {
  const marcados = document.querySelectorAll(
    '#servicos-lista input[type="checkbox"]:checked',
  );
  let total = 0,
    duracao = 0;
  marcados.forEach((cb) => {
    total += Number(cb.dataset.preco);
    duracao += Number(cb.dataset.duracao);
  });
  document.getElementById("resumo-total").textContent = marcados.length
    ? `Total estimado: R$ ${total.toFixed(2)} · ${duracao} min`
    : "";
}

// Mesma regra do banco (normalizar_telefone): só dígitos e, se for número
// brasileiro sem DDI (10 ou 11 dígitos), ganha o 55 na frente
function normalizarTelefone(valor) {
  const digitos = String(valor || "").replace(/\D/g, "");
  if (!digitos) return "";
  return digitos.length === 10 || digitos.length === 11 ? "55" + digitos : digitos;
}

// Procura o cliente pelo telefone; se não existir, mostra o campo de nome.
// Devolve true quando encontra.
async function buscarCliente() {
  const telefone = normalizarTelefone(
    document.getElementById("telefone-input").value,
  );
  const statusEl = document.getElementById("cliente-status");
  const nomeField = document.getElementById("nome-novo-cliente-field");

  clienteEncontradoId = null;
  if (!telefone) {
    statusEl.textContent = "";
    nomeField.style.display = "none";
    return false;
  }

  const barbeariaId = await obterBarbeariaId();
  const { data, error } = await supabaseClient
    .from("clientes")
    .select("id, nome")
    .eq("barbearia_id", barbeariaId)
    .eq("telefone", telefone)
    .maybeSingle();

  if (error) {
    statusEl.textContent = "Erro ao buscar cliente.";
    statusEl.className = "cliente-status";
    return false;
  }

  if (data) {
    clienteEncontradoId = data.id;
    statusEl.textContent = `Cliente encontrado: ${data.nome || "(sem nome)"}`;
    statusEl.className = "cliente-status encontrado";
    nomeField.style.display = "none";
    return true;
  }

  statusEl.textContent =
    "Cliente novo: preencha o nome abaixo para cadastrar.";
  statusEl.className = "cliente-status novo";
  nomeField.style.display = "block";
  return false;
}

document
  .getElementById("buscar-cliente-btn")
  .addEventListener("click", buscarCliente);

// Busca sozinho ao sair do campo de telefone (não precisa clicar em Buscar)
document
  .getElementById("telefone-input")
  .addEventListener("change", buscarCliente);

document
  .getElementById("form-atendimento")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const erroEl = document.getElementById("form-erro");
    const salvarBtn = document.getElementById("salvar-btn");
    erroEl.style.display = "none";

    const idProf = document.getElementById("prof-select").value;
    const dataAgend = document.getElementById("data-input").value;
    const horario = document.getElementById("horario-input").value;
    const nps = document.getElementById("nps-input").value || null;
    const servicosSelecionados = Array.from(
      document.querySelectorAll(
        '#servicos-lista input[type="checkbox"]:checked',
      ),
    ).map((cb) => cb.dataset.id);

    if (!idProf || !dataAgend || !horario) {
      erroEl.textContent = "Preencha profissional, data e horário.";
      erroEl.style.display = "block";
      return;
    }
    if (servicosSelecionados.length === 0) {
      erroEl.textContent = "Selecione ao menos um serviço.";
      erroEl.style.display = "block";
      return;
    }

    salvarBtn.disabled = true;
    salvarBtn.textContent = "Salvando...";

    try {
      const barbeariaId = await obterBarbeariaId();
      let idCliente = clienteEncontradoId;

      if (!modoEdicao && !idCliente) {
        const telefone = normalizarTelefone(
          document.getElementById("telefone-input").value,
        );
        if (!telefone) {
          throw new Error("Informe o telefone do cliente.");
        }
        // garante a busca mesmo se a pessoa não saiu do campo de telefone
        if (await buscarCliente()) {
          idCliente = clienteEncontradoId;
        }
      }

      if (!modoEdicao && !idCliente) {
        const telefone = normalizarTelefone(
          document.getElementById("telefone-input").value,
        );
        const nome = document.getElementById("nome-novo-cliente").value.trim();
        if (!nome) {
          document.getElementById("nome-novo-cliente").focus();
          throw new Error("Cliente novo: preencha o nome do cliente.");
        }
        const { data: novoCliente, error: erroCliente } = await supabaseClient
          .from("clientes")
          .insert({
            barbearia_id: barbeariaId,
            telefone,
            nome,
            status: "agendado",
            data_primeiro_contato: new Date().toISOString().slice(0, 10),
            data_primeiro_agend: dataAgend,
          })
          .select("id")
          .single();
        if (erroCliente) throw erroCliente;
        idCliente = novoCliente.id;
      }

      let idAtendFinal = idAtend;

      if (modoEdicao) {
        const { error: erroUpdate } = await supabaseClient
          .from("atendimentos")
          .update({ id_prof: idProf, data_agend: dataAgend, horario, nps, ...dadosPagamento() })
          .eq("id", idAtend);
        if (erroUpdate) throw erroUpdate;

        await supabaseClient
          .from("atendimento_servicos")
          .delete()
          .eq("id_atend", idAtend);
      } else {
        const { data: novoAtend, error: erroAtend } = await supabaseClient
          .from("atendimentos")
          .insert({
            barbearia_id: barbeariaId,
            id_cliente: idCliente,
            id_prof: idProf,
            data_agend: dataAgend,
            horario,
            nps,
            ...dadosPagamento(),
          })
          .select("id")
          .single();
        if (erroAtend) throw erroAtend;
        idAtendFinal = novoAtend.id;
      }

      const linhasServicos = servicosSelecionados.map((servicoId) => {
        const servico = servicosCache.find(
          (s) => String(s.id) === String(servicoId),
        );
        return {
          id_atend: idAtendFinal,
          servico_id: servico.id,
          preco_cobrado: servico.preco,
          duracao_cobrada: servico.duracao_min,
        };
      });

      const { error: erroServicos } = await supabaseClient
        .from("atendimento_servicos")
        .insert(linhasServicos);
      if (erroServicos) throw erroServicos;

      // Atendimento no futuro deixa o cliente "agendado"; lançado com data e
      // horário que já passaram, o cliente vai direto para o follow-up
      const { error: erroStatus } = await supabaseClient.rpc(
        "recalcular_status_cliente",
        { p_cliente: modoEdicao ? idClienteAtual : idCliente },
      );
      if (erroStatus) console.error("Erro ao atualizar status do cliente:", erroStatus);

      window.location.href = "/app/atendimentos/";
    } catch (err) {
      console.error(err);
      erroEl.textContent = err.message || "Erro ao salvar atendimento.";
      erroEl.style.display = "block";
      salvarBtn.disabled = false;
      salvarBtn.textContent = "Salvar atendimento";
    }
  });

document
  .getElementById("nao-compareceu-btn")
  .addEventListener("click", async () => {
    if (
      !confirm(
        'Marcar que o cliente não compareceu? Ele voltará para "Em atendimento" e receberá uma mensagem para remarcar.',
      )
    )
      return;

    try {
      const { error: erroAtend } = await supabaseClient
        .from("atendimentos")
        .update({ compareceu: false })
        .eq("id", idAtend);
      if (erroAtend) throw erroAtend;

      if (idClienteAtual) {
        const { error: erroCliente } = await supabaseClient
          .from("clientes")
          .update({ status: "em_atendimento" })
          .eq("id", idClienteAtual);
        if (erroCliente) throw erroCliente;
      }

      window.location.href = "/app/atendimentos/";
    } catch (err) {
      console.error(err);
      alert("Erro ao registrar falta do cliente.");
    }
  });

document.getElementById("excluir-btn").addEventListener("click", async () => {
  if (
    !confirm(
      "Tem certeza que deseja excluir este atendimento? Essa ação não pode ser desfeita.",
    )
  )
    return;
  const { error } = await supabaseClient
    .from("atendimentos")
    .delete()
    .eq("id", idAtend);
  if (error) {
    alert("Erro ao excluir atendimento.");
    return;
  }
  window.location.href = "/app/atendimentos/";
});

async function carregarModoEdicao() {
  document.getElementById("page-title").textContent = "Editar atendimento";
  document.getElementById("busca-cliente-field").style.display = "none";
  document.getElementById("excluir-btn").style.display = "inline-flex";
  document.getElementById("nao-compareceu-btn").style.display = "inline-flex";

  const barbeariaId = await obterBarbeariaId();
  const { data, error } = await supabaseClient
    .from("atendimentos")
    .select(
      `
      id, id_prof, id_cliente, data_agend, horario, nps, pagamento, forma_pagamento, pago_em,
      clientes ( nome ),
      atendimento_servicos ( servico_id )
    `,
    )
    .eq("barbearia_id", barbeariaId)
    .eq("id", idAtend)
    .single();

  if (error || !data) {
    document.getElementById("form-erro").textContent =
      "Atendimento não encontrado.";
    document.getElementById("form-erro").style.display = "block";
    return;
  }

  document
    .getElementById("bloco-cliente")
    .insertAdjacentHTML(
      "afterbegin",
      `<p class="cliente-status encontrado">Cliente: ${data.clientes?.nome || "—"}</p>`,
    );
  idClienteAtual = data.id_cliente;
  pagamentoAnterior = data.pagamento;
  pagoEmAnterior = data.pago_em;
  document.getElementById("pagamento-select").value = data.pagamento === "pago" ? "pago" : "pendente";
  document.getElementById("forma-select").value = data.forma_pagamento || "";
  atualizarCampoForma();

  document.getElementById("data-input").value = data.data_agend;
  document.getElementById("horario-input").value = data.horario
    ? data.horario.slice(0, 5)
    : "";
  document.getElementById("nps-input").value = data.nps ?? "";

  await carregarProfissionais(data.id_prof);
  document.getElementById("prof-select").value = data.id_prof;

  const servicosSelecionados = (data.atendimento_servicos || []).map(
    (s) => s.servico_id,
  );
  await carregarServicos(servicosSelecionados);
}

(async () => {
  try {
    if (typeof supabaseClient === "undefined") {
      throw new Error("Cliente Supabase não inicializado.");
    }
    const session = await checarSessao();

    if (!session) return;

    await aplicarTemaUsuario();

    if (modoEdicao) {
      await carregarModoEdicao();
    } else {
      await carregarProfissionais();
      await carregarServicos();
    }
  } catch (err) {
    console.error(err);
    document.getElementById("form-erro").textContent = err.message;
    document.getElementById("form-erro").style.display = "block";
  }
})();
