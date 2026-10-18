/* ============================================================
   BARBOZAP — LANDING.JS
   Página pública da barbearia (barbozap.com.br/b/<link>).
   Lê só a função pagina_publica() do Supabase (chave pública).
   ============================================================ */

const SUPABASE_URL = "https://jzqiqrymqbzullysukja.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_lqY19MJcqfYcVAABzRgiNg_6h4DIWUO";

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0];

const moeda = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const escapar = (t) =>
  String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function lerSlug() {
  const doParametro = new URLSearchParams(window.location.search).get("s");
  const doCaminho = (window.location.pathname.match(/^\/b\/([a-z0-9-]+)\/?$/i) || [])[1];
  return String(doParametro || doCaminho || "").toLowerCase();
}

function duracaoTexto(min) {
  const m = Number(min) || 0;
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}h${String(m % 60).padStart(2, "0")}` : `${h}h`;
}

// "Aberto agora" / "Fechado agora" pelo horário de funcionamento
function situacaoAgora(horario) {
  if (!horario) return null;
  const agora = new Date();
  const faixa = horario[String(agora.getDay())];
  if (!Array.isArray(faixa)) return { aberto: false, texto: "Fechado hoje" };
  const hm = `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;
  const aberto = hm >= faixa[0] && hm < faixa[1];
  return { aberto, texto: aberto ? `Aberto agora · até ${faixa[1]}` : `Fechado agora · hoje das ${faixa[0]} às ${faixa[1]}` };
}

// Iniciais pro círculo do topo, sem "Barbearia", "do", "da"...
function iniciais(nome) {
  const palavras = String(nome || "").trim().split(/\s+/).filter(Boolean);
  const uteis = palavras.filter((w) => !/^(barbearia|barber|shop|do|da|de|dos|das)$/i.test(w));
  const base = uteis.length ? uteis : palavras;
  return base.slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "B";
}

function linkAgendar(pagina) {
  // Fase 1: abre o WhatsApp da barbearia e o bot atende por lá
  const numero = String(pagina.whatsapp || "").replace(/\D/g, "");
  if (!numero) return null;
  const texto = encodeURIComponent("Oi! Quero agendar um horário.");
  return `https://wa.me/${numero}?text=${texto}`;
}

function renderizar(p) {
  document.title = `${p.empresa} — Agende seu horário`;
  document.querySelector('meta[name="description"]').content =
    p.descricao || `Veja os serviços e agende seu horário na ${p.empresa}.`;

  document.getElementById("lp-avatar").textContent = iniciais(p.empresa);
  document.getElementById("lp-nome").textContent = p.empresa;
  const desc = document.getElementById("lp-descricao");
  desc.textContent = p.descricao || "";
  desc.classList.toggle("hidden", !p.descricao);

  // chips: aberto/fechado + Instagram
  const chips = [];
  const situacao = situacaoAgora(p.horario_funcionamento);
  if (situacao) {
    chips.push(`<span class="lp-chip ${situacao.aberto ? "aberto" : "fechado"}">${escapar(situacao.texto)}</span>`);
  }
  if (p.instagram) {
    const user = String(p.instagram).replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/.*$/, "");
    chips.push(`<a class="lp-chip" href="https://instagram.com/${encodeURIComponent(user)}" target="_blank" rel="noopener">@${escapar(user)}</a>`);
  }
  document.getElementById("lp-chips").innerHTML = chips.join("");

  // serviços
  const servicos = p.servicos || [];
  document.getElementById("lp-servicos").innerHTML = servicos.length
    ? servicos
        .map(
          (s) => `
      <li class="lp-servico">
        <div>
          <p class="lp-servico-nome">${escapar(s.nome)}</p>
          <p class="lp-servico-duracao">${duracaoTexto(s.duracao_min)}</p>
        </div>
        <p class="lp-servico-preco">${moeda(s.preco)}</p>
      </li>`,
        )
        .join("")
    : '<li class="lp-servico-vazio">Os serviços ainda estão sendo cadastrados.</li>';

  // horário de funcionamento (hoje em destaque)
  const hoje = new Date().getDay();
  const h = p.horario_funcionamento || {};
  document.getElementById("lp-horarios").innerHTML = ORDEM_DIAS.map((d) => {
    const faixa = h[String(d)];
    return `<li class="${d === hoje ? "hoje" : ""}">
      <span>${DIAS[d]}</span>
      <span>${Array.isArray(faixa) ? `${faixa[0]} às ${faixa[1]}` : "Fechado"}</span>
    </li>`;
  }).join("");

  // endereço
  if (p.endereco) {
    document.getElementById("lp-secao-endereco").classList.remove("hidden");
    document.getElementById("lp-endereco").textContent = p.endereco;
    document.getElementById("lp-mapa").href =
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.endereco)}`;
  }

  // botão de agendar
  const link = linkAgendar(p);
  if (link) {
    document.getElementById("lp-agendar").href = link;
    document.getElementById("lp-cta").classList.remove("hidden");
  }

  document.getElementById("lp-carregando").classList.add("hidden");
  document.getElementById("lp-conteudo").classList.remove("hidden");
}

function naoEncontrada() {
  document.title = "Página não encontrada — Barbozap";
  document.getElementById("lp-carregando").classList.add("hidden");
  document.getElementById("lp-vazio").classList.remove("hidden");
}

(async () => {
  const slug = lerSlug();
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return naoEncontrada();

  // mostra o endereço bonito (/b/<link>) mesmo quando veio pelo 404.html
  if (window.location.pathname !== `/b/${slug}`) {
    history.replaceState(null, "", `/b/${slug}`);
  }

  try {
    const cliente = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await cliente.rpc("pagina_publica", { p_slug: slug });
    if (error || !data) return naoEncontrada();
    renderizar(data);
  } catch (err) {
    console.error(err);
    naoEncontrada();
  }
})();
