/* ============================================================
   CORTE CERTO — LEGAL.JS
   Scrollspy simples do sumário nas páginas de texto legal
   (Termos de Uso, Políticas e Privacidade).
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  const tocLinks = document.querySelectorAll(".legal-toc a");
  const sections = document.querySelectorAll(".legal-content section");
  if (!tocLinks.length || !sections.length) return;

  const linkFor = (id) => document.querySelector(`.legal-toc a[href="#${id}"]`);

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          tocLinks.forEach((a) => a.classList.remove("active"));
          const link = linkFor(entry.target.id);
          if (link) link.classList.add("active");
        }
      });
    },
    { rootMargin: "-30% 0px -60% 0px" },
  );

  sections.forEach((section) => observer.observe(section));
});
