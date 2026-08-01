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

let barbeariaIdCache = null;
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

// ---------------- TABS ----------------
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

document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.getElementById(btn.dataset.close).classList.add("hidden");
  });
});

function confirmarAcao(mensagem, textoBotao = "Confirmar", estilo = "danger") {
  return new Promise((resolve) => {
    document.getElementById("confirm-mensagem").textContent = mensagem;
    const okBtn = document.getElementById("confirm-ok-btn");
    const cancelBtn = document.getElementById("confirm-cancelar-btn");
    okBtn.textContent = textoBotao;
    okBtn.className =
      estilo === "danger" ? "btn btn-danger" : "btn btn-primary";
    document.getElementById("modal-confirm").classList.remove("hidden");

    const limpar = () => {
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      document.getElementById("modal-confirm").classList.add("hidden");
    };
    const onOk = () => {
      limpar();
      resolve(true);
    };
    const onCancel = () => {
      limpar();
      resolve(false);
    };
    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
  });
}

// ---------------- ABA FLUXO DE ATENDIMENTO ----------------
let fluxoCache = [];
let atendimentoHumanoCache = null;
let remarcarFaltaCache = null;
let naoEntendiCache = null;

function formatarCaptura(variavel) {
  if (!variavel) return null;
  return variavel.replace(/[{}]/g, "");
}

const DESCRICOES_ETAPA = {
  "Primeiro contato": "Usuário informa o nome",
  "Escolha de Serviço": "Usuário escolhe o serviço desejado",
  "Atendimento humano": "Transfere a conversa para atendimento humano",
  "Escolha do profissional": "Usuário escolhe o profissional (ou pula a etapa)",
  "Marcar o dia": "Usuário informa a data desejada",
  "Marcar o Horário": "Usuário escolhe o horário disponível",
  "Pede o Email": "Usuário informa o e-mail (caso ainda não tenha cadastro)",
  "Aviso um dia antes": "Lembrete automático — não espera resposta",
  "Aviso uma hora antes": "Lembrete automático — não espera resposta",
  "NPS atendimento": "Usuário avalia o atendimento, de 1 a 5",
};

function descreverEtapa(etapa, variaveisCaptadas) {
  if (DESCRICOES_ETAPA[etapa]) return DESCRICOES_ETAPA[etapa];
  const captura = formatarCaptura(variaveisCaptadas);
  return captura
    ? `Usuário responde: ${captura}`
    : "Mensagem informativa, sem resposta esperada";
}

function renderizarFluxoVisual(lista) {
  const container = document.getElementById("flow-visual-fluxo");
  const listaVisual = lista.filter(
    (m) =>
      m.etapa !== "Atendimento humano" &&
      m.etapa !== "Remarcar após falta" &&
      m.etapa !== "Não entendi a resposta",
  );
  container.innerHTML = listaVisual
    .map((m, i) => {
      const descricao = descreverEtapa(m.etapa, m.variaveis_captadas);
      const step = `
      <div class="flow-step">
        ${m.etapa}
        <span class="flow-step-sub">${descricao}</span>
      </div>
    `;
      const arrow =
        i < listaVisual.length - 1 ? '<span class="flow-arrow">→</span>' : "";
      return step + arrow;
    })
    .join("");
}

