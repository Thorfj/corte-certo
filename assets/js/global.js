/* ============================================================
   BARBOZAP — GLOBAL.JS
   Header e footer globais do site.
   Toda página deve ter:
     <header><div id="site-header"></div></header>
     <footer id="contato"><div id="site-footer"></div></footer>
   e importar este script (antes de qualquer script específico da página).
   ============================================================ */

window.BASE = "";

(function () {
  const HEADER_HTML = `
    <div class="nav">
      <a href="${BASE}/" class="brand"><span class="badge">BZ</span> Barbozap</a>
      <nav class="nav-links">
        <a href="${BASE}/#como-funciona">Como funciona</a>
        <a href="${BASE}/#planos">Planos</a>
        <a href="${BASE}/blog/">Blog</a>

      </nav>
      <div class="nav-actions">
        <a href="${BASE}/app/" class="nav-login">Entrar</a>
        <a href="${BASE}/teste-gratis/" class="nav-cta">Teste grátis</a>
      </div>
      <button class="nav-toggle" aria-label="Abrir menu">☰</button>
    </div>
  `;

  const FOOTER_HTML = `
    <div class="wrap">
      <div class="foot-grid">
        <div class="foot-brand">
          <a href="${BASE}/" class="brand"><span class="badge">BZ</span> Barbozap</a>
          <p>O CRM que atende, agenda e faz follow-up com seus clientes direto no WhatsApp.</p>
        </div>
        <div class="foot-col">
          <h5>Produto</h5>
          <a href="${BASE}/#como-funciona">Como funciona</a>
          <a href="${BASE}/#planos">Planos</a>
          <a href="${BASE}/teste-gratis/">Teste grátis</a>
        </div>
        <div class="foot-col">
          <h5>Empresa</h5>
          <a href="${BASE}/blog/">Blog</a>
          <a href="https://wa.me/554137952535" target="_blank">Falar no WhatsApp</a>
        </div>
        <div class="foot-col">
          <h5>Legal</h5>
          <a href="${BASE}/privacidade/">Políticas e Privacidade</a>
          <a href="${BASE}/termos-de-uso/">Termos de Uso</a>
        </div>
      </div>
      <div class="foot-bottom">
        <span>© 2026 Barbozap. Todos os direitos reservados.</span>
        <span class="mono">feito para barbearias</span>
      </div>
    </div>
  `;

  function initMobileMenu() {
    const navToggle = document.querySelector(".nav-toggle");
    const navLinks = document.querySelector(".nav-links");
    if (!navToggle || !navLinks) return;

    navToggle.addEventListener("click", () =>
      navLinks.classList.toggle("open"),
    );
    navLinks.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => navLinks.classList.remove("open"));
    });
  }

  function injectLayout() {
    const headerMount = document.getElementById("site-header");
    const footerMount = document.getElementById("site-footer");

    if (headerMount) headerMount.innerHTML = HEADER_HTML;
    if (footerMount) footerMount.innerHTML = FOOTER_HTML;

    initMobileMenu();
  }

  document.addEventListener("DOMContentLoaded", injectLayout);
})();

/* ------------------------------------------------------------
   Black Friday 2026: conta criada até 30/11 ganha 30 dias grátis
   (se ligar o bot até 15/12). Em 1º/12 o site volta sozinho aos
   14 dias: os textos originais ficam no HTML e a versão da Black
   Friday fica no atributo data-bf.
   ------------------------------------------------------------ */
(function () {
  var FIM = Date.parse("2026-12-01T00:00:00-03:00");
  if (Date.now() >= FIM) return;

  function aplicar() {
    document.documentElement.classList.add("black-friday");
    document.querySelectorAll("[data-bf]").forEach(function (el) {
      el.innerHTML = el.getAttribute("data-bf");
    });
    if (!document.querySelector(".bf-bar")) {
      var bar = document.createElement("a");
      bar.className = "bf-bar";
      bar.href = "/teste-gratis/?utm_source=site&utm_campaign=black-friday";
      bar.innerHTML =
        '<span class="bf-tag">Black Friday</span>' +
        '<span class="bf-texto">Crie sua conta até <strong>30/11</strong> e ganhe <strong>30 dias grátis</strong> no Barbozap</span>' +
        '<span class="bf-seta" aria-hidden="true">→</span>';
      document.body.prepend(bar);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", aplicar);
  } else {
    aplicar();
  }
})();

const script = document.createElement("script");
script.src = "/assets/js/pop-up.js";
script.defer = true; // opcional
document.head.appendChild(script);
