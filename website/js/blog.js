/* ============================================================
   CORTE CERTO — BLOG.JS
   Monta a listagem do blog (destaque + grid) a partir de
   posts-data.js, e cuida do filtro por categoria.
   Depende de posts-data.js (importar ANTES deste script).
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  const featuredMount = document.getElementById("featuredMount");
  const gridMount = document.getElementById("gridMount");
  if (typeof BLOG_POSTS === "undefined" || (!featuredMount && !gridMount))
    return;

  const postUrl = (slug) => `/website/html/blog-posts/${slug}.html`;

  function featuredCardHTML(post) {
    return `
      <a href="${postUrl(post.slug)}" class="featured-card" data-category="${post.category}">
        <div class="post-cover cat-${post.category}"><span>${post.categoryLabel}</span></div>
        <div class="featured-body">
          <span class="post-meta">${post.date} · ${post.readTime}</span>
          <h2>${post.title}</h2>
          <p>${post.excerpt}</p>
          <span class="read-more">Ler artigo →</span>
        </div>
      </a>
    `;
  }

  function cardHTML(post) {
    return `
      <a href="${postUrl(post.slug)}" class="post-card" data-category="${post.category}">
        <div class="post-cover-${post.category}"><span>${post.categoryLabel}</span></div>
        <div class="post-body">
          <span class="post-meta">${post.date} · ${post.readTime}</span>
          <h3>${post.title}</h3>
          <p>${post.excerpt}</p>
          <span class="read-more">Ler artigo →</span>
        </div>
      </a>
    `;
  }

  const featured = BLOG_POSTS.find((p) => p.featured);
  const others = BLOG_POSTS.filter((p) => !p.featured);

  if (featuredMount && featured) {
    featuredMount.innerHTML = featuredCardHTML(featured);
  }
  if (gridMount) {
    gridMount.innerHTML = others.map(cardHTML).join("");
  }

  // filtro por categoria (roda depois da renderização acima)
  const chips = document.querySelectorAll(".blog-chip");
  const cards = document.querySelectorAll("[data-category]");

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");

      const filter = chip.dataset.filter;
      cards.forEach((card) => {
        const show = filter === "todos" || card.dataset.category === filter;
        card.style.display = show ? "" : "none";
      });
    });
  });
});