async function carregarFluxo() {
  const { data, error } = await supabaseClient
    .from("fluxo_mensagens")
    .select("id, id_msg, etapa, mensagem, variaveis_captadas")
    .order("id_msg", { ascending: true });

  const body = document.getElementById("tabela-fluxo-body");

  if (error) {
    body.innerHTML =
      '<tr><td colspan="2" class="empty">Erro ao carregar fluxo de mensagens.</td></tr>';
    return;
  }

  fluxoCache = data || [];

  if (fluxoCache.length === 0) {
    body.innerHTML =
      '<tr><td colspan="2" class="empty">Nenhuma mensagem cadastrada.</td></tr>';
    document.getElementById("flow-visual-fluxo").innerHTML = "";
    return;
  }

  renderizarFluxoVisual(fluxoCache);

  const atendimentoHumanoItem = fluxoCache.find(
    (m) => m.etapa === "Atendimento humano",
  );
  const remarcarFaltaItem = fluxoCache.find(
    (m) => m.etapa === "Remarcar após falta",
  );
  const naoEntendiItem = fluxoCache.find(
    (m) => m.etapa === "Não entendi a resposta",
  );
  const listaPrincipal = fluxoCache.filter(
    (m) =>
      m.etapa !== "Atendimento humano" &&
      m.etapa !== "Remarcar após falta" &&
      m.etapa !== "Não entendi a resposta",
  );

  atendimentoHumanoCache = atendimentoHumanoItem || null;
  document.getElementById("atendimento-humano-preview").innerHTML =
    atendimentoHumanoItem
      ? atendimentoHumanoItem.mensagem || "<em>Sem mensagem configurada</em>"
      : "<em>Não encontrado</em>";

  remarcarFaltaCache = remarcarFaltaItem || null;
  document.getElementById("remarcar-falta-preview").innerHTML =
    remarcarFaltaItem
      ? remarcarFaltaItem.mensagem || "<em>Sem mensagem configurada</em>"
      : "<em>Não encontrado</em>";

  naoEntendiCache = naoEntendiItem || null;
  document.getElementById("nao-entendi-preview").innerHTML = naoEntendiItem
    ? naoEntendiItem.mensagem || "<em>Sem mensagem configurada</em>"
    : "<em>Não encontrado</em>";

  if (listaPrincipal.length === 0) {
    body.innerHTML =
      '<tr><td colspan="2" class="empty">Nenhuma mensagem cadastrada.</td></tr>';
    return;
  }

  body.innerHTML = listaPrincipal
    .map((m) => {
      const descricao = descreverEtapa(m.etapa, m.variaveis_captadas);
      return `
      <tr class="clickable" data-editar="${m.id}">
        <td>
          <span class="etapa-nome">${m.etapa}</span>
          <span class="etapa-captura">${descricao}</span>
        </td>
        <td class="msg-preview">${m.mensagem || "<em>Sem mensagem configurada</em>"}</td>
      </tr>
    `;
    })
    .join("");

  body.querySelectorAll("[data-editar]").forEach((tr) => {
    tr.addEventListener("click", () => {
      const item = fluxoCache.find((m) => String(m.id) === tr.dataset.editar);
      abrirModalFluxo(item);
    });
  });
}

function abrirModalFluxo(item) {
  document.getElementById("fx-id").value = item.id;
  document.getElementById("fx-id-msg").value = item.id_msg;
  document.getElementById("fx-etapa").value = item.etapa;
  document.getElementById("fx-variaveis").value = item.variaveis_captadas || "";
  document.getElementById("fx-mensagem").value = item.mensagem || "";
  document.getElementById("fx-erro").style.display = "none";
  document.getElementById("modal-fluxo").classList.remove("hidden");
}

document.getElementById("form-fluxo").addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = document.getElementById("fx-id").value;
  const mensagem = document.getElementById("fx-mensagem").value.trim();
  const erroEl = document.getElementById("fx-erro");
  const salvarBtn = document.getElementById("fx-salvar-btn");

  erroEl.style.display = "none";
  salvarBtn.disabled = true;
  salvarBtn.textContent = "Salvando...";

  const { error } = await supabaseClient
    .from("fluxo_mensagens")
    .update({ mensagem })
    .eq("id", id);

  if (error) {
    erroEl.textContent = "Erro ao salvar mensagem.";
    erroEl.style.display = "block";
  } else {
    document.getElementById("modal-fluxo").classList.add("hidden");
    await carregarFluxo();
  }

  salvarBtn.disabled = false;
  salvarBtn.textContent = "Salvar";
});

document
  .getElementById("editar-atendimento-humano-btn")
  .addEventListener("click", () => {
    document.getElementById("ah-mensagem").value =
      atendimentoHumanoCache?.mensagem || "";
    document.getElementById("ah-erro").style.display = "none";
    document
      .getElementById("modal-atendimento-humano")
      .classList.remove("hidden");
  });

