/* ============================================================
   CENTRAL INTERNA — LOGIN-INTERNO.JS
   ============================================================ */

function mostrarErroFatal(mensagem) {
  const banner = document.createElement("div");
  banner.style.cssText =
    "position:fixed;top:0;left:0;right:0;z-index:9999;background:#b3261e;" +
    "color:#fff;padding:12px 20px;font-family:sans-serif;font-size:13.5px;" +
    "text-align:center;";
  banner.textContent = "Erro: " + mensagem;
  document.body.prepend(banner);
  console.error(mensagem);
}

if (typeof window.supabase === "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    mostrarErroFatal(
      "A biblioteca do Supabase não carregou (cdn.jsdelivr.net bloqueado, offline, ou sem internet). Confira sua conexão e recarregue a página.",
    );
  });
  throw new Error("supabase-js não carregado — abortando login-interno.js");
}

// Mesmas credenciais do projeto já usado no site/CRM.
const SUPABASE_URL = "https://jzqiqrymqbzullysukja.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_lqY19MJcqfYcVAABzRgiNg_6h4DIWUO";
const supabaseCentral = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
);

// Central e este login ficam na mesma pasta.
const CENTRAL_URL = "central.html";

document
  .getElementById("loginInternoForm")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const btn = document.getElementById("loginBtn");
    const errorEl = document.getElementById("loginError");

    errorEl.classList.remove("show");
    btn.disabled = true;
    btn.textContent = "Entrando...";

    try {
      const { data, error } = await supabaseCentral.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        errorEl.textContent = "E-mail ou senha inválidos.";
        errorEl.classList.add("show");
        return;
      }

      // login funcionou, mas só deixa passar se estiver na equipe_interna
      const { data: membro, error: erroMembro } = await supabaseCentral
        .from("equipe_interna")
        .select("nome")
        .eq("auth_user_id", data.user.id)
        .maybeSingle();

      if (erroMembro || !membro) {
        await supabaseCentral.auth.signOut();
        errorEl.textContent = "Este e-mail não tem acesso à Central Interna.";
        errorEl.classList.add("show");
        return;
      }

      window.location.href = CENTRAL_URL;
    } catch (err) {
      mostrarErroFatal("Falha ao entrar — " + (err.message || err));
    } finally {
      btn.disabled = false;
      btn.textContent = "Entrar";
    }
  });

// já logado? pula direto pra Central
(async () => {
  try {
    const {
      data: { session },
    } = await supabaseCentral.auth.getSession();
    if (session) window.location.href = CENTRAL_URL;
  } catch (err) {
    console.error(err);
  }
})();
