// ============================================================
// BARBOZAP — Edge Function: excluir-usuario
//
// Deixa o admin remover um profissional da MESMA barbearia:
//   - apaga o login (Supabase Auth), então a pessoa não entra mais no CRM;
//   - sem atendimentos: apaga o cadastro do profissional;
//   - com atendimentos antigos: marca removido_em (some do CRM e do bot,
//     mas o histórico e os relatórios continuam com o nome dele).
// Não deixa remover a si mesmo, o último admin, nem quem tem atendimentos
// marcados daqui pra frente (precisa remarcar ou cancelar antes).
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json({ error: "Método não permitido" }, 405);
    }

    // ---------- 1) identifica quem está chamando ----------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: callerUser }, error: callerError } =
      await callerClient.auth.getUser();
    if (callerError || !callerUser) return json({ error: "Sessão inválida" }, 401);

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // ---------- 2) só admin, e pega a barbearia dele ----------
    const { data: caller } = await adminClient
      .from("profissionais")
      .select("id, barbearia_id, acesso")
      .eq("auth_user_id", callerUser.id)
      .is("removido_em", null)
      .single();
    if (!caller) return json({ error: "Usuário atual não encontrado" }, 403);
    if (caller.acesso !== "admin") {
      return json({ error: "Só administradores podem excluir usuários" }, 403);
    }

    // ---------- 3) confere o alvo ----------
    const { profissional_id } = await req.json();
    if (!profissional_id) return json({ error: "Informe o usuário" }, 400);

    const { data: alvo } = await adminClient
      .from("profissionais")
      .select("id, nome, email, acesso, auth_user_id, barbearia_id, removido_em")
      .eq("id", profissional_id)
      .single();
    if (!alvo || alvo.removido_em) return json({ error: "Usuário não encontrado" }, 404);
    if (alvo.barbearia_id !== caller.barbearia_id) {
      return json({ error: "Esse usuário não é da sua barbearia" }, 403);
    }
    if (alvo.id === caller.id) {
      return json({ error: "Você não pode excluir o seu próprio usuário" }, 400);
    }

    if (alvo.acesso === "admin") {
      const { count } = await adminClient
        .from("profissionais")
        .select("id", { count: "exact", head: true })
        .eq("barbearia_id", alvo.barbearia_id)
        .eq("acesso", "admin")
        .is("removido_em", null);
      if ((count ?? 0) <= 1) {
        return json({ error: "A barbearia precisa ter pelo menos um admin" }, 400);
      }
    }

    // ---------- 4) bloqueia se tiver atendimentos marcados ----------
    const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    const { count: futuros } = await adminClient
      .from("atendimentos")
      .select("id", { count: "exact", head: true })
      .eq("id_prof", alvo.id)
      .gte("data_agend", hoje);
    if ((futuros ?? 0) > 0) {
      return json({
        error: `${alvo.nome} ainda tem ${futuros} atendimento(s) marcado(s) a partir de hoje. ` +
          "Passe para outro profissional ou cancele antes de excluir.",
      }, 409);
    }

    const { count: historico } = await adminClient
      .from("atendimentos")
      .select("id", { count: "exact", head: true })
      .eq("id_prof", alvo.id);

    // ---------- 5) tira o login ----------
    if (alvo.auth_user_id) {
      const { error: delAuthError } = await adminClient.auth.admin.deleteUser(alvo.auth_user_id);
      if (delAuthError && !/not.?found/i.test(delAuthError.message)) {
        return json({ error: delAuthError.message }, 400);
      }
    }

    // sessões do bot que tinham esse profissional escolhido voltam pra "sem preferência"
    await adminClient
      .from("sessoes")
      .update({ id_prof_selecionado: null })
      .eq("id_prof_selecionado", alvo.id);

    // ---------- 6) apaga ou arquiva o cadastro ----------
    if ((historico ?? 0) === 0) {
      const { error } = await adminClient.from("profissionais").delete().eq("id", alvo.id);
      if (error) return json({ error: error.message }, 400);
    } else {
      // libera o e-mail pra poder cadastrar a pessoa de novo no futuro
      const { error } = await adminClient
        .from("profissionais")
        .update({
          removido_em: new Date().toISOString(),
          auth_user_id: null,
          email: `${alvo.email}#removido-${alvo.id}`,
        })
        .eq("id", alvo.id);
      if (error) return json({ error: error.message }, 400);
    }

    return json({ ok: true, arquivado: (historico ?? 0) > 0 });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