document
  .getElementById("form-atendimento-humano")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const mensagem = document.getElementById("ah-mensagem").value.trim();
    const erroEl = document.getElementById("ah-erro");
    const salvarBtn = document.getElementById("ah-salvar-btn");

    erroEl.style.display = "none";

    if (!mensagem) {
      erroEl.textContent = "Essa mensagem é obrigatória.";
      erroEl.style.display = "block";
      return;
    }

    salvarBtn.disabled = true;
    salvarBtn.textContent = "Salvando...";

    if (!atendimentoHumanoCache) {
      erroEl.textContent =
        'Etapa "Atendimento humano" não encontrada no banco.';
      erroEl.style.display = "block";
      salvarBtn.disabled = false;
      salvarBtn.textContent = "Salvar";
      return;
    }

    const { error } = await supabaseClient
      .from("fluxo_mensagens")
      .update({ mensagem })
      .eq("id", atendimentoHumanoCache.id);

    if (error) {
      erroEl.textContent = "Erro ao salvar mensagem.";
      erroEl.style.display = "block";
    } else {
      document
        .getElementById("modal-atendimento-humano")
        .classList.add("hidden");
      await carregarFluxo();
    }

    salvarBtn.disabled = false;
    salvarBtn.textContent = "Salvar";
  });

document
  .getElementById("editar-remarcar-falta-btn")
  .addEventListener("click", () => {
    document.getElementById("rf-mensagem").value =
      remarcarFaltaCache?.mensagem || "";
    document.getElementById("rf-erro").style.display = "none";
    document.getElementById("modal-remarcar-falta").classList.remove("hidden");
  });

document
  .getElementById("form-remarcar-falta")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const mensagem = document.getElementById("rf-mensagem").value.trim();
    const erroEl = document.getElementById("rf-erro");
    const salvarBtn = document.getElementById("rf-salvar-btn");

    erroEl.style.display = "none";

    if (!mensagem) {
      erroEl.textContent = "Essa mensagem é obrigatória.";
      erroEl.style.display = "block";
      return;
    }

    salvarBtn.disabled = true;
    salvarBtn.textContent = "Salvando...";

    if (!remarcarFaltaCache) {
      erroEl.textContent =
        'Etapa "Remarcar após falta" não encontrada no banco.';
      erroEl.style.display = "block";
      salvarBtn.disabled = false;
      salvarBtn.textContent = "Salvar";
      return;
    }

    const { error } = await supabaseClient
      .from("fluxo_mensagens")
      .update({ mensagem })
      .eq("id", remarcarFaltaCache.id);

    if (error) {
      erroEl.textContent = "Erro ao salvar mensagem.";
      erroEl.style.display = "block";
    } else {
      document.getElementById("modal-remarcar-falta").classList.add("hidden");
      await carregarFluxo();
    }

    salvarBtn.disabled = false;
    salvarBtn.textContent = "Salvar";
  });

document
  .getElementById("editar-nao-entendi-btn")
  .addEventListener("click", () => {
    document.getElementById("ne-mensagem").value =
      naoEntendiCache?.mensagem || "";
    document.getElementById("ne-erro").style.display = "none";
    document.getElementById("modal-nao-entendi").classList.remove("hidden");
  });

document
  .getElementById("form-nao-entendi")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const mensagem = document.getElementById("ne-mensagem").value.trim();
    const erroEl = document.getElementById("ne-erro");
    const salvarBtn = document.getElementById("ne-salvar-btn");

    erroEl.style.display = "none";

    if (!mensagem) {
      erroEl.textContent = "Essa mensagem é obrigatória.";
      erroEl.style.display = "block";
      return;
    }

    salvarBtn.disabled = true;
    salvarBtn.textContent = "Salvando...";

    if (!naoEntendiCache) {
      erroEl.textContent =
        'Etapa "Não entendi a resposta" não encontrada no banco.';
      erroEl.style.display = "block";
      salvarBtn.disabled = false;
      salvarBtn.textContent = "Salvar";
      return;
    }

    const { error } = await supabaseClient
      .from("fluxo_mensagens")
      .update({ mensagem })
      .eq("id", naoEntendiCache.id);

    if (error) {
      erroEl.textContent = "Erro ao salvar mensagem.";
      erroEl.style.display = "block";
    } else {
      document.getElementById("modal-nao-entendi").classList.add("hidden");
      await carregarFluxo();
    }

    salvarBtn.disabled = false;
    salvarBtn.textContent = "Salvar";
  });

