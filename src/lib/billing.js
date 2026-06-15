import { supabase } from "./supabase";

const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;

function isLocalDevHost(hostname) {
  return hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname.startsWith("192.168.")
    || hostname.startsWith("10.")
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);
}

function billingUrl(path) {
  const appOrigin = APP_URL.replace(/\/$/, "");
  if (isLocalDevHost(window.location.hostname) && !appOrigin.includes(window.location.host)) {
    return `${appOrigin}${path}`;
  }
  return path;
}

async function billingRequest(path, body = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Unauthorized");

  const response = await fetch(billingUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Something went wrong");
  return result;
}

export async function startCheckout(plan, userId) {
  const { url } = await billingRequest("/api/create-checkout-session", { plan, userId });
  window.location.href = url;
}

export async function openBillingPortal(userId) {
  const { url } = await billingRequest("/api/create-portal-session", { userId });
  window.location.href = url;
}

export function confirmPropertySelection(propertyIds) {
  return billingRequest("/api/confirm-property-selection", { propertyIds });
}
