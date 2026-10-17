import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
  "SUPABASE_SERVICE_ROLE_KEY",
);
const ASAAS_WEBHOOK_TOKEN = Deno.env.get("ASAAS_WEBHOOK_TOKEN");

if (
  !SUPABASE_URL ||
  !SUPABASE_SERVICE_ROLE_KEY ||
  !ASAAS_WEBHOOK_TOKEN
) {
  throw new Error("Variáveis de ambiente obrigatórias não configuradas.");
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
);

const jsonResponse = (
  body: Record<string, unknown>,
  status = 200,
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse(
      { error: "Método não permitido" },
      405,
    );
  }

  const receivedToken = req.headers.get("asaas-access-token");

  if (receivedToken !== ASAAS_WEBHOOK_TOKEN) {
    return jsonResponse(
      { error: "Token inválido" },
      401,
    );
  }

  let body: Record<string, any>;

  try {
    body = await req.json();
  } catch {
    return jsonResponse(
      { error: "JSON inválido" },
      400,
    );
  }

  const eventId = body.id ?? null;
  const eventType = body.event ?? null;

  if (!eventType) {
    return jsonResponse(
      { error: "Evento não informado" },
      400,
    );
  }

  try {
    /*
     * Registra o evento recebido.
     * Isso ajuda a identificar erros e eventos duplicados.
     */
    if (eventId) {
      const { error: eventInsertError } = await supabase
        .from("asaas_webhook_events")
        .insert({
          event_id: eventId,
          event_type: eventType,
          asaas_payment_id: body.payment?.id ?? null,
          payload: body,
        });

      if (eventInsertError?.code === "23505") {
        // Já recebido. Só ignora se foi processado com sucesso; se tinha
        // dado erro, o Asaas está reenviando e a gente tenta de novo.
        const { data: anterior } = await supabase
          .from("asaas_webhook_events")
          .select("processado_em")
          .eq("event_id", eventId)
          .maybeSingle();

        if (anterior?.processado_em) {
          return jsonResponse({
            received: true,
            duplicate: true,
            event_id: eventId,
          });
        }
      } else if (eventInsertError) {
        throw eventInsertError;
      }
    }

    /*
     * Eventos relacionados a cobranças.
     */
    if (body.payment?.id) {
      await processarCobranca(body);
    }

    /*
     * Eventos relacionados a assinaturas.
     */
    if (body.subscription?.id) {
      await processarAssinatura(body);
    }

    if (eventId) {
      await supabase
        .from("asaas_webhook_events")
        .update({
          processado_em: new Date().toISOString(),
          erro: null,
        })
        .eq("event_id", eventId);
    }

    return jsonResponse({
      received: true,
      event_id: eventId,
      event_type: eventType,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : JSON.stringify(error);

    console.error("Erro ao processar webhook:", errorMessage);

    if (eventId) {
      await supabase
        .from("asaas_webhook_events")
        .update({
          erro: errorMessage,
        })
        .eq("event_id", eventId);
    }

    return jsonResponse(
      {
        received: false,
        error: errorMessage,
      },
      500,
    );
  }
});

async function localizarBarbearia(
  externalReference: unknown,
  customerId: unknown,
): Promise<number> {
  if (externalReference) {
    const parsedId = Number(externalReference);

    if (Number.isInteger(parsedId) && parsedId > 0) {
      const { data } = await supabase
        .from("barbearias")
        .select("id")
        .eq("id", parsedId)
        .maybeSingle();

      if (data?.id) {
        return data.id;
      }
    }
  }

  if (typeof customerId === "string" && customerId) {
    const { data, error } = await supabase
      .from("barbearias")
      .select("id")
      .eq("asaas_customer_id", customerId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data?.id) {
      return data.id;
    }
  }

  throw new Error(
    "Barbearia não localizada pelo externalReference ou customer ID.",
  );
}