// ---------------- ABA FOLLOW-UP ----------------
let followupCache = [];

function renderizarFollowupVisual(lista) {
  const container = document.getElementById("flow-visual-followup");
  container.innerHTML = lista
    .map((item, i) => {
      const step = `
      <div class="flow-step">
        ${item.prazo_flu !== null ? item.prazo_flu + "x" : "—"}
        <span class="flow-step-sub">${item.etapa}</span>
      </div>
    `;
      const arrow =
        i < lista.length - 1 ? '<span class="flow-arrow">→</span>' : "";
      return step + arrow;
    })
    .join("");
}

async function carregarFollowup() {
  const [prazosResp, fluxoResp] = await Promise.all([
    supabaseClient
      .from("prazos_followup")
      .select("id, id_msg, prazo_flu")
      .order("id_msg", { ascending: true }),
    supabaseClient
      .from("fluxo_followup")
      .select("id, id_msg, etapa, mensagem, tempo")
      .neq("id_msg", "101")
      .order("id_msg", { ascending: true }),
  ]);

  const body = document.getElementById("tabela-followup-body");

  if (prazosResp.error || fluxoResp.error) {
    body.innerHTML =
      '<tr><td colspan="3" class="empty">Erro ao carregar ciclos de follow-up.</td></tr>';
    return;
  }

  const prazos = prazosResp.data || [];
  const fluxos = fluxoResp.data || [];

  followupCache = fluxos.map((f) => {
    const prazo = prazos.find((p) => p.id_msg === f.id_msg);
    return {
      id_msg: f.id_msg,
      fluxo_id: f.id,
      etapa: f.etapa,
      mensagem: f.mensagem,
      prazo_id: prazo ? prazo.id : null,
      prazo_flu: prazo ? prazo.prazo_flu : null,
    };
  });

  if (followupCache.length === 0) {
    body.innerHTML =
      '<tr><td colspan="3" class="empty">Nenhum ciclo de follow-up cadastrado.</td></tr>';
    document.getElementById("flow-visual-followup").innerHTML = "";
    document.getElementById("ciclos-contador").textContent =
      "0 ciclo(s) configurado(s)";
    return;
  }

  renderizarFollowupVisual(followupCache);
  document.getElementById("ciclos-contador").textContent =
    `${followupCache.length} ciclo(s) configurado(s)`;

  body.innerHTML = followupCache
    .map(
      (item) => `
    <tr class="clickable" data-editar="${item.id_msg}">
      <td>${item.prazo_flu !== null ? item.prazo_flu + "x" : "—"}</td>
      <td>${item.etapa}</td>
      <td class="msg-preview">${item.mensagem || "<em>Sem mensagem configurada</em>"}</td>
    </tr>
  `,
    )
    .join("");

  body.querySelectorAll("[data-editar]").forEach((tr) => {
    tr.addEventListener("click", () => {
      const item = followupCache.find((f) => f.id_msg === tr.dataset.editar);
      abrirModalFollowup(item);
    });
  });
}

function abrirModalFollowup(item) {
  document.getElementById("fu-prazo-id").value = item.prazo_id || "";
  document.getElementById("fu-fluxo-id").value = item.fluxo_id;
  document.getElementById("fu-id-msg").value = item.id_msg;
  document.getElementById("fu-prazo").value = item.prazo_flu ?? "";
  document.getElementById("fu-etapa").value = item.etapa || "";
  document.getElementById("fu-mensagem").value = item.mensagem || "";
  document.getElementById("fu-erro").style.display = "none";
  document.getElementById("modal-followup").classList.remove("hidden");
}

