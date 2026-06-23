import crypto from "node:crypto";
import Whop from "@whop/sdk";
import { createClient } from "@supabase/supabase-js";

export const PLAN_LIMITS = {
  starter: 2,
  growth: 9,
  pro: Infinity
};

let whopClient;

export function getWhop() {
  if (!process.env.WHOP_API_KEY) throw new Error("Missing WHOP_API_KEY");
  if (!whopClient) {
    whopClient = new Whop({
      apiKey: process.env.WHOP_API_KEY,
      appID: process.env.WHOP_OAUTH_CLIENT_ID || process.env.NEXT_PUBLIC_WHOP_APP_ID || null,
      webhookKey: process.env.WHOP_WEBHOOK_SECRET || null
    });
  }
  return whopClient;
}

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase server environment variables");
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export function getSupabaseAuthClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing Supabase public environment variables");
  }
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export function whopPlanIds() {
  return {
    public: {
      starter: process.env.WHOP_PUBLIC_PLAN_STARTER,
      growth: process.env.WHOP_PUBLIC_PLAN_GROWTH,
      pro: process.env.WHOP_PUBLIC_PLAN_PRO
    },
    hidden: {
      starter: process.env.WHOP_HIDDEN_PLAN_STARTER,
      growth: process.env.WHOP_HIDDEN_PLAN_GROWTH,
      pro: process.env.WHOP_HIDDEN_PLAN_PRO
    }
  };
}

export function planFromWhopPlanId(planId) {
  for (const plans of Object.values(whopPlanIds())) {
    const match = Object.entries(plans).find(([, configuredId]) => configuredId && configuredId === planId);
    if (match) return match[0];
  }
  return null;
}

export function whopStatusHasAccess(status) {
  return ["active", "trialing", "canceling"].includes(status);
}

export function validateWhopMembership(membership) {
  const plan = planFromWhopPlanId(membership?.plan?.id);
  if (!plan) throw new Error("Unknown Whop plan");
  if (membership?.company?.id !== process.env.WHOP_COMPANY_ID) throw new Error("Unknown Whop company");
  if (membership?.product?.id !== process.env.WHOP_PRODUCT_ID) throw new Error("Unknown Whop product");
  if (!membership?.user?.id) throw new Error("Whop membership has no user");
  return plan;
}

export async function updatePlanLimits(supabase, userId, oldPlan, newPlan) {
  const oldLimit = PLAN_LIMITS[oldPlan] ?? Infinity;
  const newLimit = PLAN_LIMITS[newPlan] ?? Infinity;
  if (oldLimit === newLimit) return;

  if (newLimit < oldLimit) {
    const { count, error } = await supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if (error) throw error;
    const needsSelection = Number(count || 0) > newLimit;
    const { error: updateError } = await supabase
      .from("subscriptions")
      .update({ needs_property_selection: needsSelection })
      .eq("user_id", userId);
    if (updateError) throw updateError;
    return;
  }

  const [{ error: propertyError }, { error: subscriptionError }] = await Promise.all([
    supabase.from("properties").update({ is_locked: false }).eq("user_id", userId),
    supabase.from("subscriptions").update({ needs_property_selection: false }).eq("user_id", userId)
  ]);
  if (propertyError || subscriptionError) throw propertyError || subscriptionError;
}

