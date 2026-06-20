import {
  getSupabaseAdmin,
  getWhop,
  requiredEnv,
  sendJson,
  syncWhopMembership
} from "./_lib/server.js";

export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

function normalizedHeaders(headers) {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(",") : String(value || "")]));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  const supabase = getSupabaseAdmin();
  let event;

  try {
    const body = await readRawBody(req);
    event = getWhop().webhooks.unwrap(body, {
      headers: normalizedHeaders(req.headers),
      key: requiredEnv("WHOP_WEBHOOK_SECRET")
    });
    if (event.company_id !== requiredEnv("WHOP_COMPANY_ID")) throw new Error("Unknown Whop company");

    const { error: eventError } = await supabase.from("billing_webhook_events").insert({
      provider: "whop",
      event_id: event.id,
      event_type: event.type
    });
    if (eventError?.code === "23505") return sendJson(res, 200, { received: true, duplicate: true });
    if (eventError) throw eventError;

    if (["membership.activated", "membership.deactivated", "membership.cancel_at_period_end_changed"].includes(event.type)) {
      await syncWhopMembership(event.data);
    } else if (["payment.succeeded", "payment.failed"].includes(event.type) && event.data.membership?.id) {
      const membership = await getWhop().memberships.retrieve(event.data.membership.id);
      await syncWhopMembership(membership);
    }

    return sendJson(res, 200, { received: true });
  } catch (error) {
    if (event?.id) {
      await supabase.from("billing_webhook_events").delete().eq("provider", "whop").eq("event_id", event.id);
    }
    console.error("whop-webhook failed", error?.message || error);
    return sendJson(res, 400, { error: "Webhook processing failed" });
  }
}
