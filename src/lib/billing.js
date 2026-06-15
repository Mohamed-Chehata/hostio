import { supabase } from "./supabase";

async function billingRequest(path, body = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Unauthorized");

  const response = await fetch(path, {
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
