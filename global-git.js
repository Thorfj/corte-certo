(() => {
  const REPO = "/corte-certo";

  // Só executa no GitHub Pages
  if (window.location.hostname !== "thorfj.github.io") return;

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("a[href]").forEach((link) => {
      const href = link.getAttribute("href");

      if (!href) return;

      // Ignora links externos e especiais
      if (
        href.startsWith("http") ||
        href.startsWith("https") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("#") ||
        href.startsWith("javascript:")
      ) {
        return;
      }

      // Evita adicionar duas vezes
      if (href.startsWith(REPO)) return;

      // Apenas links absolutos do site
      if (href.startsWith("/")) {
        link.setAttribute("href", REPO + href);
      }
    });
  });
})();
