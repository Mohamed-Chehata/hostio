import {
  appUrl,
  ensureHostrackUserRows,
  findWhopMembershipForUser,
  getSupabaseAdmin,
  getSupabaseAuthClient,
  oauthCookie,
  parseCookies,
  readSignedState,
  requiredEnv
} from "./_lib/server.js";

function redirect(res, location) {
  res.setHeader("Location", location);
  res.status(302).end();
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  res.setHeader("Set-Cookie", oauthCookie("", 0));

  try {
    const stored = readSignedState(parseCookies(req).hostrack_whop_oauth);
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    if (!stored || !code || state !== stored.state || req.query.error) {
      return redirect(res, `${appUrl()}/app?whop=oauth_error`);
    }

    const redirectUri = process.env.WHOP_OAUTH_REDIRECT_URI || `${appUrl()}/api/whop-oauth-callback`;
    const tokenBody = {
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: requiredEnv("WHOP_OAUTH_CLIENT_ID"),
      code_verifier: stored.codeVerifier
    };
    if (process.env.WHOP_OAUTH_CLIENT_SECRET) tokenBody.client_secret = process.env.WHOP_OAUTH_CLIENT_SECRET;
    const tokenResponse = await fetch("https://api.whop.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tokenBody)
    });
    if (!tokenResponse.ok) throw new Error("Whop token exchange failed");
    const tokens = await tokenResponse.json();
    const userResponse = await fetch("https://api.whop.com/oauth/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    if (!userResponse.ok) throw new Error("Whop user lookup failed");
    const whopUser = await userResponse.json();
    if (!whopUser.sub || !whopUser.email || whopUser.email_verified !== true) {
      return redirect(res, `${appUrl()}/app?whop=email_unverified`);
    }

    const membership = await findWhopMembershipForUser(whopUser.sub);
    if (!membership) return redirect(res, `${appUrl()}/app?whop=no_membership`);

    const supabase = getSupabaseAdmin();
    const { data: linkedEntitlement, error: linkedEntitlementError } = await supabase
      .from("whop_entitlements")
      .select("hostrack_user_id")
      .eq("whop_user_id", whopUser.sub)
      .maybeSingle();
    if (linkedEntitlementError) throw linkedEntitlementError;

    let loginEmail = whopUser.email;
    let targetUserId = null;
    const hostrackUserId = stored.userId || linkedEntitlement?.hostrack_user_id;
    if (hostrackUserId) {
      const { data: linkedUser, error: linkedUserError } = await supabase.auth.admin.getUserById(hostrackUserId);
      if (linkedUserError || !linkedUser?.user?.email) throw linkedUserError || new Error("Linked Hostrack user is unavailable");
      loginEmail = linkedUser.user.email;
      targetUserId = linkedUser.user.id;
    } else {
      const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
        email: loginEmail,
        email_confirm: true,
        user_metadata: {
          provider: "whop",
          whop_user_id: whopUser.sub
        }
      });
      if (createUserError && !String(createUserError.message || "").toLowerCase().includes("already")) {
        throw createUserError;
      }
      targetUserId = createdUser?.user?.id || null;
    }

    let { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: loginEmail
    });
    if (linkError && targetUserId) {
      const { data: linkedUser, error: linkedUserError } = await supabase.auth.admin.getUserById(targetUserId);
      if (linkedUserError || !linkedUser?.user?.email) throw linkError;
      loginEmail = linkedUser.user.email;
      ({ data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: loginEmail
      }));
    }
    if (linkError || !linkData?.user?.id || !linkData?.properties?.hashed_token) {
      throw linkError || new Error("Could not create Hostrack session");
    }
    await ensureHostrackUserRows(linkData.user.id, { whopMembership: membership });

    const { data: verified, error: verifyError } = await getSupabaseAuthClient().auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: linkData.properties.verification_type || "magiclink"
    });
    if (verifyError || !verified.session) throw verifyError || new Error("Could not verify Hostrack session");

    if (tokens.refresh_token) {
      await fetch("https://api.whop.com/oauth/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokens.refresh_token, client_id: requiredEnv("WHOP_OAUTH_CLIENT_ID") })
      }).catch(() => null);
    }
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
    console.error("whop-oauth-callback failed", error?.message || error);
    return redirect(res, `${appUrl()}/app?whop=oauth_error`);
  }
}
