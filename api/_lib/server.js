import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const PLAN_LIMITS = {
  starter: 2,
  growth: 9,
  pro: Infinity
};

export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
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

export function priceIds() {
  return {
    starter: process.env.STRIPE_PRICE_STARTER,
    growth: process.env.STRIPE_PRICE_GROWTH,
    pro: process.env.STRIPE_PRICE_PRO
  };
}

export function planFromPriceId(priceId) {
  const match = Object.entries(priceIds()).find(([, configuredId]) => configuredId && configuredId === priceId);
  return match?.[0] || null;
}

export function stripeId(value) {
  return typeof value === "string" ? value : value?.id || null;
}

export function subscriptionPeriodEnd(subscription) {
  return subscription?.current_period_end
    || subscription?.items?.data?.[0]?.current_period_end
    || null;
}

export function stripeStatus(status) {
  return status === "active" || status === "trialing" ? "active" : "expired";
}

export async function requireUser(req) {
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export function appUrl() {
  return (process.env.VITE_APP_URL || "https://hostio-tau.vercel.app").replace(/\/$/, "");
}

export function sendJson(res, status, body) {
  res.status(status).json(body);
}

export function parseBody(req) {
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return req.body || {};
}
