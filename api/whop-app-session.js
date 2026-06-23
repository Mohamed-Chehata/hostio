import {
  appUrl,
  ensureHostrackUserRows,
  findWhopMembershipForUser,
  getSupabaseAdmin,
  getSupabaseAuthClient,
  getWhop,
  requiredEnv
} from "./_lib/server.js";

function redirect(res, location) {
  res.setHeader("Location", location);
  res.status(302).end();
}

function redirectFailure(res, reason) {
  return redirect(res, `${appUrl()}/app?whop=oauth_error&reason=${encodeURIComponent(reason)}`);
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

async function resolveWhopUser(req, whop) {
  const token = req.headers["x-whop-user-token"];
  if (token) {
    const verifiedUser = await whop.verifyUserToken(typeof token === "string" ? token : null);
    return { userId: verifiedUser.userId, email: null };
  }

  const code = typeof req.query.code === "string" ? req.query.code : "";
  if (!code) throw new Error("missing_whop_user_token");

  const redirectUri = `${appUrl()}/`;
  const tokenBody = {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: requiredEnv("WHOP_OAUTH_CLIENT_ID")
  };
  if (process.env.WHOP_OAUTH_CLIENT_SECRET) tokenBody.client_secret = process.env.WHOP_OAUTH_CLIENT_SECRET;

  const tokenResponse = await fetch("https://api.whop.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tokenBody)
  });
  if (!tokenResponse.ok) throw new Error(`root_code_exchange_failed_${tokenResponse.status}`);

  const tokens = await tokenResponse.json();
  const userResponse = await fetch("https://api.whop.com/oauth/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  });
  if (!userResponse.ok) throw new Error(`root_code_userinfo_failed_${userResponse.status}`);

  const whopUser = await userResponse.json();
  if (!whopUser.sub) throw new Error("root_code_missing_user");
  if (whopUser.email_verified === false) throw new Error("whop_email_unverified");
  return { userId: whopUser.sub, email: whopUser.email || null };
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  try {
    const whop = getWhop();
    const whopUser = await resolveWhopUser(req, whop);
    const membership = await findWhopMembershipForUser(whopUser.userId);
    if (!membership) return redirect(res, `${appUrl()}/app?whop=no_membership&reason=no_membership_for_whop_user`);

    let email = membership.user?.email || whopUser.email;
    if (!email) return redirectFailure(res, "missing_whop_membership_email");

    const supabase = getSupabaseAdmin();
    const { data: linkedEntitlement, error: linkedEntitlementError } = await supabase
      .from("whop_entitlements")
      .select("hostrack_user_id")
      .eq("whop_user_id", whopUser.userId)
      .maybeSingle();
    if (linkedEntitlementError) throw linkedEntitlementError;

    let userId = linkedEntitlement?.hostrack_user_id || null;
    if (userId) {
      const { data: linkedUser, error: linkedUserError } = await supabase.auth.admin.getUserById(userId);
      if (linkedUserError || !linkedUser?.user?.email) throw linkedUserError || new Error("Linked Hostrack user is unavailable");
      email = linkedUser.user.email;
    } else {
      const user = await createOrFindHostrackUser(supabase, email, whopUser.userId);
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
    return redirectFailure(res, error?.message || "app_session_failed");
  }
}
