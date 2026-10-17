/* ============================================================
   BARBOZAP — Edge Function: pagar-assinatura
   Pagamento da assinatura sem sair do CRM (só admin).

   POST { acao: "pix" }
     -> QR Code e "copia e cola" da cobrança em aberto
   POST { acao: "cartao", cartao: {...}, titular: {...} }
     -> paga a cobrança em aberto no cartão e deixa a assinatura
        cobrando nesse cartão todo mês

   Os dados do cartão só passam por aqui a caminho do Asaas: não são
   gravados nem aparecem em log. Quem marca a barbearia como paga é o
   webhook (asaas-webhook), igual a qualquer outro pagamento.
   ============================================================ */

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

class ErroAsaas extends Error {}

async function asaas(apiUrl: string, apiKey: string, caminho: string, opcoes: RequestInit = {}) {
  const resp = await fetch(`${apiUrl}${caminho}`, {
    ...opcoes,
    headers: { "Content-Type": "application/json", access_token: apiKey, ...(opcoes.headers || {}) },
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new ErroAsaas(data?.errors?.[0]?.description ?? `Erro ${resp.status} no Asaas`);
  }
  return data;
}

const soDigitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const API_KEY = Deno.env.get("ASAAS_API_KEY");
  const API_URL = Deno.env.get("ASAAS_API_URL") ?? "https://api.asaas.com/v3";
  if (!API_KEY) return json({ error: "ASAAS_API_KEY não configurada." }, 500);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return json({ error: "Não autenticado" }, 401);

  const { data: prof } = await supabase
    .from("profissionais")
    .select("barbearia_id, acesso")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!prof) return json({ error: "Profissional não encontrado" }, 404);
  if (prof.acesso !== "admin") return json({ error: "Só o admin pode pagar a assinatura." }, 403);

  const { data: barb } = await supabase
    .from("barbearias")
    .select("id, asaas_subscription_id")
    .eq("id", prof.barbearia_id)
    .single();
  if (!barb?.asaas_subscription_id) {
    return json({ error: "Assinatura ainda não criada." }, 400);
  }
  const sub = barb.asaas_subscription_id;

  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    // corpo vazio
  }

  try {
    // Cobrança em aberto mais antiga da assinatura (vencida primeiro, depois a pendente)
    let cobranca: Record<string, any> | null = null;
    for (const status of ["OVERDUE", "PENDING"]) {
      const lista = await asaas(API_URL, API_KEY, `/subscriptions/${sub}/payments?status=${status}`);
      const itens = (lista?.data || []).sort((a: any, b: any) => String(a.dueDate).localeCompare(String(b.dueDate)));
      if (itens.length) {
        cobranca = itens[0];
        break;
      }
    }
    if (!cobranca) return json({ ok: true, ja_pago: true });

    const resumo = { payment_id: cobranca.id, valor: cobranca.value, vencimento: cobranca.dueDate };

    if (body.acao === "pix") {
      const pix = await asaas(API_URL, API_KEY, `/payments/${cobranca.id}/pixQrCode`);
      return json({
        ok: true,
        ...resumo,
        qr_code: pix.encodedImage,
        copia_e_cola: pix.payload,
        expira_em: pix.expirationDate ?? null,
      });
    }

    if (body.acao === "cartao") {
      const c = body.cartao || {};
      const t = body.titular || {};
      const pagamento = await asaas(API_URL, API_KEY, `/payments/${cobranca.id}/payWithCreditCard`, {
        method: "POST",
        body: JSON.stringify({
          creditCard: {
            holderName: String(c.nome || "").trim(),
            number: soDigitos(c.numero),
            expiryMonth: soDigitos(c.mes).padStart(2, "0"),
            expiryYear: soDigitos(c.ano).length === 2 ? "20" + soDigitos(c.ano) : soDigitos(c.ano),
            ccv: soDigitos(c.cvv),
          },
          creditCardHolderInfo: {
            name: String(t.nome || c.nome || "").trim(),
            email: String(t.email || user.email || "").trim(),
            cpfCnpj: soDigitos(t.cpfCnpj),
            postalCode: soDigitos(t.cep),
            addressNumber: String(t.numeroEndereco || "").trim(),
            phone: soDigitos(t.telefone),
          },
        }),
      });

      // Deixa as próximas mensalidades no mesmo cartão (se falhar, o pagamento
      // de hoje continua valendo e as próximas chegam como cobrança normal)
      let recorrente = false;
      const tokenCartao = pagamento?.creditCard?.creditCardToken;
      if (tokenCartao) {
        try {
          const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || undefined;
          await asaas(API_URL, API_KEY, `/subscriptions/${sub}/creditCard`, {
            method: "PUT",
            body: JSON.stringify({ creditCardToken: tokenCartao, remoteIp: ip }),
          });
          recorrente = true;
        } catch (err) {
          console.error("Não deu para salvar o cartão na assinatura:", err instanceof Error ? err.message : err);
        }
      }

      return json({ ok: true, ...resumo, status: pagamento.status, recorrente });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (err) {
    if (err instanceof ErroAsaas) return json({ error: err.message }, 400);
    console.error("Erro em pagar-assinatura:", err instanceof Error ? err.message : err);
    return json({ error: "Não foi possível falar com o Asaas agora." }, 500);
  }
});
