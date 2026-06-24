import {
  ensureHostrackUserRows,
  findWhopMembershipForUser,
  getSupabaseAdmin,
  getSupabaseAuthClient,
  getWhop,
  handleOptions,
  sendJson
} from "./_lib/server.js";

async function createOrFindHostrackUser(supabase, email, whopUserId) {
  const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      provider: "whop",
      whop_user_id: whopUserId
    }
  });

  if (!createUserError) return createdUser.user;
  if (!String(createUserError.message || "").toLowerCase().includes("already")) throw createUserError;

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email
  });
  if (linkError || !linkData?.user) throw linkError || createUserError;
  return linkData.user;
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  try {
    const whop = getWhop();
    const token = req.headers["x-whop-user-token"];
    if (!token) return sendJson(res, 401, { error: "no_whop_token" });

    const verifiedUser = await whop.verifyUserToken(typeof token === "string" ? token : null);
    const membership = await findWhopMembershipForUser(verifiedUser.userId);
    if (!membership) return sendJson(res, 403, { error: "no_membership" });

    let email = membership.user?.email;
    if (!email) return sendJson(res, 403, { error: "no_email" });

    const supabase = getSupabaseAdmin();
    const { data: linkedEntitlement, error: linkedEntitlementError } = await supabase
      .from("whop_entitlements")
      .select("hostrack_user_id")
      .eq("whop_user_id", verifiedUser.userId)
      .maybeSingle();
    if (linkedEntitlementError) throw linkedEntitlementError;

    let userId = linkedEntitlement?.hostrack_user_id || null;
    if (userId) {
      const { data: linkedUser, error: linkedUserError } = await supabase.auth.admin.getUserById(userId);
      if (linkedUserError || !linkedUser?.user?.email) throw linkedUserError || new Error("Linked Hostrack user is unavailable");
      email = linkedUser.user.email;
    } else {
      const user = await createOrFindHostrackUser(supabase, email, verifiedUser.userId);
      userId = user.id;
    }

    await ensureHostrackUserRows(userId, { whopMembership: membership });

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email
    });
    if (linkError || !linkData?.properties?.hashed_token) throw linkError || new Error("Could not create Hostrack session");

    const { data: verified, error: verifyError } = await getSupabaseAuthClient().auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: linkData.properties.verification_type || "magiclink"
    });
    if (verifyError || !verified.session) throw verifyError || new Error("Could not verify Hostrack session");

    return sendJson(res, 200, {
      access_token: verified.session.access_token,
      refresh_token: verified.session.refresh_token,
      expires_in: verified.session.expires_in,
      token_type: verified.session.token_type || "bearer"
    });
  } catch (error) {
    console.error("whop-iframe-login failed", error?.message || error);
    return sendJson(res, 500, { error: "internal_error" });
  }
}
