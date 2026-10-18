/* ============================================================
   BARBOZAP — LANDING-PAGE.JS
   Aba "Landing page" do CRM: escolhe o link (barbozap.com.br/b/<slug>),
   a apresentação, o endereço e o Instagram, e publica a página.
   Serviços e horários a página pública lê direto do cadastro.
   ============================================================ */

if (typeof lucide !== "undefined") lucide.createIcons();

const SITE = "https://barbozap.com.br";
const SLUG_FORMATO = /^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$/;

let barbearia = null;
let slugSalvo = null;
let checagemSlug = 0;

// "Barbearia do João" -> "barbearia-do-joao"
function sugerirSlug(nome) {
  return String(nome || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}

function limparSlug(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 40);
}

function limparInstagram(valor) {
  return String(valor || "")
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "")
    .trim();
}

function linkDaPagina(slug) {
  return `${SITE}/b/${slug}`;
}

// ---------------- Link disponível? ----------------
function mostrarHintSlug(texto, tipo) {
  const hint = document.getElementById("lpc-slug-hint");
  hint.textContent = texto;
  hint.className = "field-hint" + (tipo ? ` lpc-hint-${tipo}` : "");
}

async function checarSlug() {
  const slug = document.getElementById("lpc-slug").value;
  const minha = ++checagemSlug;
  if (!slug) {
    mostrarHintSlug("Só letras minúsculas, números e hífen. Ex.: barbearia-do-joao");
    return false;
  }
  if (!SLUG_FORMATO.test(slug)) {
    mostrarHintSlug("Use de 3 a 40 caracteres: letras minúsculas, números e hífen (sem hífen no começo ou no fim).", "erro");
    return false;
  }
  if (slug === slugSalvo) {
    mostrarHintSlug("Este é o seu link atual.", "ok");
    return true;
  }
  const { data, error } = await supabaseClient.rpc("slug_disponivel", { p_slug: slug });
  if (minha !== checagemSlug) return false; // o usuário já digitou outra coisa
  if (error) {
    mostrarHintSlug("Não foi possível conferir agora. Tente salvar mesmo assim.");
    return true;
  }
  if (!data) {
    mostrarHintSlug("Esse link já está em uso. Tente outro.", "erro");
    return false;
  }
  mostrarHintSlug("Link disponível!", "ok");
  return true;
}

let timerSlug = null;
document.getElementById("lpc-slug").addEventListener("input", (e) => {
  const limpo = limparSlug(e.target.value);
  if (limpo !== e.target.value) e.target.value = limpo;
  clearTimeout(timerSlug);
  timerSlug = setTimeout(checarSlug, 400);
});

document.getElementById("lpc-descricao").addEventListener("input", (e) => {
  document.getElementById("lpc-descricao-cont").textContent = e.target.value.length;
});

// ---------------- Avisos ----------------
function mostrarAvisoBot() {
  const aviso = document.getElementById("lpc-aviso-bot");
  let texto = "";
  if (!barbearia.whatsapp_barbearia) {
    texto = 'O botão "Agendar horário" só aparece na página depois que o WhatsApp da barbearia for conectado em Configurações.';
  } else if (barbearia.status_fluxo !== "Sim") {
    texto = 'O bot está desligado: o botão "Agendar horário" leva o cliente ao WhatsApp da barbearia, mas ninguém responde automaticamente até você ligar o bot em Mensagens.';
  }
  aviso.textContent = texto;
  aviso.style.display = texto ? "block" : "none";
}

// ---------------- Divulgar (link + QR Code) ----------------
function mostrarDivulgar() {
  const publicada = barbearia.landing_publicada && slugSalvo;
  document.getElementById("lpc-divulgar-vazio").style.display = publicada ? "none" : "block";
  document.getElementById("lpc-divulgar-ok").style.display = publicada ? "block" : "none";
  if (!publicada) return;

  const url = linkDaPagina(slugSalvo);
  const link = document.getElementById("lpc-link");
  link.href = url;
  link.textContent = url.replace(/^https:\/\//, "");
  document.getElementById("lpc-abrir-btn").href = url;

  const qr = document.getElementById("lpc-qr");
  qr.innerHTML = "";
  if (typeof QRCode !== "undefined") {
    new QRCode(qr, {
      text: url,
      width: 200,
      height: 200,
      colorDark: "#1c1c1a",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M,
    });
  }
  document.getElementById("lpc-baixar-qr-btn").style.display =
    typeof QRCode !== "undefined" ? "" : "none";
}

document.getElementById("lpc-copiar-btn").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  const url = linkDaPagina(slugSalvo);
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    window.prompt("Copie o link:", url);
    return;
  }
  btn.innerHTML = '<i data-lucide="check"></i> Copiado!';
  lucide.createIcons();
  setTimeout(() => {
    btn.innerHTML = '<i data-lucide="copy"></i> Copiar link';
    lucide.createIcons();
  }, 2000);
});

