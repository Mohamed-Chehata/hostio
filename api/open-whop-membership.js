import { getSupabaseAdmin, handleOptions, requireUser, sendJson } from "./_lib/server.js";

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const user = await requireUser(req);
    if (!user) return sendJson(res, 401, { error: "Unauthorized" });
    const { data, error } = await getSupabaseAdmin()
      .from("subscriptions")
      .select("whop_manage_url")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data?.whop_manage_url) return sendJson(res, 400, { error: "No billing account found" });
    return sendJson(res, 200, { url: data.whop_manage_url });
  } catch (error) {
    console.error("open-whop-membership failed", error?.message || error);
    return sendJson(res, 500, { error: "Something went wrong" });
  }
}
