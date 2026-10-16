document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const btn = document.getElementById("login-btn");
  const errorEl = document.getElementById("login-error");

  errorEl.style.display = "none";
  btn.disabled = true;
  btn.textContent = "Entrando...";

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    errorEl.textContent = "E-mail ou senha inválidos.";
    errorEl.style.display = "block";
    btn.disabled = false;
    btn.textContent = "Entrar";
    return;
  }

  window.location.href = destinoPosLogin();
});

(async () => {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  if (session) window.location.href = destinoPosLogin();
})();

// Volta para a página que pediu o login (?voltar=), só se for do próprio CRM
function destinoPosLogin() {
  const voltar = new URLSearchParams(window.location.search).get("voltar");
  if (voltar && voltar.startsWith("/app/") && !voltar.startsWith("//")) return voltar;
  return "/app/atendimentos/";
}
