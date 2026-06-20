import {
  appUrl,
  getWhop,
  handleOptions,
  parseBody,
  requireUser,
  sendJson,
  whopPlanIds
} from "./_lib/server.js";

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    const user = await requireUser(req);
    if (!user) return sendJson(res, 401, { error: "Unauthorized" });
    const { plan } = parseBody(req);
    const planId = whopPlanIds().hidden[plan];
    if (!planId) return sendJson(res, 400, { error: "Invalid plan" });

    const checkout = await getWhop().checkoutConfigurations.create({
      plan_id: planId,
      metadata: {
        hostrack_user_id: user.id,
        hostrack_plan: plan,
        acquisition_source: "hostrack"
      },
      redirect_url: `${appUrl()}/app?checkout=success`,
      source_url: `${appUrl()}/app`
    });

    return sendJson(res, 200, {
      url: checkout.purchase_url,
      checkoutConfigurationId: checkout.id
    });
  } catch (error) {
    console.error("create-whop-checkout failed", error?.message || error);
    return sendJson(res, 500, { error: "Something went wrong" });
  }
}
