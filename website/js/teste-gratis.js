/* ============================================================
   CORTE CERTO — TESTE-GRATIS.JS
   Formulário de cadastro em 2 steps:
     Step 1 — dados da barbearia e do responsável
     Step 2 — WhatsApp da barbearia (whatsapp_barbearia),
              que precisa ser ÚNICO na tabela `barbearias`.
              Se já existir -> bloqueia.
              Se for novo    -> insere e libera acesso ao CRM.

   Credenciais do Supabase já preenchidas (mesmo projeto do CRM).
   A checagem de duplicidade + o insert acontecem dentro da function
   `cadastrar_barbearia` (ver /sql/cadastrar_barbearia.sql) — o front
   nunca lê/escreve na tabela `barbearias` diretamente.
   Falta só confirmar/ajustar CRM_ATENDIMENTOS_URL abaixo.
   ============================================================ */

// Credenciais do projeto Supabase (mesmas usadas no CRM)
const SUPABASE_URL = "https://jzqiqrymqbzullysukja.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_lqY19MJcqfYcVAABzRgiNg_6h4DIWUO";

// TODO: confirmar a URL real da página de atendimentos do CRM
const CRM_ATENDIMENTOS_URL = "/crm/html/atendimentos.html";

// TODO: ajustar se quiser outro contato de suporte
const SUPORTE_WHATSAPP_URL = "https://wa.me/5541999990000";

document.addEventListener("DOMContentLoaded", () => {
  const step1Form = document.getElementById("tgFormStep1");
  const step2Form = document.getElementById("tgFormStep2");
  const success = document.getElementById("tgSuccess");
  const dotStep1 = document.getElementById("dotStep1");
  const dotStep2 = document.getElementById("dotStep2");
  const backBtn = document.getElementById("tgBack");
  const errorBox = document.getElementById("tgError");
  const step2Submit = document.getElementById("tgStep2Submit");

  const whatsappInput = document.getElementById("whatsapp");
  const whatsappBarbeariaInput = document.getElementById("whatsappBarbearia");

  if (!step1Form || !step2Form) return;

  // aceita só números nos campos de WhatsApp
  [whatsappInput, whatsappBarbeariaInput].forEach((input) => {
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "");
    });
  });

  // dados coletados no Step 1, guardados em memória até o Step 2 confirmar
  let step1Data = null;

  let supabaseClient = null;
  function getSupabaseClient() {
    if (supabaseClient) return supabaseClient;
    if (typeof window.supabase === "undefined") {
      console.error(
        "supabase-js não carregou. Confira o <script> do CDN em teste-gratis.html.",
      );
      return null;
    }
    supabaseClient = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
    );
    return supabaseClient;
  }

  function showError(message) {
    errorBox.innerHTML = message;
    errorBox.hidden = false;
  }
  function hideError() {
    errorBox.hidden = true;
    errorBox.innerHTML = "";
  }

  // ---------- STEP 1 -> STEP 2 ----------
  step1Form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!step1Form.checkValidity()) {
      step1Form.reportValidity();
      return;
    }
    if (whatsappInput.value.length < 10) {
      whatsappInput.focus();
      whatsappInput.setCustomValidity(
        "Informe o WhatsApp com DDD (mínimo 10 dígitos).",
      );
      step1Form.reportValidity();
      whatsappInput.setCustomValidity("");
      return;
    }

    step1Data = {
      empresa: document.getElementById("barbearia").value.trim(),
      nome: document.getElementById("responsavel").value.trim(),
      whatsapp: whatsappInput.value,
      email: document.getElementById("email").value.trim(),
      tipo: "Barbearia",
    };

    step1Form.hidden = true;
    step2Form.hidden = false;
    dotStep1.classList.remove("active");
    dotStep2.classList.add("active");
    whatsappBarbeariaInput.focus();
  });

  // ---------- VOLTAR pro Step 1 ----------
  backBtn.addEventListener("click", () => {
    hideError();
    step2Form.hidden = true;
    step1Form.hidden = false;
    dotStep2.classList.remove("active");
    dotStep1.classList.add("active");
  });

  // ---------- STEP 2: valida unicidade + insere + libera acesso ----------
  step2Form.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideError();

    if (!step2Form.checkValidity()) {
      step2Form.reportValidity();
      return;
    }
    if (whatsappBarbeariaInput.value.length < 10) {
      whatsappBarbeariaInput.focus();
      whatsappBarbeariaInput.setCustomValidity(
        "Informe o WhatsApp com DDD (mínimo 10 dígitos).",
      );
      step2Form.reportValidity();
      whatsappBarbeariaInput.setCustomValidity("");
      return;
    }

    const whatsappBarbearia = whatsappBarbeariaInput.value;
    const supabase = getSupabaseClient();
    if (!supabase) {
      showError(
        "Não foi possível conectar ao servidor agora. Tente novamente em instantes.",
      );
      return;
    }

    step2Submit.disabled = true;
    step2Submit.textContent = "Verificando...";

    try {
      // checa duplicidade + insere, tudo dentro da function no banco —
      // o front nunca lê a tabela `barbearias` diretamente.
      const { data, error } = await supabase.rpc("cadastrar_barbearia", {
        p_empresa: step1Data.empresa,
        p_nome: step1Data.nome,
        p_whatsapp: step1Data.whatsapp,
        p_email: step1Data.email,
        p_whatsapp_barbearia: whatsappBarbearia,
      });

      if (error) throw error;

      if (!data.ok) {
        // BLOQUEADO — já existe uma barbearia com esse número
        showError(
          `Esse WhatsApp já está cadastrado em outra conta. ` +
            `Se você acredita que isso é um engano, ` +
            `<a href="${SUPORTE_WHATSAPP_URL}" target="_blank">fale com o nosso suporte</a>.`,
        );
        step2Submit.disabled = false;
        step2Submit.textContent = "Confirmar e liberar acesso";
        return;
      }

      // sucesso — mostra confirmação e redireciona pro CRM
      step2Form.hidden = true;
      success.hidden = false;
      setTimeout(() => {
        window.location.href = CRM_ATENDIMENTOS_URL;
      }, 1500);
    } catch (err) {
      console.error(err);
      showError(
        "Não conseguimos concluir seu cadastro agora. Tente novamente em instantes.",
      );
      step2Submit.disabled = false;
      step2Submit.textContent = "Confirmar e liberar acesso";
    }
  });
});
