const SUPABASE_URL = "https://jzqiqrymqbzullysukja.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_lqY19MJcqfYcVAABzRgiNg_6h4DIWUO";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
);

// ---------------- Sessão / barbearia do usuário logado ----------------
// Centralizado aqui porque essas três funções eram idênticas, copiadas e
// coladas em todos os .js de página (atendimentos, agenda, contatos,
// servicos, mensagens, relatorios, configuracoes, novo_atendimento).

async function checarSessao() {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return null;
  }
  return session;
}

let barbeariaIdCache = null;
async function obterBarbeariaId() {
  if (barbeariaIdCache) return barbeariaIdCache;
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  const { data, error } = await supabaseClient
    .from("profissionais")
    .select("barbearia_id")
    .eq("auth_user_id", user.id)
    .single();
  if (error) throw error;
  barbeariaIdCache = data.barbearia_id;
  return barbeariaIdCache;
}

async function carregarNomeBarbearia() {
  try {
    const barbeariaId = await obterBarbeariaId();
    const { data } = await supabaseClient
      .from("barbearias")
      .select("empresa")
      .eq("id", barbeariaId)
      .single();
    const logoNameEl = document.querySelector(".logo-name");
    if (data?.empresa && logoNameEl) {
      logoNameEl.textContent = data.empresa;
    }
  } catch (err) {
    console.error("Erro ao carregar nome da barbearia:", err);
  }
}

// ---------------- Tema (light/dark) ----------------
// Aplica na hora, a partir do cache local, pra tela não "piscar" clara
// antes de trocar pra escura enquanto a sessão ainda está carregando.
(function aplicarTemaCache() {
  const temaCache = localStorage.getItem("corteCerto:tema");
  if (temaCache === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  }
})();

// Busca o tema salvo em profissionais.tema pro usuário logado, aplica na
// tela e atualiza o cache local. Cada página chama isso depois de checar a
// sessão (ver checarSessao() de cada página).
async function aplicarTemaUsuario() {
  try {
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    if (!user) return;

    const { data, error } = await supabaseClient
      .from("profissionais")
      .select("tema")
      .eq("auth_user_id", user.id)
      .single();

    if (error || !data) return;

    const tema = data.tema === "dark" ? "dark" : "light";
    if (tema === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    localStorage.setItem("corteCerto:tema", tema);
  } catch (err) {
    console.error("Erro ao aplicar tema:", err);
  }
}
