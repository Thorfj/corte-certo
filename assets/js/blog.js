/* ============================================================
   BARBOZAP — BLOG.JS
   Monta a listagem do blog (destaque + grid) a partir de
   posts-data.js, e cuida do filtro por categoria.
   Depende de posts-data.js (importar ANTES deste script).
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  const featuredMount = document.getElementById("featuredMount");
  const gridMount = document.getElementById("gridMount");
  if (typeof BLOG_POSTS === "undefined" || (!featuredMount && !gridMount))
    return;

  const postUrl = (slug) => `/blog/${slug}/`;

  // capa: listras da categoria de fundo + foto por cima (se o post tiver)
  function coverHTML(post, sizes) {
    const img = post.image
      ? `<img class="post-cover-img" src="${post.image}-640.jpg"
           srcset="${post.image}-640.jpg 640w, ${post.image}-1280.jpg 1280w"
           sizes="${sizes}" alt="" loading="lazy">`
      : "";
    return `<div class="post-cover cat-${post.category}">${img}<span>${post.categoryLabel}</span></div>`;
  }

  function featuredCardHTML(post) {
    return `
      <a href="${postUrl(post.slug)}" class="featured-card" data-category="${post.category}">
        ${coverHTML(post, "(max-width: 960px) 100vw, 560px")}
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
        ${coverHTML(post, "(max-width: 520px) 100vw, (max-width: 960px) 50vw, 380px")}
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

      // Sem o destaque visível, a seção dele não deixa um vão vazio
      const secaoDestaque = featuredMount && featuredMount.closest(".blog-featured");
      const destaque = featuredMount && featuredMount.querySelector("[data-category]");
      if (secaoDestaque) {
        secaoDestaque.style.display =
          destaque && destaque.style.display !== "none" ? "" : "none";
      }
    });
  });
});