export async function syncWhopMembership(membership, explicitUserId = null) {
  const plan = validateWhopMembership(membership);
  const supabase = getSupabaseAdmin();
  const whopUserId = membership.user.id;
  const metadataUserId = typeof membership.metadata?.hostrack_user_id === "string"
    ? membership.metadata.hostrack_user_id
    : null;

  const { data: existingEntitlement, error: entitlementReadError } = await supabase
    .from("whop_entitlements")
    .select("hostrack_user_id")
    .eq("whop_user_id", whopUserId)
    .maybeSingle();
  if (entitlementReadError) throw entitlementReadError;

  const hostrackUserId = explicitUserId || existingEntitlement?.hostrack_user_id || metadataUserId;
  if (existingEntitlement?.hostrack_user_id && hostrackUserId && existingEntitlement.hostrack_user_id !== hostrackUserId) {
    throw new Error("Whop account is already linked");
  }

  const entitlement = {
    whop_user_id: whopUserId,
    whop_membership_id: membership.id,
    hostrack_user_id: hostrackUserId || null,
    email: membership.user.email || null,
    plan,
    whop_plan_id: membership.plan.id,
    product_id: membership.product.id,
    company_id: membership.company.id,
    status: membership.status,
    current_period_end: membership.renewal_period_end || null,
    manage_url: membership.manage_url || null,
    cancel_at_period_end: Boolean(membership.cancel_at_period_end),
    updated_at: new Date().toISOString()
  };
  const { error: entitlementError } = await supabase
    .from("whop_entitlements")
    .upsert(entitlement, { onConflict: "whop_user_id" });
  if (entitlementError) throw entitlementError;

  if (!hostrackUserId) return { plan, entitlement, hostrackUserId: null };

  const { data: current, error: currentError } = await supabase
    .from("subscriptions")
    .select("plan")
    .eq("user_id", hostrackUserId)
    .maybeSingle();
  if (currentError) throw currentError;

  const access = whopStatusHasAccess(membership.status);
  const localStatus = membership.status === "trialing" ? "trialing" : access ? "active" : "expired";
  const trialEndsAt = membership.status === "trialing" && membership.renewal_period_end
    ? membership.renewal_period_end
    : new Date().toISOString();
  const { error: subscriptionError } = await supabase
    .from("subscriptions")
    .upsert({
      user_id: hostrackUserId,
      status: localStatus,
      trial_ends_at: trialEndsAt,
      current_period_end: membership.renewal_period_end || null,
      plan,
      billing_provider: "whop",
      whop_user_id: whopUserId,
      whop_membership_id: membership.id,
      whop_plan_id: membership.plan.id,
      whop_manage_url: membership.manage_url || null,
      cancel_at_period_end: Boolean(membership.cancel_at_period_end),
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id" });
  if (subscriptionError) throw subscriptionError;

  if (access) await updatePlanLimits(supabase, hostrackUserId, current?.plan, plan);
  return { plan, entitlement, hostrackUserId };
}

export async function findWhopMembershipForUser(whopUserId) {
  const page = await getWhop().memberships.list({
    company_id: requiredEnv("WHOP_COMPANY_ID"),
    product_ids: [requiredEnv("WHOP_PRODUCT_ID")],
    user_ids: [whopUserId],
    first: 20
  });
  const memberships = page.data || [];
  return memberships
    .filter((membership) => planFromWhopPlanId(membership.plan?.id))
    .sort((a, b) => {
      const accessDifference = Number(whopStatusHasAccess(b.status)) - Number(whopStatusHasAccess(a.status));
      return accessDifference || new Date(b.updated_at) - new Date(a.updated_at);
    })[0] || null;
}

export async function findWhopMembershipForCheckout(checkoutConfigurationId) {
  const payments = await getWhop().payments.list({
    company_id: requiredEnv("WHOP_COMPANY_ID"),
    checkout_configuration_ids: [checkoutConfigurationId],
    substatuses: ["succeeded"],
    first: 5
  });
  const membershipId = payments.data?.find((payment) => payment.membership?.id)?.membership?.id;
  return membershipId ? getWhop().memberships.retrieve(membershipId) : null;
}

export async function ensureHostrackUserRows(userId, { whopMembership = null } = {}) {
  const supabase = getSupabaseAdmin();
  const [{ data: property, error: propertyReadError }, { data: settings, error: settingsReadError }] = await Promise.all([
    supabase.from("properties").select("id").eq("user_id", userId).limit(1).maybeSingle(),
    supabase.from("user_settings").select("id").eq("user_id", userId).maybeSingle()
  ]);
  if (propertyReadError || settingsReadError) throw propertyReadError || settingsReadError;

  if (!property) {
    const { error } = await supabase.from("properties").insert({ user_id: userId, name: "My Property" });
    if (error) throw error;
  }
  if (!settings) {
    const { error } = await supabase.from("user_settings").insert({
      user_id: userId,
      currency: "EUR",
      currency_symbol: "€",
      cost_label_1: "Rent",
      cost_label_2: "Cleaning",
      theme: "system"
    });
    if (error) throw error;
  }
  if (whopMembership) await syncWhopMembership(whopMembership, userId);
}

export function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export function createSignedState(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", requiredEnv("WHOP_OAUTH_STATE_SECRET")).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function readSignedState(value) {
  if (!value || !value.includes(".")) return null;
  const [encoded, signature] = value.split(".");
  const expected = crypto.createHmac("sha256", requiredEnv("WHOP_OAUTH_STATE_SECRET")).update(encoded).digest("base64url");
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  return parsed.expiresAt > Date.now() ? parsed : null;
}

export function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || "").split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf("=");
    return [decodeURIComponent(part.slice(0, index)), decodeURIComponent(part.slice(index + 1))];
  }));
}

export function oauthCookie(value, maxAge = 600) {
  return `hostrack_whop_oauth=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export async function requireUser(req) {
  const authorization = req.headers.authorization || "";
  const body = parseBody(req);
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : typeof body.accessToken === "string"
      ? body.accessToken
      : "";
  if (!token) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export function appUrl() {
  return (process.env.VITE_APP_URL || "https://www.hostrack.app").replace(/\/$/, "");
}

export function sendJson(res, status, body) {
  setCorsHeaders(res);
  res.status(status).json(body);
}

export function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export function handleOptions(req, res) {
  if (req.method !== "OPTIONS") return false;
  setCorsHeaders(res);
  res.status(204).end();
  return true;
}

export function parseBody(req) {
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return req.body || {};
}
