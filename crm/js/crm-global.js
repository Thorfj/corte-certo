/* ============================================================
   CORTE CERTO — CRM-GLOBAL.JS
   Sidebar compartilhada por todas as páginas internas do CRM.
   Toda página do dashboard deve ter:
     <div id="crm-sidebar"></div>
   logo no início do <div class="app">, no lugar do <aside> que
   antes era copiado e colado em cada arquivo.

   Também centraliza 3 coisas que se repetiam em cada .js de página:
     - marcar o item de menu ativo (antes era feito manualmente com
       class="active" hardcoded em cada HTML)
     - o handler do botão "Sair"
     - fechar modais clicando fora deles / no botão data-close

   Carregar depois de supabase-config.js e antes do script da
   própria página.
   ============================================================ */

(function () {
  // Itens do menu. `restrito: true` = só aparece pro papel "admin";
  // pro papel "usuario" some do menu E o acesso direto pela URL é
  // bloqueado (redireciona pra atendimentos.html).
  const NAV_ITEMS = [
    { page: "atendimentos.html", icon: "clipboard-list", label: "Atendimentos", restrito: false },
    { page: "agenda.html", icon: "calendar", label: "Agenda", restrito: false },
    { page: "contatos.html", icon: "users", label: "Contatos", restrito: false },
    { page: "servicos.html", icon: "scissors", label: "Serviços", restrito: true },
    { page: "mensagens.html", icon: "message-square", label: "Mensagens", restrito: true },
    { page: "relatorios.html", icon: "pie-chart", label: "Relatórios", restrito: true },
    { page: "configuracoes.html", icon: "settings", label: "Configurações", restrito: true },
  ];
  const PAGINAS_RESTRITAS = NAV_ITEMS.filter((i) => i.restrito).map((i) => i.page);

  function montarNavHtml(acesso) {
    const itensVisiveis = NAV_ITEMS.filter((i) => acesso === "admin" || !i.restrito);
    return itensVisiveis
      .map(
        (i) => `
      <a class="nav-item" data-page="${i.page}" href="${i.page}"><i data-lucide="${i.icon}"></i> <span class="nav-label">${i.label}</span></a>
    `,
      )
      .join("");
  }

  // Pro papel "usuario", o toggle de Aparência (que normalmente fica
  // em Configurações, página que ele não acessa mais) aparece direto
  // no sidebar.
  function montarAparenciaHtml(acesso) {
    if (acesso !== "usuario") return "";
    return `
      <div class="sidebar-aparencia">
        <span class="nav-label sidebar-aparencia-label">Aparência</span>
        <div class="tema-toggle-sidebar" id="tema-toggle-sidebar">
          <button type="button" class="tema-btn-sidebar" data-tema="light" title="Tema claro"><i data-lucide="sun" style="width:15px;height:15px"></i></button>
          <button type="button" class="tema-btn-sidebar" data-tema="dark" title="Tema escuro"><i data-lucide="moon" style="width:15px;height:15px"></i></button>
        </div>
      </div>
    `;
  }

  function montarSidebarHtml(acesso) {
    return `
    <div class="logo">
      <div class="logo-icon"><i data-lucide="scissors" style="width:18px;height:18px"></i></div>
      <span class="logo-name"></span>
    </div>
    <nav class="nav">
      ${montarNavHtml(acesso)}
    </nav>
    <div class="sidebar-footer">
      ${montarAparenciaHtml(acesso)}
      <button class="sidebar-collapse-btn" id="sidebar-collapse-btn">
        <i data-lucide="chevrons-left" class="icon-expand" style="width:16px;height:16px"></i>
        <i data-lucide="chevrons-right" class="icon-collapse" style="width:16px;height:16px"></i>
        <span class="nav-label">Recolher menu</span>
      </button>
      <a class="help-button" href="ajuda.html"><i data-lucide="help-circle" style="width:16px;height:16px"></i></a>
      <a class="nav-item" href="#" id="logout-link"><i data-lucide="log-out"></i> <span class="nav-label">Sair</span></a>
    </div>
  `;
  }

  // CSS do que é novo aqui (toggle de aparência no sidebar). Injetado
  // via JS pra não depender de mexer no global.css.
  function injetarEstilosPapel() {
    if (document.getElementById("crm-role-styles")) return;
    const style = document.createElement("style");
    style.id = "crm-role-styles";
    style.textContent = `
      .sidebar-aparencia { padding: 8px; margin-bottom: 4px; }
      .sidebar-aparencia-label { display: block; font-size: 11px; color: var(--text-muted); margin-bottom: 6px; padding: 0 2px; }
      .sidebar.collapsed .sidebar-aparencia-label { display: none; }
      .tema-toggle-sidebar { display: flex; gap: 4px; }
      .sidebar.collapsed .tema-toggle-sidebar { flex-direction: column; }
      .tema-btn-sidebar {
        flex: 1; display: flex; align-items: center; justify-content: center;
        padding: 7px; border-radius: var(--radius-sm); border: 1px solid var(--border-strong);
        background: var(--bg-card); color: var(--text-secondary); cursor: pointer;
      }
      .tema-btn-sidebar.active { background: var(--brand-light); color: var(--brand-dark); border-color: var(--brand); }
      .tema-btn-sidebar:hover { background: rgba(28,28,26,0.04); }
    `;
    document.head.appendChild(style);
  }

  function marcarTemaAtivoSidebar(tema) {
    document.querySelectorAll(".tema-btn-sidebar").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tema === tema);
    });
  }

  async function wireAparenciaSidebar() {
    const botoes = document.querySelectorAll(".tema-btn-sidebar");
    if (!botoes.length) return;

    const temaCache = localStorage.getItem("corteCerto:tema") || "light";
    marcarTemaAtivoSidebar(temaCache);

    botoes.forEach((btn) => {
      btn.addEventListener("click", async () => {
        const tema = btn.dataset.tema;
        marcarTemaAtivoSidebar(tema);

        if (tema === "dark") {
          document.documentElement.setAttribute("data-theme", "dark");
        } else {
          document.documentElement.removeAttribute("data-theme");
        }
        localStorage.setItem("corteCerto:tema", tema);

        try {
          const { error } = await supabaseClient.rpc("update_meu_tema", { novo_tema: tema });
          if (error) throw error;
        } catch (err) {
          console.error("Erro ao salvar tema:", err);
        }
      });
    });
  }

  function aplicarEstadoSidebar() {
    const sidebarMount = document.getElementById("crm-sidebar");
    const colapsada =
      localStorage.getItem("corteCerto:sidebarColapsada") === "true";
    sidebarMount.classList.toggle("collapsed", colapsada);
  }

  function wireCollapseToggle() {
    const btn = document.getElementById("sidebar-collapse-btn");
    const sidebarMount = document.getElementById("crm-sidebar");
    if (!btn || !sidebarMount) return;

    btn.addEventListener("click", () => {
      const colapsada = sidebarMount.classList.toggle("collapsed");
      localStorage.setItem("corteCerto:sidebarColapsada", String(colapsada));
    });
  }

  function marcarItemAtivo() {
    const paginaAtual = window.location.pathname.split("/").pop();
    document.querySelectorAll(".nav-item[data-page]").forEach((item) => {
      item.classList.toggle("active", item.dataset.page === paginaAtual);
    });
  }

  function wireLogout() {
    const logoutLink = document.getElementById("logout-link");
    if (!logoutLink) return;
    logoutLink.addEventListener("click", async (e) => {
      e.preventDefault();
      await supabaseClient.auth.signOut();
      window.location.href = "login.html";
    });
  }

  // Fecha qualquer modal ao clicar no botão X / data-close, ou clicando
  // fora dele (no overlay escuro). Antes isso era copiado em quase todo
  // .js de página que tinha modal.
  function wireModais() {
    document.querySelectorAll("[data-close]").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.getElementById(btn.dataset.close)?.classList.add("hidden");
      });
    });
    document.querySelectorAll(".modal-overlay").forEach((overlay) => {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          overlay.classList.add("hidden");
        }
      });
    });
  }

  // ---------------- Teste grátis: sincroniza e bloqueia se preciso ----------------
  async function checarStatusTeste() {
    try {
      // Best-effort: se o teste (ou a carência) já passou e não é cliente
      // pagante, força o fluxo pra desativado direto no banco.
      await supabaseClient.rpc("sincronizar_fluxo_teste");

      const { data, error } = await supabaseClient.rpc("status_teste");
      if (error || !data || !data.length) return;

      const status = data[0];

      if (status.fase === "bloqueado") {
        mostrarBloqueioAcesso();
      } else if (status.fase === "grace") {
        mostrarBannerCarencia(status.dias_restantes);
      } else if (status.fase === "teste_ativo") {
        mostrarBannerTeste(status.dias_restantes);
      }
    } catch (err) {
      console.error("Erro ao checar status do teste:", err);
    }
  }

  function mostrarBloqueioAcesso() {
    const overlay = document.createElement("div");
    overlay.className = "trial-block-overlay";
    overlay.innerHTML = `
      <div class="trial-block-card">
        <p class="trial-block-title">Seu período de acesso terminou</p>
        <p class="trial-block-desc">Assine o plano do Corte Certo pra continuar usando o CRM.</p>
        <a class="btn btn-primary" href="configuracoes.html">Assinar agora</a>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  function criarBanner(texto, tipo) {
    const banner = document.createElement("div");
    banner.className = `trial-banner trial-banner-${tipo}`;
    banner.innerHTML = `<span>${texto}</span> <a href="configuracoes.html">Assinar agora</a>`;
    const mainContent = document.querySelector(".main-content");
    if (mainContent) mainContent.prepend(banner);
  }

  function mostrarBannerCarencia(dias) {
    criarBanner(
      `Seu teste grátis acabou. Você ainda tem ${dias} dia(s) de acesso ao CRM, mas o fluxo foi desativado até você assinar.`,
      "aviso",
    );
  }

  function mostrarBannerTeste(dias) {
    criarBanner(
      `Você está no teste grátis: ${dias} dia(s) restante(s).`,
      "info",
    );
  }

  // ---------------- Onboarding (tour guiado) ----------------
  // Só roda durante o período de teste (configurando ou teste_ativo) e só
  // uma vez por página, por navegador (localStorage).
  // ONBOARDING_PASSOS agora vem de onboarding-data.js (carregado antes
  // deste arquivo no <head> de cada página).

  function elementoVisivel(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function rodarTour(passos, aoFinalizar) {
    let indice = 0;
    let elementoAtual = null;

    function limparPasso() {
      if (elementoAtual) elementoAtual.classList.remove("onboarding-highlight");
      document
        .querySelectorAll(".onboarding-tooltip")
        .forEach((el) => el.remove());
    }

    function mostrarPasso() {
      limparPasso();
      const passo = passos[indice];
      const alvo = document.querySelector(passo.selector);

      if (!elementoVisivel(alvo)) {
        avancar();
        return;
      }

      elementoAtual = alvo;
      alvo.classList.add("onboarding-highlight");
      alvo.scrollIntoView({ block: "center", behavior: "smooth" });

      setTimeout(() => {
        const rect = alvo.getBoundingClientRect();
        const tooltip = document.createElement("div");
        tooltip.className = "onboarding-tooltip";
        tooltip.innerHTML = `
          <p class="onboarding-contador">${indice + 1} de ${passos.length}</p>
          <p class="onboarding-titulo">${passo.titulo}</p>
          <p class="onboarding-texto">${passo.texto}</p>
          <div class="onboarding-acoes">
            <button type="button" class="onboarding-pular">Pular tour</button>
            <button type="button" class="btn btn-primary onboarding-proximo">${
              indice === passos.length - 1 ? "Concluir" : "Próximo"
            }</button>
          </div>
        `;
        document.body.appendChild(tooltip);

        const tw = tooltip.offsetWidth;
        const th = tooltip.offsetHeight;
        let top = rect.bottom + 12;
        let left = rect.left;
        if (top + th > window.innerHeight - 16) top = rect.top - th - 12;
        if (top < 16) top = 16;
        if (left + tw > window.innerWidth - 16)
          left = window.innerWidth - tw - 16;
        if (left < 16) left = 16;
        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;

        tooltip
          .querySelector(".onboarding-pular")
          .addEventListener("click", finalizar);
        tooltip
          .querySelector(".onboarding-proximo")
          .addEventListener("click", avancar);
      }, 300);
    }

    function avancar() {
      indice++;
      if (indice >= passos.length) {
        finalizar();
        return;
      }
      mostrarPasso();
    }

    function finalizar() {
      limparPasso();
      aoFinalizar();
    }

    mostrarPasso();
  }

  async function iniciarOnboardingSePreciso() {
    const pagina = window.location.pathname.split("/").pop();
    const passosBrutos = ONBOARDING_PASSOS[pagina];
    if (!passosBrutos) return;

    const chave = `corteCerto:onboardingVisto:${pagina}`;
    if (localStorage.getItem(chave) === "true") return;

    try {
      const { data, error } = await supabaseClient.rpc("status_teste");
      if (error || !data || !data.length) return;
      const fase = data[0].fase;
      if (fase !== "configurando" && fase !== "teste_ativo") return;
    } catch (err) {
      console.error("Erro ao checar fase do teste pro onboarding:", err);
      return;
    }

    // dá um tempinho pro conteúdo estático da página assentar antes de medir
    setTimeout(() => {
      rodarTour(passosBrutos, () => {
        localStorage.setItem(chave, "true");
      });
    }, 400);
  }

  async function iniciar() {
    const sidebarMount = document.getElementById("crm-sidebar");
    if (!sidebarMount) return; // página sem sidebar (ex: login.html)

    // Descobre o papel do usuário o quanto antes. Se der erro (sessão
    // ainda carregando, etc.), assume "admin" pra não esconder nada por
    // engano — cada página já tem seu próprio checarSessao() que lida
    // com sessão ausente de verdade.
    let acesso = "admin";
    try {
      const profissional = await obterMeuProfissional();
      acesso = profissional?.acesso || "admin";
    } catch (err) {
      console.error("Erro ao obter papel do usuário:", err);
    }

    // Bloqueia acesso direto (por URL) a páginas restritas pro papel
    // "usuario". Isso é só uma trava de navegação — a proteção de
    // dados de verdade é a RLS do banco.
    const paginaAtual = window.location.pathname.split("/").pop();
    if (acesso === "usuario" && PAGINAS_RESTRITAS.includes(paginaAtual)) {
      window.location.href = "atendimentos.html";
      return;
    }

    injetarEstilosPapel();
    sidebarMount.classList.add("sidebar");
    sidebarMount.innerHTML = montarSidebarHtml(acesso);
    aplicarEstadoSidebar();
    marcarItemAtivo();
    wireLogout();
    wireModais();
    wireCollapseToggle();
    wireAparenciaSidebar();

    if (typeof lucide !== "undefined") {
      lucide.createIcons();
    }

    // Best-effort — se a sessão ainda não carregou, isso simplesmente
    // não preenche o nome ainda; cada página já chama de novo no seu
    // próprio fluxo de inicialização depois de checar a sessão.
    if (typeof carregarNomeBarbearia === "function") {
      carregarNomeBarbearia();
    }

    // Não bloqueia a própria página de Configurações — é lá que o usuário
    // vai clicar em "Assinar agora"/"Concluir configuração".
    if (paginaAtual !== "configuracoes.html") {
      checarStatusTeste();
    }

    iniciarOnboardingSePreciso();
  }

  document.addEventListener("DOMContentLoaded", iniciar);
})();