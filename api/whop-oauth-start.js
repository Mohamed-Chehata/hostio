import crypto from "node:crypto";
import {
  appUrl,
  createSignedState,
  handleOptions,
  oauthCookie,
  requiredEnv,
  sendJson
} from "./_lib/server.js";

function randomValue(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    const state = randomValue(20);
    const nonce = randomValue(20);
    const codeVerifier = randomValue(48);
    const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
    const redirectUri = process.env.WHOP_OAUTH_REDIRECT_URI || `${appUrl()}/api/whop-oauth-callback`;
    const signedState = createSignedState({
      state,
      nonce,
      codeVerifier,
      userId: null,
      expiresAt: Date.now() + 10 * 60 * 1000
    });

    res.setHeader("Set-Cookie", oauthCookie(signedState));
    const params = new URLSearchParams({
      response_type: "code",
      client_id: requiredEnv("WHOP_OAUTH_CLIENT_ID"),
      redirect_uri: redirectUri,
      scope: "openid email",
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: "S256"
    });
    return sendJson(res, 200, { url: `https://api.whop.com/oauth/authorize?${params}` });
  } catch (error) {
    console.error("whop-oauth-start failed", error?.message || error);
    return sendJson(res, 500, { error: "Something went wrong" });
  }
}
