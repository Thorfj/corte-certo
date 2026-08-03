if (typeof lucide !== "undefined") {
  lucide.createIcons();
} else {
  console.error("Lucide não carregou — verifique a conexão com unpkg.com");
}

let barbeariaCache = null;
let profissionalAtualCache = null;

// TODO: trocar pela URL real do webhook n8n que inicia o OAuth do Google
// (deve receber a barbearia_id como parâmetro pra saber onde salvar o retorno)
const GOOGLE_OAUTH_URL =
  "https://SEU-N8N.exemplo.com/webhook/google-oauth-start";

// TODO: ajustar para a URL real da Edge Function depois do deploy
const CRIAR_USUARIO_URL =
  "https://jzqiqrymqbzullysukja.supabase.co/functions/v1/criar-usuario";

async function obterProfissionalAtual() {
  if (profissionalAtualCache) return profissionalAtualCache;
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  const { data, error } = await supabaseClient
    .from("profissionais")
    .select("id, acesso, tema")
    .eq("auth_user_id", user.id)
    .single();
  if (error) throw error;
  profissionalAtualCache = data;
  return profissionalAtualCache;
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

// ---------------- ABA GERAL ----------------
async function carregarGeral() {
  const barbeariaId = await obterBarbeariaId();
  const { data, error } = await supabaseClient
    .from("barbearias")
    .select(
      "id, empresa, email, whatsapp, cliente, google_calendar_status, google_calendar_email",
    )
    .eq("id", barbeariaId)
    .single();

  if (error) {
    document.getElementById("g-erro").textContent =
      "Erro ao carregar configurações.";
    document.getElementById("g-erro").style.display = "block";
    return;
  }

  barbeariaCache = data;
  document.getElementById("g-empresa").value = data.empresa || "";
  document.getElementById("g-email").value = data.email || "";
  document.getElementById("g-whatsapp").value = data.whatsapp || "";

  atualizarStatusPlano(data);
  await configurarAparenciaEGoogle(data);
}

// ---------------- ABA GERAL — Aparência (tema) ----------------
function marcarTemaAtivo(tema) {
  document.querySelectorAll(".tema-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tema === tema);
  });
}

document.querySelectorAll(".tema-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const tema = btn.dataset.tema;
    marcarTemaAtivo(tema);

    if (tema === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    localStorage.setItem("corteCerto:tema", tema);

    try {
      const { error } = await supabaseClient.rpc("update_meu_tema", {
        novo_tema: tema,
      });
      if (error) throw error;
      if (profissionalAtualCache) profissionalAtualCache.tema = tema;
    } catch (err) {
      console.error(err);
    }
  });
});

// ---------------- ABA GERAL — Google Calendar ----------------
function atualizarStatusGoogle(barbearia) {
  const badge = document.getElementById("google-status-badge");
  const conectarBtn = document.getElementById("google-conectar-btn");
  const conectado = barbearia.google_calendar_status === "conectado";

  badge.textContent = conectado
    ? `Conectado ✅${barbearia.google_calendar_email ? " — " + barbearia.google_calendar_email : ""}`
    : "Desconectado";
  badge.classList.toggle("conectado", conectado);
  conectarBtn.textContent = conectado
    ? "Reconectar com Google"
    : "Conectar com Google";
  conectarBtn.href = `${GOOGLE_OAUTH_URL}?barbearia_id=${barbearia.id}`;
}

async function configurarAparenciaEGoogle(barbearia) {
  const profissional = await obterProfissionalAtual();
  marcarTemaAtivo(profissional.tema === "dark" ? "dark" : "light");

  const cardGoogle = document.getElementById("card-google");
  if (profissional.acesso === "admin") {
    cardGoogle.classList.remove("hidden");
    atualizarStatusGoogle(barbearia);
  } else {
    cardGoogle.classList.add("hidden");
  }
}

document.getElementById("form-geral").addEventListener("submit", async (e) => {
  e.preventDefault();

  const erroEl = document.getElementById("g-erro");
  const sucessoEl = document.getElementById("g-sucesso");
  const salvarBtn = document.getElementById("g-salvar-btn");
  erroEl.style.display = "none";
  sucessoEl.style.display = "none";
  salvarBtn.disabled = true;
  salvarBtn.textContent = "Salvando...";

  try {
    const barbeariaId = await obterBarbeariaId();
    const { error } = await supabaseClient
      .from("barbearias")
      .update({
        empresa: document.getElementById("g-empresa").value.trim(),
        email: document.getElementById("g-email").value.trim() || null,
        whatsapp: document.getElementById("g-whatsapp").value.trim() || null,
      })
      .eq("id", barbeariaId);

    if (error) throw error;

    sucessoEl.style.display = "block";
    setTimeout(() => {
      sucessoEl.style.display = "none";
    }, 3000);
  } catch (err) {
    console.error(err);
    erroEl.textContent =
      "Erro ao salvar. Você precisa ter papel de admin para editar essas configurações.";
    erroEl.style.display = "block";
  } finally {
    salvarBtn.disabled = false;
    salvarBtn.textContent = "Salvar alterações";
  }
});

