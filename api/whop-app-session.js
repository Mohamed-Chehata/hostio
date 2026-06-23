import {
  appUrl,
  ensureHostrackUserRows,
  findWhopMembershipForUser,
  getSupabaseAdmin,
  getSupabaseAuthClient,
  getWhop
} from "./_lib/server.js";

function redirect(res, location) {
  res.setHeader("Location", location);
  res.status(302).end();
}

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
  if (req.method !== "GET") return res.status(405).end();

  try {
    const whop = getWhop();
    const token = req.headers["x-whop-user-token"];
    const verifiedUser = await whop.verifyUserToken(typeof token === "string" ? token : null);
    const membership = await findWhopMembershipForUser(verifiedUser.userId);
    if (!membership) return redirect(res, `${appUrl()}/app?whop=no_membership`);

    let email = membership.user?.email;
    if (!email) throw new Error("Whop membership email is unavailable");

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

    const destination = new URL(`${appUrl()}/app`);
    destination.searchParams.set("whop", "connected");
    destination.hash = new URLSearchParams({
      access_token: verified.session.access_token,
      refresh_token: verified.session.refresh_token,
      expires_in: String(verified.session.expires_in),
      token_type: verified.session.token_type || "bearer",
      type: "magiclink"
    }).toString();
    return redirect(res, destination.toString());
  } catch (error) {
    console.error("whop-app-session failed", error?.message || error);
    return redirect(res, `${appUrl()}/app?whop=oauth_error`);
  }
}
