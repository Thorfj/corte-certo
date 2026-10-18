/* ============================================================
   BARBOZAP — CRM-GLOBAL.JS
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
    { page: "atendimentos", icon: "clipboard-list", label: "Atendimentos", restrito: false },
    { page: "agenda", icon: "calendar", label: "Agenda", restrito: false },
    { page: "contatos", icon: "users", label: "Contatos", restrito: false },
    { page: "servicos", icon: "scissors", label: "Serviços", restrito: true },
    { page: "mensagens", icon: "message-square", label: "Mensagens", restrito: true },
    { page: "financeiro", icon: "wallet", label: "Financeiro", restrito: true },
    { page: "relatorios", icon: "pie-chart", label: "Relatórios", restrito: true },
    { page: "landing-page", icon: "globe", label: "Landing page", restrito: true },
    { page: "configuracoes", icon: "settings", label: "Configurações", restrito: true },
  ];
  const PAGINAS_RESTRITAS = NAV_ITEMS.filter((i) => i.restrito).map((i) => i.page);

  function montarNavHtml(acesso) {
    const itensVisiveis = NAV_ITEMS.filter((i) => acesso === "admin" || !i.restrito);
    return itensVisiveis
      .map(
        (i) => `
      <a class="nav-item${i.emBreve ? " nav-em-breve" : ""}" data-page="${i.page}" href="/app/${i.page}/"${i.emBreve ? ' title="Em breve"' : ""}><i data-lucide="${i.icon}"></i> <span class="nav-label">${i.label}</span>${i.emBreve ? '<i data-lucide="lock" class="nav-cadeado"></i>' : ""}</a>
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
      <a class="help-button" href="/app/ajuda/"><i data-lucide="help-circle" style="width:16px;height:16px"></i></a>
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
      .nav-em-breve { opacity: 0.75; }
      .nav-item .nav-cadeado { width: 13px !important; height: 13px; margin-left: auto; color: var(--text-muted); }
      .sidebar.collapsed .nav-cadeado { display: none; }
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
    const paginaAtual = window.location.pathname.split("/").filter(Boolean).pop();
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
      window.location.href = "/app/";
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
        <p class="trial-block-desc">Assine o plano do Barbozap pra continuar usando o CRM.</p>
        <a class="btn btn-primary" href="/app/pagamentos/?pagar=1">Assinar agora</a>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  function criarBanner(texto, tipo) {
    const banner = document.createElement("div");
    banner.className = `trial-banner trial-banner-${tipo}`;
    banner.innerHTML = `<span>${texto}</span> <a href="/app/pagamentos/?pagar=1">Assinar agora</a>`;
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

  // ---------------- Primeiros passos (Atendimentos, só admin) ----------------
  // Checklist que se marca sozinho conforme o dono configura a barbearia.
  // Some quando os passos obrigatórios estão feitos (ou quando a pessoa fecha).
  const WHATSAPP_STATUS_URL = "https://cortecerto.app.n8n.cloud/webhook/whatsapp-conexao";
  const HORARIO_PADRAO_JSON = JSON.stringify({
    0: null, 1: ["09:00", "19:00"], 2: ["09:00", "19:00"], 3: ["09:00", "19:00"],
    4: ["09:00", "19:00"], 5: ["09:00", "19:00"], 6: ["09:00", "19:00"],
  });

  function lerLocal(chave) {
    try {
      return localStorage.getItem(chave);
    } catch {
      return null;
    }
  }

  async function whatsappConectado() {
    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      const resp = await fetch(WHATSAPP_STATUS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ acao: "status" }),
      });
      const dados = await resp.json().catch(() => ({}));
      return dados.estado === "open";
    } catch {
      return false;
    }
  }

  async function montarPrimeirosPassos(acesso) {
    const paginaAtual = window.location.pathname.split("/").filter(Boolean).pop();
    if (paginaAtual !== "atendimentos" || acesso !== "admin") return;

    let barbeariaId;
    try {
      barbeariaId = await obterBarbeariaId();
    } catch {
      return;
    }
    const chaveOculto = `barbozap:primeirosPassosOcultos:${barbeariaId}`;
    if (lerLocal(chaveOculto) === "1") return;

    const [barbRes, servRes, profRes, whatsapp] = await Promise.all([
      supabaseClient
        .from("barbearias")
        .select("status_fluxo, horario_funcionamento, google_calendar_status")
        .eq("id", barbeariaId)
        .single(),
      supabaseClient.from("servicos").select("id", { count: "exact", head: true }).eq("barbearia_id", barbeariaId),
      supabaseClient
        .from("profissionais")
        .select("id", { count: "exact", head: true })
        .eq("barbearia_id", barbeariaId)
        .is("removido_em", null),
      whatsappConectado(),
    ]);
    const b = barbRes.data || {};

    const horarioFeito =
      lerLocal(`barbozap:horarioConferido:${barbeariaId}`) === "1" ||
      (b.horario_funcionamento && JSON.stringify(b.horario_funcionamento) !== HORARIO_PADRAO_JSON);

    const passos = [
      { feito: whatsapp, titulo: "Conectar o WhatsApp da barbearia", dica: "Leia o QR Code com o celular do número da barbearia.", link: "/app/configuracoes/#card-whatsapp" },
      { feito: horarioFeito, titulo: "Conferir o horário de funcionamento", dica: "O bot só oferece horários dentro dele.", link: "/app/configuracoes/#card-horario" },
      { feito: (servRes.count || 0) > 0, titulo: "Cadastrar os serviços", dica: "Nome, preço, duração e de quanto em quanto tempo o cliente volta.", link: "/app/servicos/" },
      { feito: (profRes.count || 0) > 1, opcional: true, titulo: "Cadastrar a equipe", dica: "Se mais alguém atende, cadastre em Usuários. Se é só você, pode pular.", link: "/app/configuracoes/?aba=usuarios" },
      { feito: b.google_calendar_status === "conectado", opcional: true, titulo: "Conectar o Google Agenda", dica: "Os horários aparecem no Google Agenda de cada profissional.", link: "/app/configuracoes/#card-google" },
      { feito: b.status_fluxo === "Sim", titulo: "Ligar o bot", dica: "Em Mensagens, ative o fluxo. Seus 14 dias grátis começam aqui.", link: "/app/mensagens/" },
    ];

    const obrigatorios = passos.filter((p) => !p.opcional);
    if (obrigatorios.every((p) => p.feito)) return;
    const feitos = passos.filter((p) => p.feito).length;

    const card = document.createElement("section");
    card.className = "primeiros-passos card";
    card.innerHTML = `
      <div class="pp-topo">
        <div>
          <p class="pp-titulo">Primeiros passos</p>
          <p class="pp-sub">${feitos} de ${passos.length} concluídos · deixe o bot pronto para atender</p>
        </div>
        <button type="button" class="pp-fechar" title="Esconder">&times;</button>
      </div>
      <div class="pp-barra"><span style="width:${Math.round((feitos / passos.length) * 100)}%"></span></div>
      <ol class="pp-lista">
        ${passos
          .map(
            (p) => `
          <li class="pp-item${p.feito ? " feito" : ""}">
            <span class="pp-check">${p.feito ? "✓" : ""}</span>
            <div class="pp-texto">
              <p class="pp-item-titulo">${p.titulo}${p.opcional ? ' <span class="pp-opcional">opcional</span>' : ""}</p>
              ${p.feito ? "" : `<p class="pp-item-dica">${p.dica}</p>`}
            </div>
            ${p.feito ? "" : `<a class="btn btn-sm" href="${p.link}">Fazer</a>`}
          </li>`,
          )
          .join("")}
      </ol>
    `;
    card.querySelector(".pp-fechar").addEventListener("click", () => {
      try {
        localStorage.setItem(chaveOculto, "1");
      } catch {
        // sem localStorage: só esconde nesta visita
      }
      card.remove();
    });

    const header = document.querySelector(".main-content .page-header");
    if (header) header.after(card);
    else document.querySelector(".main-content")?.prepend(card);
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

    function mostrarPasso(tentativa = 0) {
      limparPasso();
      const passo = passos[indice];
      const alvo = document.querySelector(passo.selector);

      if (!elementoVisivel(alvo)) {
        // alguns cartões só aparecem depois que os dados carregam: espera um pouco
        if (tentativa < 8) {
          setTimeout(() => mostrarPasso(tentativa + 1), 300);
          return;
        }
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
    const pagina = window.location.pathname.split("/").filter(Boolean).pop();
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

  // ---------------- Menu no celular (gaveta) ----------------
  // Até 900px o menu lateral fica escondido; a barra do topo tem o botão ☰
  // que abre a gaveta por cima do conteúdo (CSS em responsivo.css).
  function montarMenuCelular(sidebar) {
    const main = document.querySelector(".main-content");
    if (!main || document.querySelector(".mobile-topbar")) return;

    const topbar = document.createElement("div");
    topbar.className = "mobile-topbar";
    topbar.innerHTML = `
      <button type="button" class="mobile-menu-btn" aria-label="Abrir menu">☰</button>
      <span class="mobile-topbar-nome">Barbozap</span>
    `;
    main.parentNode.insertBefore(topbar, main);

    const fundo = document.createElement("div");
    fundo.className = "sidebar-backdrop";
    document.body.appendChild(fundo);

    const abrir = () => {
      sidebar.classList.add("aberta");
      fundo.classList.add("visivel");
    };
    const fechar = () => {
      sidebar.classList.remove("aberta");
      fundo.classList.remove("visivel");
    };
    topbar.querySelector(".mobile-menu-btn").addEventListener("click", abrir);
    fundo.addEventListener("click", fechar);
    sidebar.addEventListener("click", (e) => {
      if (e.target.closest("a.nav-item")) fechar();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") fechar();
    });
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
    const paginaAtual = window.location.pathname.split("/").filter(Boolean).pop();
    if (acesso === "usuario" && PAGINAS_RESTRITAS.includes(paginaAtual)) {
      window.location.href = "/app/atendimentos/";
      return;
    }

    injetarEstilosPapel();
    sidebarMount.classList.add("sidebar");
    sidebarMount.innerHTML = montarSidebarHtml(acesso);
    montarMenuCelular(sidebarMount);
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

    // Não bloqueia Configurações ("Concluir configuração") nem Pagamentos
    // (é lá que o usuário paga pra liberar o CRM de novo).
    if (paginaAtual !== "configuracoes" && paginaAtual !== "pagamentos") {
      checarStatusTeste();
    }

    iniciarOnboardingSePreciso();
    montarPrimeirosPassos(acesso);
  }

  document.addEventListener("DOMContentLoaded", iniciar);
})();