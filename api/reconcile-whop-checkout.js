import {
  findWhopMembershipForCheckout,
  getWhop,
  handleOptions,
  parseBody,
  planFromWhopPlanId,
  requireUser,
  sendJson,
  syncWhopMembership
} from "./_lib/server.js";

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const user = await requireUser(req);
    if (!user) return sendJson(res, 401, { error: "Unauthorized" });
    const { checkoutConfigurationId } = parseBody(req);
    if (typeof checkoutConfigurationId !== "string" || !checkoutConfigurationId.startsWith("ch_")) {
      return sendJson(res, 400, { error: "Invalid checkout" });
    }

    const checkout = await getWhop().checkoutConfigurations.retrieve(checkoutConfigurationId);
    if (checkout.metadata?.hostrack_user_id !== user.id || !planFromWhopPlanId(checkout.plan?.id)) {
      return sendJson(res, 403, { error: "Forbidden" });
    }
    const membership = await findWhopMembershipForCheckout(checkoutConfigurationId);
    if (!membership) return sendJson(res, 202, { active: false });
    const result = await syncWhopMembership(membership, user.id);
    return sendJson(res, 200, { active: true, plan: result.plan });
  } catch (error) {
    console.error("reconcile-whop-checkout failed", error?.message || error);
    return sendJson(res, 500, { error: "Something went wrong" });
  }
}
