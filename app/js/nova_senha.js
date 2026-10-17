// Página aberta pelo link do e-mail "Redefinir senha". O supabase-js lê o
// token da URL e cria uma sessão de recuperação; aqui só trocamos a senha.
const form = document.getElementById("nova-senha-form");
const aguarde = document.getElementById("nova-senha-aguarde");
const linkInvalido = document.getElementById("link-invalido");

function mostrarFormulario() {
  aguarde.hidden = true;
  linkInvalido.hidden = true;
  form.hidden = false;
}

supabaseClient.auth.onAuthStateChange((evento, session) => {
  if (session && (evento === "PASSWORD_RECOVERY" || evento === "SIGNED_IN")) {
    mostrarFormulario();
  }
});

// Se em alguns segundos não houver sessão, o link não vale mais
setTimeout(async () => {
  if (!form.hidden) return;
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  if (session) {
    mostrarFormulario();
  } else {
    aguarde.hidden = true;
    linkInvalido.hidden = false;
  }
}, 2500);

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const senha = document.getElementById("senha").value;
  const confirma = document.getElementById("senha-confirma").value;
  const btn = document.getElementById("nova-senha-btn");
  const errorEl = document.getElementById("nova-senha-error");
  const okEl = document.getElementById("nova-senha-ok");

  errorEl.style.display = "none";

  if (senha !== confirma) {
    errorEl.textContent = "As duas senhas não são iguais.";
    errorEl.style.display = "block";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Salvando...";

  const { error } = await supabaseClient.auth.updateUser({ password: senha });

  if (error) {
    btn.disabled = false;
    btn.textContent = "Salvar nova senha";
    errorEl.textContent = error.message.includes("different from the old")
      ? "A senha nova precisa ser diferente da antiga."
      : error.message.includes("at least")
        ? "A senha precisa ter pelo menos 6 caracteres."
        : "Não foi possível salvar a senha. Peça um link novo e tente de novo.";
    errorEl.style.display = "block";
    return;
  }

  okEl.textContent = "Senha alterada! Entrando no painel...";
  okEl.style.display = "block";
  setTimeout(() => {
    window.location.href = "/app/atendimentos/";
  }, 1200);
});
