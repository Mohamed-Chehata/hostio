import { getWhop, sendJson, whopPlanIds } from "./_lib/server.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const audience = req.query.audience === "public" ? "public" : "hidden";
    const ids = whopPlanIds()[audience];
    if (Object.values(ids).some((id) => !id)) throw new Error("Whop plans are not configured");
    const entries = await Promise.all(Object.entries(ids).map(async ([key, id]) => {
      const plan = await getWhop().plans.retrieve(id);
      return [key, {
        name: plan.title || key[0].toUpperCase() + key.slice(1),
        price: Number(plan.renewal_price || plan.initial_price || 0),
        currency: String(plan.currency || "usd").toUpperCase()
      }];
    }));
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
    return sendJson(res, 200, { plans: Object.fromEntries(entries) });
  } catch (error) {
    console.error("whop-plan-catalog failed", error?.message || error);
    return sendJson(res, 500, { error: "Something went wrong" });
  }
}
