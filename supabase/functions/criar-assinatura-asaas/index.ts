/* ============================================================
   criar-assinatura-asaas
   Cria o cliente e a assinatura na Asaas pra barbearia do usuário
   logado (precisa ser admin), salva os IDs em barbearias, e sempre
   manda externalReference = id da barbearia, pra qualquer webhook
   futuro conseguir localizar o cliente certo de cara.

   Secrets da function (Edge Functions > Secrets):
     - ASAAS_API_KEY: chave da conta (Sandbox é uma conta separada).
     - ASAAS_API_URL: produção por padrão (https://api.asaas.com/v3);
       no Sandbox, https://api-sandbox.asaas.com/v3.
     - VALOR_PLANO: opcional, valor mensal em reais (padrão 69). Serve
       pra testar no Sandbox com valor baixo (mínimo do Asaas: R$ 5).
   billingType "UNDEFINED": o cliente escolhe Pix ou cartão na hora de
   pagar (o CRM paga pela Edge Function pagar-assinatura).
   ============================================================ */

import { createClient } from "npm:@supabase/supabase-js@2";

const VALOR_PADRAO = 69.0;
const CICLO_PLANO = "MONTHLY";
const DESCRICAO_PLANO = "Barbozap — plano mensal";

const valorPlano = () => {
  const v = Number(String(Deno.env.get("VALOR_PLANO") ?? "").replace(",", "."));
  return Number.isFinite(v) && v > 0 ? v : VALOR_PADRAO;
};

// CORS — sem isso, o navegador bloqueia a chamada no preflight (OPTIONS)
// antes mesmo do POST acontecer.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

async function chamarAsaas(
  apiUrl: string,
  apiKey: string,
  caminho: string,
  opcoes: RequestInit,
) {
  const resp = await fetch(`${apiUrl}${caminho}`, {
    ...opcoes,
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
      ...(opcoes.headers || {}),
    },
  });

  const data = await resp.json();

  if (!resp.ok) {
    const mensagem =
      data?.errors?.[0]?.description ??
      `Erro ${resp.status} ao chamar a Asaas`;
    throw new Error(mensagem);
  }

  return data;
}

Deno.serve(async (req: Request) => {
  // O navegador manda isso antes do POST de verdade — precisa responder
  // 200 com os headers de CORS, senão a chamada nem sai do navegador.
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido" }, 405);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
  const ASAAS_API_URL =
    Deno.env.get("ASAAS_API_URL") ?? "https://api.asaas.com/v3";

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(
      { error: "SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados." },
      500,
    );
  }
  if (!ASAAS_API_KEY) {
    return jsonResponse(
      {
        error:
          "ASAAS_API_KEY não configurado nos Secrets desta function (Edge Functions → Settings → Secrets).",
      },
      500,
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Identifica o usuário logado a partir do token de autorização
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Não autenticado" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return jsonResponse({ error: "Não autenticado" }, 401);
  }

  try {
    // Confirma que quem está chamando é admin da barbearia
    const { data: profissional, error: profError } = await supabase
      .from("profissionais")
      .select("barbearia_id, acesso")
      .eq("auth_user_id", user.id)
      .single();

    if (profError || !profissional) {
      return jsonResponse({ error: "Profissional não encontrado" }, 404);
    }

    if (profissional.acesso !== "admin") {
      return jsonResponse(
        { error: "Só um usuário admin pode conectar a assinatura." },
        403,
      );
    }

    const barbeariaId = profissional.barbearia_id;

    const { data: barbearia, error: barbeariaError } = await supabase
      .from("barbearias")
      .select(
        "id, empresa, email, whatsapp_barbearia, cnpj, asaas_customer_id, asaas_subscription_id",
      )
      .eq("id", barbeariaId)
      .single();

    if (barbeariaError || !barbearia) {
      return jsonResponse({ error: "Barbearia não encontrada" }, 404);
    }

    if (!barbearia.cnpj) {
      return jsonResponse(
        { error: "Cadastre o CNPJ da barbearia antes de conectar com a Asaas." },
        400,
      );
    }

    if (barbearia.asaas_subscription_id) {
      return jsonResponse({
        ok: true,
        message: "Assinatura já estava conectada.",
        already_connected: true,
      });
    }

    // 1) Cria (ou reaproveita) o cliente na Asaas
    let customerId = barbearia.asaas_customer_id;

    if (!customerId) {
      const customer = await chamarAsaas(ASAAS_API_URL, ASAAS_API_KEY, "/customers", {
        method: "POST",
        body: JSON.stringify({
          name: barbearia.empresa,
          cpfCnpj: barbearia.cnpj,
          email: barbearia.email ?? undefined,
          mobilePhone: barbearia.whatsapp_barbearia ?? undefined,
          externalReference: String(barbeariaId),
        }),
      });
      customerId = customer.id;
    }

    // 2) Cria a assinatura, sempre com externalReference = id da barbearia
    const primeiroVencimento = new Date();
    primeiroVencimento.setDate(primeiroVencimento.getDate() + 1);
    const dataVencimentoISO = primeiroVencimento.toISOString().slice(0, 10);

    const subscription = await chamarAsaas(ASAAS_API_URL, ASAAS_API_KEY, "/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        customer: customerId,
        billingType: "UNDEFINED",
        value: valorPlano(),
        cycle: CICLO_PLANO,
        description: DESCRICAO_PLANO,
        nextDueDate: dataVencimentoISO,
        externalReference: String(barbeariaId),
      }),
    });

    // 3) Salva os IDs — o resto (status_assinatura, cliente) fica por
    //    conta do webhook, que vai chegar em seguida (SUBSCRIPTION_CREATED)
    const { error: updateError } = await supabase
      .from("barbearias")
      .update({
        asaas_customer_id: customerId,
        asaas_subscription_id: subscription.id,
      })
      .eq("id", barbeariaId);

    if (updateError) {
      throw updateError;
    }

    return jsonResponse({
      ok: true,
      asaas_customer_id: customerId,
      asaas_subscription_id: subscription.id,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : JSON.stringify(error);
    console.error("Erro ao criar assinatura na Asaas:", errorMessage);
    return jsonResponse({ error: errorMessage }, 500);
  }
});
