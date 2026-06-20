import {
  appUrl,
  ensureHostrackUserRows,
  findWhopMembershipForUser,
  getSupabaseAdmin,
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
    if (stored.userId) {
      await ensureHostrackUserRows(stored.userId, { whopMembership: membership });
      return redirect(res, `${appUrl()}/app?whop=connected`);
    }

    const { data: linkedEntitlement, error: linkedEntitlementError } = await supabase
      .from("whop_entitlements")
      .select("hostrack_user_id")
      .eq("whop_user_id", whopUser.sub)
      .maybeSingle();
    if (linkedEntitlementError) throw linkedEntitlementError;

    let loginEmail = whopUser.email;
    if (linkedEntitlement?.hostrack_user_id) {
      const { data: linkedUser, error: linkedUserError } = await supabase.auth.admin.getUserById(linkedEntitlement.hostrack_user_id);
      if (linkedUserError || !linkedUser?.user?.email) throw linkedUserError || new Error("Linked Hostrack user is unavailable");
      loginEmail = linkedUser.user.email;
    }

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: loginEmail,
      options: { redirectTo: `${appUrl()}/app?whop=connected` }
    });
    if (linkError || !linkData?.user?.id || !linkData?.properties?.action_link) throw linkError || new Error("Could not create Hostrack session");
    await ensureHostrackUserRows(linkData.user.id, { whopMembership: membership });

    if (tokens.refresh_token) {
      await fetch("https://api.whop.com/oauth/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokens.refresh_token, client_id: requiredEnv("WHOP_OAUTH_CLIENT_ID") })
      }).catch(() => null);
    }
    return redirect(res, linkData.properties.action_link);
  } catch (error) {
    console.error("whop-oauth-callback failed", error?.message || error);
    return redirect(res, `${appUrl()}/app?whop=oauth_error`);
  }
}