// ---------------- ABA USUÁRIOS ----------------
// FIX: antes buscava TODOS os profissionais visíveis pela RLS, sem
// filtrar pela barbearia do usuário logado. Por isso apareciam usuários
// de outras barbearias (ex: "Usuário Teste").
async function carregarUsuarios() {
  const barbeariaId = await obterBarbeariaId();
  const { data, error } = await supabaseClient
    .from("profissionais")
    .select("id, nome, email, acesso, agendas")
    .eq("barbearia_id", barbeariaId)
    .order("nome", { ascending: true });

  const body = document.getElementById("tabela-usuarios-body");

  if (error) {
    body.innerHTML =
      '<tr><td colspan="5" class="empty">Erro ao carregar usuários.</td></tr>';
    return;
  }

  if (!data || data.length === 0) {
    body.innerHTML =
      '<tr><td colspan="5" class="empty">Nenhum usuário cadastrado.</td></tr>';
    return;
  }

  const rotulos = {
    admin: "Admin",
    cabeleireiro: "Cabeleireiro",
    teste: "Teste",
  };

  body.innerHTML = data
    .map(
      (u) => `
    <tr class="clickable" data-editar="${u.id}">
      <td>${u.nome}</td>
      <td>${u.email}</td>
      <td><span class="badge">${rotulos[u.acesso] || u.acesso}</span></td>
      <td>${u.agendas || "—"}</td>
      <td class="col-acoes"><i data-lucide="pencil" style="width:16px;height:16px"></i></td>
    </tr>
  `,
    )
    .join("");

  if (typeof lucide !== "undefined") lucide.createIcons();

  body.querySelectorAll("[data-editar]").forEach((tr) => {
    tr.addEventListener("click", () => {
      const usuario = data.find((u) => String(u.id) === tr.dataset.editar);
      abrirModalUsuario(usuario);
    });
  });
}

function abrirModalUsuario(usuario) {
  document.getElementById("form-usuario").reset();
  document.getElementById("us-erro").style.display = "none";

  if (usuario) {
    document.getElementById("modal-usuario-titulo").textContent =
      "Editar Usuário";
    document.getElementById("us-id").value = usuario.id;
    document.getElementById("us-nome").value = usuario.nome;
    document.getElementById("us-email").value = usuario.email;
    document.getElementById("us-acesso").value = usuario.acesso;
    document.getElementById("us-agenda").value = usuario.agendas || "";
  } else {
    document.getElementById("modal-usuario-titulo").textContent =
      "Novo Usuário";
    document.getElementById("us-id").value = "";
  }

  // campo de UID manual removido do fluxo — a Edge Function cuida disso
  document.getElementById("modal-usuario").classList.remove("hidden");
}

document
  .getElementById("novo-usuario-btn")
  .addEventListener("click", () => abrirModalUsuario(null));

document
  .getElementById("form-usuario")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = document.getElementById("us-id").value;
    const nome = document.getElementById("us-nome").value.trim();
    const email = document.getElementById("us-email").value.trim();
    const acesso = document.getElementById("us-acesso").value;
    const agendas = document.getElementById("us-agenda").value.trim() || null;
    const erroEl = document.getElementById("us-erro");
    const salvarBtn = document.getElementById("us-salvar-btn");

    erroEl.style.display = "none";
    salvarBtn.disabled = true;
    salvarBtn.textContent = "Salvando...";

    try {
      if (id) {
        // edição: continua indo direto na tabela (RLS/policy de UPDATE
        // já deve restringir pra mesma barbearia)
        const { error } = await supabaseClient
          .from("profissionais")
          .update({ nome, email, acesso, agendas })
          .eq("id", id);
        if (error) throw error;
      } else {
        // criação: agora passa pela Edge Function — ela cria o usuário
        // no Supabase Auth, pega o UID sozinha e insere em profissionais
        // já com o barbearia_id certo. Ninguém precisa colar UID na mão.
        const {
          data: { session },
        } = await supabaseClient.auth.getSession();

        const resp = await fetch(CRIAR_USUARIO_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ nome, email, acesso, agendas }),
        });

        const resultado = await resp.json();
        if (!resp.ok || resultado.error) {
          throw new Error(resultado.error || "Erro ao criar usuário.");
        }
      }

      document.getElementById("modal-usuario").classList.add("hidden");
      await carregarUsuarios();
    } catch (err) {
      console.error(err);
      erroEl.textContent =
        err.code === "23505"
          ? "Já existe um usuário com esse e-mail."
          : err.message || "Erro ao salvar usuário.";
      erroEl.style.display = "block";
    } finally {
      salvarBtn.disabled = false;
      salvarBtn.textContent = "Salvar";
    }
  });

