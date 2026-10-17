/* ============================================================
   BARBOZAP — Edge Function: cancelar-assinatura
   Cancela a assinatura da barbearia no Asaas (para de cobrar) e marca
   como cancelada no Barbozap. Só admin.

   Depois de cancelar, a barbearia volta a ver "Assinar agora" e pode
   assinar de novo quando quiser (cria uma assinatura nova).
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
  if (prof.acesso !== "admin") return json({ error: "Só o admin pode cancelar a assinatura." }, 403);

  const { data: barb } = await supabase
    .from("barbearias")
    .select("id, asaas_subscription_id")
    .eq("id", prof.barbearia_id)
    .single();

  if (barb?.asaas_subscription_id) {
    const resp = await fetch(`${API_URL}/subscriptions/${barb.asaas_subscription_id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", access_token: API_KEY },
    });
    // 404 = já não existe no Asaas: segue e só marca como cancelada aqui
    if (!resp.ok && resp.status !== 404) {
      const data = await resp.json().catch(() => ({}));
      return json({ error: data?.errors?.[0]?.description ?? "Não foi possível cancelar no Asaas." }, 400);
    }
  }

  // Sem assinatura: o bot é desligado pelo pg_cron (teste vencido) e o CRM
  // volta a mostrar "Assinar agora"
  const { error } = await supabase
    .from("barbearias")
    .update({
      status_assinatura: "cancelada",
      subscription_status: "INACTIVE",
      asaas_subscription_id: null,
      cliente: false,
    })
    .eq("id", prof.barbearia_id);
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true });
});
