import {
  getStripe,
  getSupabaseAdmin,
  PLAN_LIMITS,
  planFromPriceId,
  sendJson,
  stripeId,
  stripeStatus,
  subscriptionPeriodEnd
} from "./_lib/server.js";

export const config = {
  api: { bodyParser: false }
};

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function periodEndIso(subscription) {
  const value = subscriptionPeriodEnd(subscription);
  return value ? new Date(value * 1000).toISOString() : null;
}

async function updatePlanLimits(supabase, userId, oldPlan, newPlan) {
  const oldLimit = PLAN_LIMITS[oldPlan] ?? Infinity;
  const newLimit = PLAN_LIMITS[newPlan] ?? Infinity;

  if (newLimit < oldLimit) {
    const { count, error } = await supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if (error) throw error;

    const needsSelection = Number(count || 0) > newLimit;
    const { error: updateError } = await supabase
      .from("subscriptions")
      .update({ needs_property_selection: needsSelection })
      .eq("user_id", userId);
    if (updateError) throw updateError;
    return;
  }

  if (newLimit > oldLimit) {
    const [{ error: propertyError }, { error: subscriptionError }] = await Promise.all([
      supabase.from("properties").update({ is_locked: false }).eq("user_id", userId),
      supabase.from("subscriptions").update({ needs_property_selection: false }).eq("user_id", userId)
    ]);
    if (propertyError || subscriptionError) throw propertyError || subscriptionError;
  }
}

async function handleCheckoutCompleted(session) {
  const userId = session.client_reference_id;
  const stripeSubscriptionId = stripeId(session.subscription);
  if (!userId || !stripeSubscriptionId) throw new Error("Checkout session is missing identifiers");

  const stripe = getStripe();
  const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const priceId = stripeSubscription.items.data[0]?.price?.id;
  const plan = planFromPriceId(priceId);
  if (!plan) throw new Error("Unknown Stripe price");

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: "active",
      plan,
      stripe_customer_id: stripeId(session.customer),
      stripe_subscription_id: stripeSubscriptionId,
      current_period_end: periodEndIso(stripeSubscription),
      needs_property_selection: false,
      updated_at: new Date().toISOString()
    })
    .eq("user_id", userId);
  if (error) throw error;
}

async function handleSubscriptionUpdated(stripeSubscription) {
  const stripeSubscriptionId = stripeId(stripeSubscription);
  const priceId = stripeSubscription.items.data[0]?.price?.id;
  const plan = planFromPriceId(priceId);
  if (!stripeSubscriptionId || !plan) throw new Error("Subscription update has an unknown plan");

  const supabase = getSupabaseAdmin();
  const { data: current, error: readError } = await supabase
    .from("subscriptions")
    .select("user_id,plan")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();
  if (readError) throw readError;
  if (!current) return;

  const { error: updateError } = await supabase
    .from("subscriptions")
    .update({
      status: stripeStatus(stripeSubscription.status),
      plan,
      current_period_end: periodEndIso(stripeSubscription),
      updated_at: new Date().toISOString()
    })
    .eq("stripe_subscription_id", stripeSubscriptionId);
  if (updateError) throw updateError;

  await updatePlanLimits(supabase, current.user_id, current.plan, plan);
}

async function handleSubscriptionDeleted(stripeSubscription) {
  const stripeSubscriptionId = stripeId(stripeSubscription);
  if (!stripeSubscriptionId) return;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: "expired",
      current_period_end: periodEndIso(stripeSubscription),
      updated_at: new Date().toISOString()
    })
    .eq("stripe_subscription_id", stripeSubscriptionId);
  if (error) throw error;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    const rawBody = await readRawBody(req);
    const signature = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!signature || !webhookSecret) {
      return sendJson(res, 400, { error: "Webhook is not configured" });
    }

    const event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);

    if (event.type === "checkout.session.completed") {
      await handleCheckoutCompleted(event.data.object);
    } else if (event.type === "customer.subscription.updated") {
      await handleSubscriptionUpdated(event.data.object);
    } else if (event.type === "customer.subscription.deleted") {
      await handleSubscriptionDeleted(event.data.object);
    }

    return sendJson(res, 200, { received: true });
  } catch (error) {
    console.error("stripe-webhook failed", error);
    return sendJson(res, 400, { error: "Webhook processing failed" });
  }
}