async function processarCobranca(
  body: Record<string, any>,
): Promise<void> {
  const payment = body.payment;

  const barbeariaId = await localizarBarbearia(
    payment.externalReference,
    payment.customer,
  );

  const dadosCobranca: Record<string, unknown> = {
    barbearia_id: barbeariaId,
    asaas_customer_id: payment.customer ?? null,
    asaas_payment_id: payment.id,
    asaas_status: payment.status ?? null,
    descricao: payment.description ?? null,
    valor: payment.value ?? null,
    valor_liquido: payment.netValue ?? null,
    data_vencimento: payment.dueDate ?? null,
    data_pagamento:
      payment.paymentDate ??
      payment.clientPaymentDate ??
      payment.confirmedDate ??
      null,
    billing_type: payment.billingType ?? null,
    fatura_url:
      payment.invoiceUrl ??
      payment.bankSlipUrl ??
      payment.transactionReceiptUrl ??
      null,
    external_reference: payment.externalReference ?? null,
    payload: body,
    atualizado_em: new Date().toISOString(),
  };

  /*
   * Pagamento recebido volta imediatamente para pagante.
   * O bloqueio após sete dias continua sendo feito pela função SQL.
   */
  if (
    ["RECEIVED", "CONFIRMED"].includes(payment.status)
  ) {
    dadosCobranca.status = "pagante";
  }

  const { error } = await supabase
    .from("asaas")
    .upsert(dadosCobranca, {
      onConflict: "asaas_payment_id",
    });

  if (error) {
    throw error;
  }

  if (payment.customer) {
    const { error: customerError } = await supabase
      .from("barbearias")
      .update({
        asaas_customer_id: payment.customer,
      })
      .eq("id", barbeariaId)
      .is("asaas_customer_id", null);

    if (customerError) {
      throw customerError;
    }
  }

  const { error: statusError } = await supabase.rpc(
    "atualizar_status_pagantes",
  );

  if (statusError) {
    throw statusError;
  }
}

async function processarAssinatura(
  body: Record<string, any>,
): Promise<void> {
  const subscription = body.subscription;

  const barbeariaId = await localizarBarbearia(
    subscription.externalReference,
    subscription.customer,
  );

  const eventType: string = body.event ?? "";

  const subscriptionStatus =
    subscription.status ??
    inferirStatusAssinatura(eventType);

  /*
   * status_assinatura (e cliente) só são tocados aqui em dois casos:
   *   - assinatura cancelada/inativada na Asaas -> força "cancelada"
   *     imediatamente, mesmo que a última cobrança tivesse sido paga.
   *   - assinatura recém-criada -> "pendente", até a primeira cobrança
   *     ser confirmada.
   * Fora isso (ex: SUBSCRIPTION_UPDATED), quem decide pagante/não
   * pagante continua sendo atualizar_status_pagantes(), a partir das
   * cobranças — não mexemos nesse campo aqui pra não conflitar.
   */
  let statusAssinatura: string | null = null;

  if (
    eventType.includes("DELETED") ||
    eventType.includes("INACTIVATED") ||
    eventType.includes("EXPIRED")
  ) {
    statusAssinatura = "cancelada";
  } else if (eventType === "SUBSCRIPTION_CREATED") {
    statusAssinatura = "pendente";
  }

  const dadosBarbearia: Record<string, unknown> = {
    asaas_customer_id: subscription.customer ?? null,
    asaas_subscription_id: subscription.id,
    subscription_status: subscriptionStatus,
  };

  if (statusAssinatura) {
    dadosBarbearia.status_assinatura = statusAssinatura;
    dadosBarbearia.cliente = statusAssinatura === "pagante";
  }

  const { error } = await supabase
    .from("barbearias")
    .update(dadosBarbearia)
    .eq("id", barbeariaId);

  if (error) {
    throw error;
  }
}

function inferirStatusAssinatura(
  eventType: string,
): string {
  if (
    eventType.includes("DELETED") ||
    eventType.includes("INACTIVATED")
  ) {
    return "INACTIVE";
  }

  if (
    eventType.includes("CREATED") ||
    eventType.includes("UPDATED")
  ) {
    return "ACTIVE";
  }

  return "UNKNOWN";
}
