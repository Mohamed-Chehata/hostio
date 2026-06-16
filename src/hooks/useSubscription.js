import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const SUBSCRIPTION_CACHE_KEY = "hostrack-subscription-cache";

function readCachedSubscription() {
  try {
    const value = localStorage.getItem(SUBSCRIPTION_CACHE_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function calculateAccess(subscription) {
  if (!subscription) return false;
  const now = Date.now();

  if (subscription.status === "trialing") {
    return new Date(subscription.trial_ends_at).getTime() > now;
  }

  if (subscription.status === "active") {
    return !subscription.current_period_end
      || new Date(subscription.current_period_end).getTime() > now;
  }

  return false;
}

export function useSubscription(user) {
  const cached = readCachedSubscription();
  const [subscription, setSubscription] = useState(cached?.subscription || null);
  const [resolvedUserId, setResolvedUserId] = useState(cached?.userId || null);
  const [error, setError] = useState(null);

  const fetchSubscription = useCallback(async () => {
    if (!user?.id) {
      setSubscription(null);
      setResolvedUserId(null);
      setError(null);
      return null;
    }

    setError(null);
    const { data, error: subscriptionError } = await supabase
      .from("subscriptions")
      .select("id,user_id,status,trial_ends_at,current_period_end,plan,needs_property_selection,stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (subscriptionError) {
      if (import.meta.env.DEV) console.error(subscriptionError.message);
      setError(subscriptionError);
      setSubscription(null);
    } else {
      setSubscription(data);
      localStorage.setItem(SUBSCRIPTION_CACHE_KEY, JSON.stringify({ userId: user.id, subscription: data }));
    }
    setResolvedUserId(user.id);
    return data;
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      fetchSubscription();
      return undefined;
    }
    fetchSubscription().then((data) => {
      if (cancelled) return;
      return data;
    });

    return () => {
      cancelled = true;
    };
  }, [fetchSubscription, user?.id]);

  const isResolved = !user?.id || resolvedUserId === user.id;
  const currentSubscription = isResolved ? subscription : null;
  const hasAccess = useMemo(() => calculateAccess(currentSubscription), [currentSubscription]);
  const trialDaysRemaining = useMemo(() => {
    if (currentSubscription?.status !== "trialing") return null;
    const milliseconds = new Date(currentSubscription.trial_ends_at).getTime() - Date.now();
    return Math.max(0, Math.ceil(milliseconds / 86400000));
  }, [currentSubscription]);

  return {
    subscription: currentSubscription,
    hasAccess,
    trialDaysRemaining,
    isLoading: Boolean(user?.id) && !isResolved,
    isResolved,
    error,
    refetch: fetchSubscription
  };
}