document.getElementById("lpc-baixar-qr-btn").addEventListener("click", () => {
  const canvas = document.querySelector("#lpc-qr canvas");
  if (!canvas) return;
  // QR com margem branca, num tamanho bom pra imprimir
  const tamanho = 800;
  const margem = 64;
  const saida = document.createElement("canvas");
  saida.width = tamanho;
  saida.height = tamanho;
  const ctx = saida.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, tamanho, tamanho);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, margem, margem, tamanho - margem * 2, tamanho - margem * 2);
  const a = document.createElement("a");
  a.href = saida.toDataURL("image/png");
  a.download = `qrcode-${slugSalvo}.png`;
  a.click();
});

// ---------------- Carregar / salvar ----------------
async function carregar() {
  const barbeariaId = await obterBarbeariaId();
  const { data, error } = await supabaseClient
    .from("barbearias")
    .select("id, empresa, slug, landing_publicada, landing_descricao, endereco, instagram, whatsapp_barbearia, status_fluxo")
    .eq("id", barbeariaId)
    .single();
  if (error) throw error;
  barbearia = data;
  slugSalvo = data.slug;

  document.getElementById("lpc-slug").value = data.slug || sugerirSlug(data.empresa);
  document.getElementById("lpc-descricao").value = data.landing_descricao || "";
  document.getElementById("lpc-descricao-cont").textContent = (data.landing_descricao || "").length;
  document.getElementById("lpc-endereco").value = data.endereco || "";
  document.getElementById("lpc-instagram").value = data.instagram ? "@" + data.instagram : "";
  // primeira vez: já deixa marcado pra publicar
  document.getElementById("lpc-publicada").checked = data.slug ? !!data.landing_publicada : true;

  mostrarAvisoBot();
  mostrarDivulgar();
  checarSlug();
}

document.getElementById("lpc-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const erroEl = document.getElementById("lpc-erro");
  const okEl = document.getElementById("lpc-sucesso");
  const btn = document.getElementById("lpc-salvar-btn");
  erroEl.style.display = "none";
  okEl.style.display = "none";

  const slug = document.getElementById("lpc-slug").value;
  if (!(await checarSlug())) {
    erroEl.textContent = "Escolha um endereço válido e disponível para a página.";
    erroEl.style.display = "block";
    return;
  }

  const dados = {
    slug,
    landing_descricao: document.getElementById("lpc-descricao").value.trim() || null,
    endereco: document.getElementById("lpc-endereco").value.trim() || null,
    instagram: limparInstagram(document.getElementById("lpc-instagram").value) || null,
    landing_publicada: document.getElementById("lpc-publicada").checked,
  };

  btn.disabled = true;
  btn.textContent = "Salvando...";
  const { error } = await supabaseClient.from("barbearias").update(dados).eq("id", barbearia.id);
  btn.disabled = false;
  btn.textContent = "Salvar";

  if (error) {
    console.error(error);
    erroEl.textContent =
      error.code === "23505"
        ? "Esse link acabou de ser usado por outra barbearia. Tente outro."
        : error.code === "23514"
          ? "Esse endereço não pode ser usado. Tente outro."
          : "Não foi possível salvar agora. Tente de novo.";
    erroEl.style.display = "block";
    return;
  }

  Object.assign(barbearia, dados);
  slugSalvo = slug;
  document.getElementById("lpc-instagram").value = dados.instagram ? "@" + dados.instagram : "";
  okEl.textContent = dados.landing_publicada ? "Página salva e publicada." : "Página salva (não publicada).";
  okEl.style.display = "block";
  mostrarHintSlug("Este é o seu link atual.", "ok");
  mostrarDivulgar();
});

// ---------------- Início ----------------
(async () => {
  try {
    const session = await checarSessao();
    if (!session) return;
    await aplicarTemaUsuario();
    await carregarNomeBarbearia();
    await carregar();
  } catch (err) {
    console.error(err);
    const erroEl = document.getElementById("lpc-erro");
    erroEl.textContent = "Não foi possível carregar a página agora.";
    erroEl.style.display = "block";
  }
})();
