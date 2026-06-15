import { getSupabaseAdmin, handleOptions, parseBody, PLAN_LIMITS, requireUser, sendJson } from "./_lib/server.js";

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    const user = await requireUser(req);
    if (!user) return sendJson(res, 401, { error: "Unauthorized" });

    const { propertyIds } = parseBody(req);
    const selectedIds = [...new Set(Array.isArray(propertyIds) ? propertyIds : [])];
    const supabase = getSupabaseAdmin();
    const { data: subscription, error: subscriptionError } = await supabase
      .from("subscriptions")
      .select("plan,needs_property_selection")
      .eq("user_id", user.id)
      .single();
    if (subscriptionError) throw subscriptionError;

    const limit = PLAN_LIMITS[subscription.plan];
    if (!subscription.needs_property_selection || !Number.isFinite(limit) || selectedIds.length !== limit) {
      return sendJson(res, 400, { error: "Invalid property selection" });
    }

    const { data: properties, error: propertiesError } = await supabase
      .from("properties")
      .select("id")
      .eq("user_id", user.id);
    if (propertiesError) throw propertiesError;
    const ownedIds = new Set((properties || []).map((property) => property.id));
    if (selectedIds.some((id) => !ownedIds.has(id))) {
      return sendJson(res, 403, { error: "Forbidden" });
    }

    const { error: lockError } = await supabase
      .from("properties")
      .update({ is_locked: true })
      .eq("user_id", user.id);
    if (lockError) throw lockError;

    const { error: unlockError } = await supabase
      .from("properties")
      .update({ is_locked: false })
      .eq("user_id", user.id)
      .in("id", selectedIds);
    if (unlockError) throw unlockError;

    const { error: updateError } = await supabase
      .from("subscriptions")
      .update({ needs_property_selection: false })
      .eq("user_id", user.id);
    if (updateError) throw updateError;

    return sendJson(res, 200, { success: true });
  } catch (error) {
    console.error("confirm-property-selection failed", error);
    return sendJson(res, 500, { error: "Something went wrong" });
  }
}
