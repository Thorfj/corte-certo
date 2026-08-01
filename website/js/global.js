/* ============================================================
   CORTE CERTO — GLOBAL.JS
   Header e footer globais do site.
   Toda página deve ter:
     <header><div id="site-header"></div></header>
     <footer id="contato"><div id="site-footer"></div></footer>
   e importar este script (antes de qualquer script específico da página).
   ============================================================ */

(function () {
  const HEADER_HTML = `
    <div class="nav">
      <a href="/website/html/index.html" class="brand"><span class="badge">CC</span> Corte Certo</a>
      <nav class="nav-links">
        <a href="/website/html/index.html#como-funciona">Como funciona</a>
        <a href="/website/html/index.html#planos">Planos</a>
        <a href="/website/html/blog.html">Blog</a>
        <a href="/website/html/quem-somos.html">Quem somos</a>
        <a href="#contato">Contato</a>
      </nav>
      <div class="nav-actions">
        <a href="/crm/html/login.html" class="nav-login">Entrar</a>
        <a href="/website/html/teste-gratis.html" class="nav-cta">Teste grátis</a>
      </div>
      <button class="nav-toggle" aria-label="Abrir menu">☰</button>
    </div>
  `;

  const FOOTER_HTML = `
    <div class="wrap">
      <div class="foot-grid">
        <div class="foot-brand">
          <a href="/website/html/index.html" class="brand"><span class="badge">CC</span> Corte Certo</a>
          <p>O CRM que atende, agenda e faz follow-up com seus clientes direto no WhatsApp.</p>
        </div>
        <div class="foot-col">
          <h5>Produto</h5>
          <a href="/website/html/index.html#como-funciona">Como funciona</a>
          <a href="/website/html/index.html#planos">Planos</a>
          <a href="/website/html/teste-gratis.html">Teste grátis</a>
        </div>
        <div class="foot-col">
          <h5>Empresa</h5>
          <a href="/website/html/quem-somos.html">Quem somos</a>
          <a href="/website/html/blog.html">Blog</a>
          <a href="https://wa.me/5541999990000" target="_blank">Falar no WhatsApp</a>
        </div>
        <div class="foot-col">
          <h5>Legal</h5>
          <a href="/website/html/politicas.html">Políticas e Privacidade</a>
          <a href="/website/html/termos-de-uso.html">Termos de Uso</a>
        </div>
      </div>
      <div class="foot-bottom">
        <span>© 2026 Corte Certo. Todos os direitos reservados.</span>
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
