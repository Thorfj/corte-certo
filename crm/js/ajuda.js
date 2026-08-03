if (typeof lucide !== "undefined") {
  lucide.createIcons();
} else {
  console.error("Lucide não carregou — verifique a conexão com unpkg.com");
}

const buscaInput = document.getElementById("ajuda-busca-input");
const vazioEl = document.getElementById("ajuda-vazio");
const categorias = document.querySelectorAll(".ajuda-categoria");
const itens = document.querySelectorAll(".ajuda-item");

function filtrar() {
  const termo = buscaInput.value.trim().toLowerCase();
  let algumVisivel = false;

  categorias.forEach((categoria) => {
    let categoriaTemResultado = false;

    categoria.querySelectorAll(".ajuda-item").forEach((item) => {
      const texto = item.textContent.toLowerCase();
      const bate = !termo || texto.includes(termo);
      item.classList.toggle("hidden", !bate);
      item.open = !!termo && bate; // abre sozinho quando está buscando
      if (bate) categoriaTemResultado = true;
    });

    categoria.classList.toggle("hidden", !categoriaTemResultado);
    if (categoriaTemResultado) algumVisivel = true;
  });

  vazioEl.classList.toggle("hidden", algumVisivel);
}

buscaInput.addEventListener("input", filtrar);

async function checarSessaoAjuda() {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
  }
}

checarSessaoAjuda();
