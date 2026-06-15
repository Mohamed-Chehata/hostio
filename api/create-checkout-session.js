import {
  appUrl,
  getStripe,
  getSupabaseAdmin,
  parseBody,
  priceIds,
  requireUser,
  sendJson
} from "./_lib/server.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    const user = await requireUser(req);
    if (!user) return sendJson(res, 401, { error: "Unauthorized" });

    const { plan, userId } = parseBody(req);
    if (!["starter", "growth", "pro"].includes(plan)) {
      return sendJson(res, 400, { error: "Invalid plan" });
    }
    if (userId && userId !== user.id) {
      return sendJson(res, 403, { error: "Forbidden" });
    }

    const priceId = priceIds()[plan];
    if (!priceId) return sendJson(res, 500, { error: "Plan is not configured" });

    const supabase = getSupabaseAdmin();
    const { data: subscription, error } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl()}/?checkout=success`,
      cancel_url: `${appUrl()}/?checkout=cancel`,
      client_reference_id: user.id,
      ...(subscription?.stripe_customer_id
        ? { customer: subscription.stripe_customer_id }
        : { customer_email: user.email })
    });

    return sendJson(res, 200, { url: session.url });
  } catch (error) {
    console.error("create-checkout-session failed", error);
    return sendJson(res, 500, { error: "Something went wrong" });
  }
}
