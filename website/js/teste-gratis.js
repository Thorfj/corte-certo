/* ============================================================
   CORTE CERTO — TESTE-GRATIS.JS
   Formulário de cadastro em 3 steps:
     Step 1 — dados da barbearia e do responsável
     Step 2 — WhatsApp da barbearia (checagem antecipada de duplicado)
     Step 3 — senha -> cria a conta no Supabase Auth e já entra
              logado no CRM, sem passar pelo login.html.

   Credenciais do Supabase já preenchidas (mesmo projeto do CRM).
   O cadastro de verdade (insert em barbearias + profissionais)
   acontece dentro da function `finalizar_cadastro_barbearia`,
   chamada só DEPOIS que a conta de autenticação já existe — ver
   /sql/teste_gratis_com_senha.sql
   ============================================================ */

const SUPABASE_URL = "https://jzqiqrymqbzullysukja.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_lqY19MJcqfYcVAABzRgiNg_6h4DIWUO";

// TODO: confirmar a URL real da página de atendimentos do CRM
const CRM_ATENDIMENTOS_URL = "/crm/html/atendimentos.html";

// TODO: ajustar se quiser outro contato de suporte
const SUPORTE_WHATSAPP_URL = "https://wa.me/5541999428022";

document.addEventListener("DOMContentLoaded", () => {
  const step1Form = document.getElementById("tgFormStep1");
  const step2Form = document.getElementById("tgFormStep2");
  const step3Form = document.getElementById("tgFormStep3");
  const success = document.getElementById("tgSuccess");
  const confirmarEmail = document.getElementById("tgConfirmarEmail");

  const dotStep1 = document.getElementById("dotStep1");
  const dotStep2 = document.getElementById("dotStep2");
  const dotStep3 = document.getElementById("dotStep3");

  const backBtn2 = document.getElementById("tgBack");
  const backBtn3 = document.getElementById("tgBack3");
  const errorBox1 = document.getElementById("tgError1");
  const errorBox2 = document.getElementById("tgError");
  const errorBox3 = document.getElementById("tgError3");
  const step1Submit = document.getElementById("tgStep1Submit");
  const step2Submit = document.getElementById("tgStep2Submit");
  const step3Submit = document.getElementById("tgStep3Submit");

  const whatsappInput = document.getElementById("whatsapp");
  const whatsappBarbeariaInput = document.getElementById("whatsappBarbearia");
  const senhaInput = document.getElementById("senha");
  const senhaConfirmaInput = document.getElementById("senhaConfirma");

  if (!step1Form || !step2Form || !step3Form) return;

  // aceita só números nos campos de WhatsApp
  [whatsappInput, whatsappBarbeariaInput].forEach((input) => {
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "");
    });
  });

  // dados coletados nos steps anteriores, guardados em memória
  let step1Data = null;
  let whatsappBarbearia = null;

  let supabase = null;
  function getSupabaseClient() {
    if (supabase) return supabase;
    if (typeof window.supabase === "undefined") {
      console.error(
        "supabase-js não carregou. Confira o <script> do CDN em teste-gratis.html.",
      );
      return null;
    }
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return supabase;
  }

  function showError(box, message) {
    box.innerHTML = message;
    box.hidden = false;
  }
  function hideError(box) {
    box.hidden = true;
    box.innerHTML = "";
  }

  function irParaStep(numero) {
    step1Form.hidden = numero !== 1;
    step2Form.hidden = numero !== 2;
    step3Form.hidden = numero !== 3;
    dotStep1.classList.toggle("active", numero >= 1);
    dotStep2.classList.toggle("active", numero >= 2);
    dotStep3.classList.toggle("active", numero >= 3);
  }

  // ---------- STEP 1 -> STEP 2 ----------
  step1Form.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideError(errorBox1);

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

    const emailValue = document.getElementById("email").value.trim();

    const client = getSupabaseClient();
    if (!client) {
      showError(
        errorBox1,
        "Não foi possível conectar ao servidor agora. Tente novamente em instantes.",
      );
      return;
    }

    step1Submit.disabled = true;
    step1Submit.textContent = "Verificando...";

    try {
      const { data: disponivel, error } = await client.rpc("email_disponivel", {
        p_email: emailValue,
      });

      if (error) throw error;

      if (!disponivel) {
        showError(
          errorBox1,
          `Já existe uma conta com esse e-mail. ` +
            `Tente fazer login, ou se acha que isso é um engano, ` +
            `<a href="${SUPORTE_WHATSAPP_URL}" target="_blank">fale com o nosso suporte</a>.`,
        );
        return;
      }

      step1Data = {
        empresa: document.getElementById("barbearia").value.trim(),
        nome: document.getElementById("responsavel").value.trim(),
        whatsapp: whatsappInput.value,
        email: emailValue,
      };

      irParaStep(2);
      whatsappBarbeariaInput.focus();
    } catch (err) {
      console.error(err);
      showError(
        errorBox1,
        "Não conseguimos verificar agora. Tente novamente em instantes.",
      );
    } finally {
      step1Submit.disabled = false;
      step1Submit.textContent = "Continuar";
    }
  });

  // ---------- VOLTAR pro Step 1 ----------
  backBtn2.addEventListener("click", () => {
    hideError(errorBox2);
    irParaStep(1);
  });

  // ---------- STEP 2 -> STEP 3 (só checa disponibilidade, não insere nada) ----------
  step2Form.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideError(errorBox2);

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

    const client = getSupabaseClient();
    if (!client) {
      showError(
        errorBox2,
        "Não foi possível conectar ao servidor agora. Tente novamente em instantes.",
      );
      return;
    }

    step2Submit.disabled = true;
    step2Submit.textContent = "Verificando...";

    try {
      const { data: disponivel, error } = await client.rpc(
        "whatsapp_barbearia_disponivel",
        { p_whatsapp_barbearia: whatsappBarbeariaInput.value },
      );

      if (error) throw error;

      if (!disponivel) {
        showError(
          errorBox2,
          `Esse WhatsApp já está cadastrado em outra conta. ` +
            `Se você acredita que isso é um engano, ` +
            `<a href="${SUPORTE_WHATSAPP_URL}" target="_blank">fale com o nosso suporte</a>.`,
        );
        return;
      }

      whatsappBarbearia = whatsappBarbeariaInput.value;
      irParaStep(3);
      senhaInput.focus();
    } catch (err) {
      console.error(err);
      showError(
        errorBox2,
        "Não conseguimos verificar agora. Tente novamente em instantes.",
      );
    } finally {
      step2Submit.disabled = false;
      step2Submit.textContent = "Continuar";
    }
  });

  // ---------- VOLTAR pro Step 2 ----------
  backBtn3.addEventListener("click", () => {
    hideError(errorBox3);
    irParaStep(2);
  });

  // ---------- STEP 3: cria a conta e finaliza o cadastro ----------
  step3Form.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideError(errorBox3);

    if (!step3Form.checkValidity()) {
      step3Form.reportValidity();
      return;
    }
    if (senhaInput.value !== senhaConfirmaInput.value) {
      senhaConfirmaInput.setCustomValidity("As senhas não são iguais.");
      step3Form.reportValidity();
      senhaConfirmaInput.setCustomValidity("");
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      showError(
        errorBox3,
        "Não foi possível conectar ao servidor agora. Tente novamente em instantes.",
      );
      return;
    }

    step3Submit.disabled = true;
    step3Submit.textContent = "Criando conta...";

    try {
      // 1) cria a conta no Supabase Auth
      const { data: signUpData, error: signUpError } = await client.auth.signUp(
        {
          email: step1Data.email,
          password: senhaInput.value,
        },
      );

      if (signUpError) {
        showError(
          errorBox3,
          signUpError.message.includes("already registered")
            ? "Já existe uma conta com esse e-mail. Tente fazer login."
            : "Não foi possível criar sua conta agora. Tente novamente.",
        );
        return;
      }

      // 2) se o projeto exige confirmação de e-mail, ainda não há sessão —
      //    não dá pra finalizar o cadastro (a function precisa de auth.uid()).
      if (!signUpData.session) {
        step3Form.hidden = true;
        confirmarEmail.hidden = false;
        return;
      }

      // 3) com sessão ativa, finaliza o cadastro (insere barbearia + profissional)
      const { data, error } = await client.rpc("finalizar_cadastro_barbearia", {
        p_empresa: step1Data.empresa,
        p_nome: step1Data.nome,
        p_whatsapp: step1Data.whatsapp,
        p_email: step1Data.email,
        p_whatsapp_barbearia: whatsappBarbearia,
      });

      if (error) throw error;

      if (!data.ok) {
        showError(
          errorBox3,
          data.reason === "duplicado"
            ? `Esse WhatsApp acabou de ser cadastrado por outra conta. ` +
                `<a href="${SUPORTE_WHATSAPP_URL}" target="_blank">Fale com o suporte</a>.`
            : "Não conseguimos concluir seu cadastro agora. Tente novamente.",
        );
        return;
      }

      // 4) sucesso — já está logado (o signUp criou a sessão), redireciona pro CRM
      step3Form.hidden = true;
      success.hidden = false;
      setTimeout(() => {
        window.location.href = CRM_ATENDIMENTOS_URL;
      }, 1200);
    } catch (err) {
      console.error(err);
      showError(
        errorBox3,
        "Não conseguimos concluir seu cadastro agora. Tente novamente em instantes.",
      );
    } finally {
      step3Submit.disabled = false;
      step3Submit.textContent = "Criar conta e acessar";
    }
  });
});
