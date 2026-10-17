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

// ---------------- Esqueci minha senha ----------------
const loginForm = document.getElementById("login-form");
const esqueciForm = document.getElementById("esqueci-form");

function mostrarEsqueci(mostrar) {
  loginForm.hidden = mostrar;
  const blocoGoogle = document.getElementById("login-google");
  if (blocoGoogle) blocoGoogle.hidden = mostrar;
  esqueciForm.hidden = !mostrar;
  if (mostrar) {
    document.getElementById("email-recuperar").value =
      document.getElementById("email").value.trim();
  }
}

document.getElementById("link-esqueci").addEventListener("click", () => mostrarEsqueci(true));
document.getElementById("link-voltar").addEventListener("click", () => mostrarEsqueci(false));

esqueciForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email-recuperar").value.trim();
  const btn = document.getElementById("recuperar-btn");
  const errorEl = document.getElementById("recuperar-error");
  const okEl = document.getElementById("recuperar-ok");

  errorEl.style.display = "none";
  okEl.style.display = "none";
  btn.disabled = true;
  btn.textContent = "Enviando...";

  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + "/app/nova-senha/",
  });

  btn.disabled = false;
  btn.textContent = "Enviar link";

  if (error) {
    errorEl.textContent = error.status === 429
      ? "Muitas tentativas. Espere alguns minutos e tente de novo."
      : "Não foi possível enviar o link agora. Tente novamente.";
    errorEl.style.display = "block";
    return;
  }

  // Mesma resposta exista ou não a conta, pra não revelar quais e-mails são clientes
  okEl.textContent = "Pronto! Se esse e-mail tiver conta no Barbozap, o link chega em instantes. Confira também o spam.";
  okEl.style.display = "block";
});

// ---------------- Entrar com Google ----------------
document.getElementById("google-btn")?.addEventListener("click", async () => {
  const btn = document.getElementById("google-btn");
  const errorEl = document.getElementById("google-error");
  errorEl.style.display = "none";
  btn.disabled = true;

  // volta pra esta mesma tela (com o ?voltar=), que já redireciona quem tem sessão
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin + "/app/" + window.location.search },
  });

  if (error) {
    btn.disabled = false;
    errorEl.textContent = "Não foi possível abrir o login do Google agora. Tente de novo ou use e-mail e senha.";
    errorEl.style.display = "block";
  }
});

if (
  document.getElementById("google-error") &&
  new URLSearchParams(window.location.hash.replace(/^#/, "")).get("error_description")
) {
  const errorEl = document.getElementById("google-error");
  errorEl.textContent = "O login com o Google não foi concluído. Tente de novo.";
  errorEl.style.display = "block";
}
