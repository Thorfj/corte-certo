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
          <a href="https://wa.me/5541999428022" target="_blank">Falar no WhatsApp</a>
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

const script = document.createElement("script");
script.src = "/assets/js/pop-up.js";
script.defer = true; // opcional
document.head.appendChild(script);