document
  .getElementById("form-followup")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const prazoId = document.getElementById("fu-prazo-id").value;
    const fluxoId = document.getElementById("fu-fluxo-id").value;
    const prazoFlu = parseFloat(document.getElementById("fu-prazo").value);
    const etapa = document.getElementById("fu-etapa").value.trim();
    const mensagem = document.getElementById("fu-mensagem").value.trim();
    const erroEl = document.getElementById("fu-erro");
    const salvarBtn = document.getElementById("fu-salvar-btn");

    erroEl.style.display = "none";
    salvarBtn.disabled = true;
    salvarBtn.textContent = "Salvando...";

    try {
      const { error: erroFluxo } = await supabaseClient
        .from("fluxo_followup")
        .update({ etapa, mensagem })
        .eq("id", fluxoId);
      if (erroFluxo) throw erroFluxo;

      if (prazoId) {
        const { error: erroPrazo } = await supabaseClient
          .from("prazos_followup")
          .update({ prazo_flu: prazoFlu })
          .eq("id", prazoId);
        if (erroPrazo) throw erroPrazo;
      }

      document.getElementById("modal-followup").classList.add("hidden");
      await carregarFollowup();
    } catch (err) {
      console.error(err);
      erroEl.textContent = "Erro ao salvar ciclo de follow-up.";
      erroEl.style.display = "block";
    } finally {
      salvarBtn.disabled = false;
      salvarBtn.textContent = "Salvar";
    }
  });

document.getElementById("add-ciclo-btn").addEventListener("click", async () => {
  const btn = document.getElementById("add-ciclo-btn");
  btn.disabled = true;
  try {
    const barbeariaId = await obterBarbeariaId();
    const novoFlu = followupCache.length + 1;
    const { error } = await supabaseClient
      .from("barbearias")
      .update({ flu: novoFlu })
      .eq("id", barbeariaId);
    if (error) throw error;
    await carregarFollowup();
  } catch (err) {
    console.error(err);
    alert("Erro ao adicionar ciclo. Verifique se você tem papel de admin.");
  } finally {
    btn.disabled = false;
  }
});

document
  .getElementById("remover-ciclo-btn")
  .addEventListener("click", async () => {
    if (followupCache.length === 0) return;
    const confirmado = await confirmarAcao(
      "Remover o último ciclo de follow-up? A mensagem configurada nele será apagada.",
      "Remover",
    );
    if (!confirmado) return;

    const btn = document.getElementById("remover-ciclo-btn");
    btn.disabled = true;
    try {
      const ultimo = followupCache[followupCache.length - 1];
      const barbeariaId = await obterBarbeariaId();

      await supabaseClient
        .from("fluxo_followup")
        .delete()
        .eq("id", ultimo.fluxo_id);
      if (ultimo.prazo_id) {
        await supabaseClient
          .from("prazos_followup")
          .delete()
          .eq("id", ultimo.prazo_id);
      }

      const novoFlu = Math.max(0, followupCache.length - 1);
      await supabaseClient
        .from("barbearias")
        .update({ flu: novoFlu })
        .eq("id", barbeariaId);

      await carregarFollowup();
    } catch (err) {
      console.error(err);
      alert("Erro ao remover ciclo.");
    } finally {
      btn.disabled = false;
    }
  });

// ---------------- ENCERRAMENTO DO FOLLOW-UP (mensagem fixa, sem prazo) ----------------
let finalizacaoCache = null;

async function carregarFinalizacao() {
  const { data, error } = await supabaseClient
    .from("fluxo_followup")
    .select("id, mensagem")
    .eq("id_msg", "101")
    .maybeSingle();

  const preview = document.getElementById("finalizacao-preview");

  if (error || !data) {
    preview.innerHTML = "<em>Ainda não configurada.</em>";
    return;
  }

  finalizacaoCache = data;
  preview.innerHTML = data.mensagem || "<em>Sem mensagem configurada</em>";
}

