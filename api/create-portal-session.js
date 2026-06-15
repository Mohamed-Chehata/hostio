import {
  appUrl,
  getStripe,
  getSupabaseAdmin,
  parseBody,
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

    const { userId } = parseBody(req);
    if (userId && userId !== user.id) {
      return sendJson(res, 403, { error: "Forbidden" });
    }

    const supabase = getSupabaseAdmin();
    const { data: subscription, error } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!subscription?.stripe_customer_id) {
      return sendJson(res, 400, { error: "No billing account found" });
    }

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${appUrl()}/settings`
    });

    return sendJson(res, 200, { url: session.url });
  } catch (error) {
    console.error("create-portal-session failed", error);
    return sendJson(res, 500, { error: "Something went wrong" });
  }
}
