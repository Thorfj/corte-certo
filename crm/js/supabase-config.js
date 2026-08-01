const SUPABASE_URL = "https://jzqiqrymqbzullysukja.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_lqY19MJcqfYcVAABzRgiNg_6h4DIWUO";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
);

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
