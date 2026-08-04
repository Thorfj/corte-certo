/* ============================================================
   CORTE CERTO — EXIT-INTENT-POPUP.JS
   Pop-up de saída: convida o visitante a ver o bot funcionando
   no blog, antes de ele sair do site.

   COMO USAR:
   Inclua este script em QUALQUER página do site institucional,
   depois de global.js:

     <script src="../js/global.js"></script>
     <script src="../js/exit-intent-popup.js"></script>

   Ele se injeta sozinho (HTML + CSS) e usa os tokens de
   --cream/--green/--brick/--font-display etc. já definidos em
   global.css (com fallback embutido, caso rode em uma página
   sem esses tokens).

   COMPORTAMENTO:
   - Dispara no máximo 1 vez por sessão (sessionStorage).
   - Desktop: quando o mouse sai pela borda superior da janela
     (gesto clássico de "ir fechar a aba" ou "voltar").
   - Mobile: na primeira tentativa de usar o botão "voltar" do
     navegador (não existe "mouse saindo da tela" no celular).
   - Só arma os gatilhos alguns segundos depois do carregamento,
     pra não disparar por engano assim que a página abre.
   ============================================================ */

(function () {
  var STORAGE_KEY = "cc_exit_popup_shown";
  var ARM_DELAY_MS = 4000;
  var BLOG_POST_URL = "/website/html/blog-posts/veja-o-bot-funcionando.html";

  // já mostrado nesta sessão — não faz nada
  if (sessionStorage.getItem(STORAGE_KEY)) return;

  var armed = false;
  var shown = false;

  function injectStyles() {
    if (document.getElementById("cc-exit-popup-styles")) return;
    var style = document.createElement("style");
    style.id = "cc-exit-popup-styles";
    style.textContent =
      ".cc-exit-overlay{position:fixed;inset:0;background:rgba(14,47,39,.55);" +
      "display:flex;align-items:center;justify-content:center;z-index:9999;" +
      "padding:20px;opacity:0;pointer-events:none;transition:opacity .25s ease;}" +
      ".cc-exit-overlay.show{opacity:1;pointer-events:auto;}" +
      ".cc-exit-modal{background:var(--cream,#f6f1e7);border-radius:var(--radius,14px);" +
      "max-width:420px;width:100%;padding:36px 32px 32px;position:relative;" +
      "box-shadow:0 40px 80px -20px rgba(14,47,39,.4);" +
      "transform:translateY(12px) scale(.97);transition:transform .25s ease;" +
      "font-family:var(--font-body,'Inter',sans-serif);}" +
      ".cc-exit-overlay.show .cc-exit-modal{transform:translateY(0) scale(1);}" +
      ".cc-exit-close{position:absolute;top:14px;right:14px;width:30px;height:30px;" +
      "border-radius:50%;border:none;background:transparent;color:var(--muted,#726c5f);" +
      "font-size:20px;line-height:1;cursor:pointer;display:flex;align-items:center;" +
      "justify-content:center;transition:background .15s ease;}" +
      ".cc-exit-close:hover{background:rgba(0,0,0,.06);color:var(--ink,#24211d);}" +
      ".cc-exit-eyebrow{font-family:var(--font-mono,'JetBrains Mono',monospace);" +
      "font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;" +
      "color:var(--brick,#9b3b30);display:flex;align-items:center;gap:8px;margin-bottom:14px;}" +
      ".cc-exit-eyebrow::before{content:'';width:6px;height:6px;border-radius:50%;" +
      "background:var(--brick,#9b3b30);display:inline-block;}" +
      ".cc-exit-modal h2{font-family:var(--font-display,'Fraunces',serif);font-weight:500;" +
      "font-size:24px;line-height:1.25;color:var(--ink,#24211d);margin:0 0 12px;}" +
      ".cc-exit-modal p{font-size:14.5px;line-height:1.6;color:var(--muted,#726c5f);margin:0 0 24px;}" +
      ".cc-exit-phone-preview{background:#075e54;border-radius:10px;padding:10px 12px;" +
      "margin-bottom:22px;display:flex;align-items:center;gap:10px;}" +
      ".cc-exit-phone-preview .dot{width:26px;height:26px;border-radius:50%;" +
      "background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;" +
      "font-size:12px;font-family:var(--font-mono,monospace);color:#fff;flex:0 0 auto;}" +
      ".cc-exit-phone-preview .txt{color:#fff;font-size:12.5px;line-height:1.4;}" +
      ".cc-exit-actions{display:flex;flex-direction:column;gap:10px;}" +
      ".cc-exit-cta{background:var(--green,#17493c);color:#fff;text-align:center;" +
      "padding:13px 20px;border-radius:var(--radius-pill,999px);font-weight:600;" +
      "font-size:14.5px;text-decoration:none;display:block;border:1px solid var(--green,#17493c);" +
      "transition:background .15s ease,transform .15s ease;font-family:inherit;}" +
      ".cc-exit-cta:hover{background:var(--green-dark,#0e2f27);transform:translateY(-1px);}" +
      ".cc-exit-dismiss{background:none;border:none;color:var(--muted,#726c5f);font-size:13px;" +
      "cursor:pointer;text-align:center;padding:4px;text-decoration:underline;font-family:inherit;}" +
      ".cc-exit-dismiss:hover{color:var(--ink,#24211d);}" +
      "@media (max-width:520px){.cc-exit-modal{padding:28px 22px 24px;}.cc-exit-modal h2{font-size:20px;}}";
    document.head.appendChild(style);
  }

  function buildPopup() {
    var overlay = document.createElement("div");
    overlay.className = "cc-exit-overlay";
    overlay.id = "ccExitOverlay";
    overlay.innerHTML =
      '<div class="cc-exit-modal" role="dialog" aria-modal="true" aria-labelledby="ccExitTitle">' +
      '<button type="button" class="cc-exit-close" id="ccExitClose" aria-label="Fechar">&times;</button>' +
      '<span class="cc-exit-eyebrow">Antes de você ir</span>' +
      '<h2 id="ccExitTitle">Quer ver o bot marcando um horário sozinho?</h2>' +
      '<div class="cc-exit-phone-preview">' +
      '<span class="dot">CC</span>' +
      '<span class="txt">"Oi! Vi vocês no Instagram, será que tem horário essa semana? 💈"</span>' +
      "</div>" +
      "<p>Montamos uma simulação real do WhatsApp no blog: dá pra marcar um corte do começo ao fim, com o mesmo fluxo que roda de verdade. Leva menos de 1 minuto.</p>" +
      '<div class="cc-exit-actions">' +
      '<a class="cc-exit-cta" href="' +
      BLOG_POST_URL +
      '">Ver o bot funcionando →</a>' +
      '<button type="button" class="cc-exit-dismiss" id="ccExitDismiss">Não, obrigado</button>' +
      "</div>" +
      "</div>";
    document.body.appendChild(overlay);
    return overlay;
  }

  function showPopup() {
    if (shown) return;
    shown = true;
    sessionStorage.setItem(STORAGE_KEY, "1");
    injectStyles();
    var overlay = buildPopup();
    requestAnimationFrame(function () {
      overlay.classList.add("show");
    });

    function closePopup() {
      overlay.classList.remove("show");
      setTimeout(function () {
        overlay.remove();
      }, 250);
      document.removeEventListener("keydown", onKeydown);
    }
    function onKeydown(e) {
      if (e.key === "Escape") closePopup();
    }

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closePopup();
    });
    overlay.querySelector("#ccExitClose").addEventListener("click", closePopup);
    overlay
      .querySelector("#ccExitDismiss")
      .addEventListener("click", closePopup);
    document.addEventListener("keydown", onKeydown);
  }

  // ---------- gatilho desktop: mouse saindo pela borda superior ----------
  function onMouseOut(e) {
    if (!armed || shown) return;
    var y = e.clientY;
    if (y !== undefined && y <= 0 && !e.relatedTarget && !e.toElement) {
      showPopup();
    }
  }

  // ---------- gatilho mobile: primeira tentativa de "voltar" ----------
  function armMobileBackTrap() {
    try {
      history.pushState({ ccExitTrap: true }, "", location.href);
      window.addEventListener("popstate", function onPopState() {
        if (!shown) {
          showPopup();
          history.pushState({ ccExitTrap: true }, "", location.href);
        }
      });
    } catch (err) {
      /* alguns navegadores restringem pushState — falha silenciosa */
    }
  }

  function init() {
    setTimeout(function () {
      armed = true;
      document.addEventListener("mouseout", onMouseOut);
      armMobileBackTrap();
    }, ARM_DELAY_MS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
