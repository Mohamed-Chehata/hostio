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

async function billingRequest(path, body = {}, { auth = true } = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (auth && !token) throw new Error("Unauthorized");

  const response = await fetch(billingUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ ...body, ...(token ? { accessToken: token } : {}) })
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Something went wrong");
  return result;
}

export async function startCheckout(plan) {
  const { url, checkoutConfigurationId } = await billingRequest("/api/create-whop-checkout", { plan });
  localStorage.setItem("hostrack-pending-whop-checkout", checkoutConfigurationId);
  window.location.href = url;
}

export async function openBillingPortal() {
  const { url } = await billingRequest("/api/open-whop-membership");
  window.location.href = url;
}

export async function connectWhopAccount() {
  const { url } = await billingRequest("/api/whop-oauth-start", {}, { auth: false });
  window.location.href = url;
}

export async function reconcileWhopCheckout() {
  const checkoutConfigurationId = localStorage.getItem("hostrack-pending-whop-checkout");
  if (!checkoutConfigurationId) return null;
  const result = await billingRequest("/api/reconcile-whop-checkout", { checkoutConfigurationId });
  if (result.active) localStorage.removeItem("hostrack-pending-whop-checkout");
  return result;
}

export function confirmPropertySelection(propertyIds) {
  return billingRequest("/api/confirm-property-selection", { propertyIds });
}