// ---------------- ABA FATURAS ----------------
// FIX: também filtra por barbearia_id (antes trazia faturas de todo mundo)
async function carregarFaturas() {
  const barbeariaId = await obterBarbeariaId();
  const { data, error } = await supabaseClient
    .from("asaas")
    .select("id, fatura_url, data, status")
    .eq("barbearia_id", barbeariaId)
    .order("data", { ascending: false });

  const body = document.getElementById("tabela-faturas-body");

  if (error) {
    body.innerHTML =
      '<tr><td colspan="3" class="empty">Erro ao carregar faturas.</td></tr>';
    return;
  }

  if (!data || data.length === 0) {
    body.innerHTML =
      '<tr><td colspan="3" class="empty">Nenhuma fatura registrada.</td></tr>';
    return;
  }

  body.innerHTML = data
    .map((f) => {
      const [ano, mes, dia] = f.data.split("-");
      const rotuloStatus = f.status === "pagante" ? "Pago" : "Não pago";
      return `
      <tr class="clickable" data-url="${f.fatura_url || ""}">
        <td>Baixar fatura</td>
        <td>${dia}/${mes}/${ano}</td>
        <td><span class="badge">${rotuloStatus}</span></td>
      </tr>
    `;
    })
    .join("");

  body.querySelectorAll("tr[data-url]").forEach((tr) => {
    tr.addEventListener("click", () => {
      const url = tr.dataset.url;
      if (url && url.startsWith("http")) {
        window.open(url, "_blank");
      }
    });
  });
}

function atualizarStatusPlano(barbearia) {
  const textoEl = document.getElementById("plano-status-texto");
  const cancelarBtn = document.getElementById("cancelar-plano-btn");

  if (barbearia.cliente) {
    textoEl.textContent = "Assinatura ativa.";
    cancelarBtn.style.display = "inline-flex";
  } else {
    textoEl.textContent = "Assinatura cancelada.";
    cancelarBtn.style.display = "none";
  }
}

document
  .getElementById("cancelar-plano-btn")
  .addEventListener("click", async () => {
    if (
      !confirm(
        "Tem certeza que deseja cancelar a assinatura? O fluxo de mensagens será desativado.",
      )
    )
      return;

    try {
      const barbeariaId = await obterBarbeariaId();
      const { error } = await supabaseClient
        .from("barbearias")
        .update({ cliente: false })
        .eq("id", barbeariaId);
      if (error) throw error;

      barbeariaCache.cliente = false;
      atualizarStatusPlano(barbeariaCache);
    } catch (err) {
      console.error(err);
      alert("Erro ao cancelar assinatura. Você precisa ter papel de admin.");
    }
  });

// ---------------- Status do teste grátis ----------------
async function carregarStatusTeste() {
  const card = document.getElementById("trial-status-card");
  try {
    const { data, error } = await supabaseClient.rpc("status_teste");
    if (error || !data || !data.length) return;

    const status = data[0];
    card.classList.remove("hidden", "trial-banner-info", "trial-banner-aviso");

    if (status.fase === "assinante") {
      card.classList.add("hidden");
      return;
    }

    if (status.fase === "configurando") {
      card.classList.add("trial-banner-info");
      card.innerHTML = `
        <span>Configure suas informações, profissionais e serviços à vontade. Quando terminar, inicie seus 5 dias de teste grátis.</span>
        <button type="button" class="btn btn-primary" id="concluir-config-btn">Concluir configuração e iniciar teste</button>
      `;
      document
        .getElementById("concluir-config-btn")
        .addEventListener("click", concluirConfiguracaoTeste);
      return;
    }

    if (status.fase === "teste_ativo") {
      card.classList.add("trial-banner-info");
      card.innerHTML = `<span>Você está no teste grátis — ${status.dias_restantes} dia(s) restante(s).</span>`;
      return;
    }

    if (status.fase === "grace") {
      card.classList.add("trial-banner-aviso");
      card.innerHTML = `<span>Seu teste grátis acabou. Você ainda tem ${status.dias_restantes} dia(s) de acesso ao CRM, mas o fluxo foi desativado até você assinar.</span>`;
      return;
    }

    if (status.fase === "bloqueado") {
      card.classList.add("trial-banner-aviso");
      card.innerHTML = `<span>Seu período de acesso terminou. Assine o plano pra reativar o CRM.</span>`;
    }
  } catch (err) {
    console.error("Erro ao carregar status do teste:", err);
  }
}

async function concluirConfiguracaoTeste() {
  if (
    !confirm(
      "A partir de agora você tem 5 dias de teste grátis. Deseja continuar?",
    )
  )
    return;

  try {
    const { error } = await supabaseClient.rpc("concluir_configuracao_teste");
    if (error) throw error;
    await carregarStatusTeste();
  } catch (err) {
    console.error(err);
    alert("Erro ao iniciar o teste. Tente novamente.");
  }
}

(async () => {
  try {
    if (typeof supabaseClient === "undefined") {
      throw new Error("Cliente Supabase não inicializado.");
    }
    const session = await checarSessao();
    if (session) {
      await aplicarTemaUsuario();
      await carregarNomeBarbearia();
      await carregarStatusTeste();
      await carregarGeral();
      await carregarUsuarios();
      await carregarFaturas();
    }
  } catch (err) {
    console.error(err);
    document.getElementById("g-erro").textContent = "Erro: " + err.message;
    document.getElementById("g-erro").style.display = "block";
  }
})();