document
  .getElementById("editar-finalizacao-btn")
  .addEventListener("click", () => {
    document.getElementById("fin-mensagem").value =
      finalizacaoCache?.mensagem || "";
    document.getElementById("fin-erro").style.display = "none";
    document.getElementById("modal-finalizacao").classList.remove("hidden");
  });

document
  .getElementById("form-finalizacao")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const mensagem = document.getElementById("fin-mensagem").value.trim();
    const erroEl = document.getElementById("fin-erro");
    const salvarBtn = document.getElementById("fin-salvar-btn");

    erroEl.style.display = "none";

    if (!mensagem) {
      erroEl.textContent = "Essa mensagem é obrigatória.";
      erroEl.style.display = "block";
      return;
    }

    salvarBtn.disabled = true;
    salvarBtn.textContent = "Salvando...";

    if (!finalizacaoCache) {
      erroEl.textContent = "Linha de encerramento não encontrada no banco.";
      erroEl.style.display = "block";
      salvarBtn.disabled = false;
      salvarBtn.textContent = "Salvar";
      return;
    }

    const { error } = await supabaseClient
      .from("fluxo_followup")
      .update({ mensagem })
      .eq("id", finalizacaoCache.id);

    if (error) {
      erroEl.textContent = "Erro ao salvar mensagem de encerramento.";
      erroEl.style.display = "block";
    } else {
      document.getElementById("modal-finalizacao").classList.add("hidden");
      await carregarFinalizacao();
    }

    salvarBtn.disabled = false;
    salvarBtn.textContent = "Salvar";
  });

// ---------------- STATUS DO FLUXO (liga/desliga) ----------------
let statusFluxoAtual = null;

function atualizarBadgeStatusFluxo(status) {
  statusFluxoAtual = status;
  const label = document.getElementById("status-fluxo-label");
  const track = document.getElementById("toggle-fluxo-btn");
  const ativo = status === "Sim";

  label.textContent = ativo ? "Fluxo ativo" : "Fluxo inativo";
  track.classList.toggle("on", ativo);
  track.setAttribute("aria-checked", String(ativo));
}

async function carregarStatusFluxo() {
  const barbeariaId = await obterBarbeariaId();
  const { data, error } = await supabaseClient
    .from("barbearias")
    .select("status_fluxo")
    .eq("id", barbeariaId)
    .single();

  if (error) {
    document.getElementById("status-fluxo-label").textContent = "Erro";
    return;
  }

  atualizarBadgeStatusFluxo(data.status_fluxo);
}

document
  .getElementById("toggle-fluxo-btn")
  .addEventListener("click", async () => {
    const novoStatus = statusFluxoAtual === "Sim" ? "Não" : "Sim";
    const mensagem =
      novoStatus === "Não"
        ? "Tem certeza que deseja desativar o fluxo? O sistema vai parar de responder automaticamente no WhatsApp."
        : "Tem certeza que deseja ativar o fluxo? O sistema volta a responder automaticamente no WhatsApp.";

    const confirmado = await confirmarAcao(
      mensagem,
      novoStatus === "Não" ? "Desativar" : "Ativar",
      novoStatus === "Não" ? "danger" : "primary",
    );
    if (!confirmado) return;

    try {
      const barbeariaId = await obterBarbeariaId();
      const { error } = await supabaseClient
        .from("barbearias")
        .update({ status_fluxo: novoStatus })
        .eq("id", barbeariaId);
      if (error) throw error;
      atualizarBadgeStatusFluxo(novoStatus);
    } catch (err) {
      console.error(err);
      alert(
        "Erro ao atualizar o status do fluxo. Você precisa ter papel de admin.",
      );
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
      await carregarStatusFluxo();
      await carregarFluxo();
      await carregarFollowup();
      await carregarFinalizacao();
    }
  } catch (err) {
    console.error(err);
    document.getElementById("tabela-fluxo-body").innerHTML =
      `<tr><td colspan="2" class="empty">Erro: ${err.message}</td></tr>`;
  }
})();
