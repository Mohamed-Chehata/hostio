import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { getAuthError } from "../utils/errorHandler";
import { PRICING } from "../config/pricing";
import "../utils/storageMigration";

const PENDING_SIGNUP_KEY = "hostrackPendingSignup";
const PENDING_PROPERTY_NAME_KEY = "hostrack-pending-property-name";
const SIGNUP_SUCCESS_KEY = "hostrack-signup-success";
const PASSWORD_RECOVERY_KEY = "hostrackPasswordRecovery";
const VERIFIED_EVENT = "hostrack:email-verified";
const PASSWORD_RECOVERY_EVENT = "hostrack:password-recovery";
const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;
const APP_BASE_PATH = "/app";
const APP_REDIRECT_URL = `${APP_URL.replace(/\/$/, "")}${APP_BASE_PATH}`;
const RESET_REDIRECT_URL = `${APP_REDIRECT_URL}/reset-password`;

function readCachedSession() {
  try {
    const authKey = Object.keys(localStorage).find((key) => key.startsWith("sb-") && key.endsWith("-auth-token"));
    if (!authKey) return null;
    const stored = JSON.parse(localStorage.getItem(authKey) || "null");
    const session = stored?.currentSession || stored;
    if (!session?.user || !session?.access_token) return null;
    if (session.expires_at && session.expires_at * 1000 <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

function logError(error) {
  if (import.meta.env.DEV) console.error(error?.message || error);
}

function readPendingSignup() {
  try {
    const value = localStorage.getItem(PENDING_SIGNUP_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function writePendingSignup(email) {
  localStorage.setItem(PENDING_SIGNUP_KEY, JSON.stringify({ email }));
}

function clearPendingSignup() {
  localStorage.removeItem(PENDING_SIGNUP_KEY);
  localStorage.removeItem(PENDING_PROPERTY_NAME_KEY);
}

function getPendingSignupForUser(user) {
  const pending = readPendingSignup();
  if (!pending?.email || pending.email.toLowerCase() !== user.email?.toLowerCase()) return null;
  return pending;
}

function notifyEmailVerified(propertyName) {
  window.dispatchEvent(new CustomEvent(VERIFIED_EVENT, { detail: { propertyName } }));
}

function notifyPasswordRecovery() {
  window.dispatchEvent(new CustomEvent(PASSWORD_RECOVERY_EVENT));
}

export async function initNewUser(userId, propertyName = "My Property") {
  const { data: existingProperty, error: propertyReadError } = await supabase
    .from("properties")
    .select("id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (propertyReadError) throw propertyReadError;

  if (!existingProperty) {
    const { error } = await supabase
      .from("properties")
      .insert({ user_id: userId, name: propertyName || "My Property" });
    if (error) throw error;
  }

  const { data: existingSettings, error: settingsReadError } = await supabase
    .from("user_settings")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (settingsReadError) throw settingsReadError;

  if (!existingSettings) {
    const { error } = await supabase
      .from("user_settings")
      .insert({
        user_id: userId,
        currency: "EUR",
        currency_symbol: "€",
        cost_label_1: "Rent",
        cost_label_2: "Cleaning",
        theme: "system"
      });
    if (error) throw error;
  }

  const { data: existingSubscription, error: subscriptionReadError } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (subscriptionReadError) throw subscriptionReadError;

  if (!existingSubscription) {
    const trialEndsAt = new Date(Date.now() + PRICING.trialDays * 86400000).toISOString();
    const { error } = await supabase
      .from("subscriptions")
      .insert({
        user_id: userId,
        status: "trialing",
        trial_ends_at: trialEndsAt
      });
    if (error) throw error;
  }
}

export function useAuth() {
  const cachedSession = readCachedSession();
  const [session, setSession] = useState(cachedSession);
  const [user, setUser] = useState(cachedSession?.user ?? null);
  const [isAuthLoading, setIsAuthLoading] = useState(!cachedSession);
  const [authError, setAuthError] = useState(null);
  const revealSessionTimer = useRef(null);
  const hasInitialized = useRef(false);

  useEffect(() => {
    let mounted = true;

    async function revealVerifiedSession(nextSession, pendingSignup) {
      if (hasInitialized.current) return;
      hasInitialized.current = true;
      const propertyName = localStorage.getItem(PENDING_PROPERTY_NAME_KEY)
        || nextSession.user.user_metadata?.property_name
        || "My Property";
      try {
        await initNewUser(nextSession.user.id, propertyName);
        sessionStorage.setItem(SIGNUP_SUCCESS_KEY, propertyName);
        clearPendingSignup();
        notifyEmailVerified(propertyName);
        clearTimeout(revealSessionTimer.current);
        revealSessionTimer.current = setTimeout(() => {
          if (!mounted) return;
          setSession(nextSession);
          setUser(nextSession.user);
        }, 1500);
      } catch (error) {
        hasInitialized.current = false;
        logError(error);
        setAuthError(getAuthError(error));
      }
    }

    supabase.auth.getSession().then(async ({ data, error }) => {
      if (!mounted) return;
      if (error) {
        logError(error);
        setAuthError(getAuthError(error));
      }
      if (window.location.pathname === `${APP_BASE_PATH}/reset-password` && data.session?.user) {
        localStorage.setItem(PASSWORD_RECOVERY_KEY, "true");
        notifyPasswordRecovery();
        setSession(null);
        setUser(null);
        setIsAuthLoading(false);
        return;
      }
      if (data.session?.user) {
        const pendingSignup = getPendingSignupForUser(data.session.user);
        if (pendingSignup) {
          setSession(null);
          setUser(null);
          setIsAuthLoading(false);
          await revealVerifiedSession(data.session, pendingSignup);
          return;
        }
      }
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setIsAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (event === "SIGNED_OUT") {
        hasInitialized.current = false;
      }

      if (event === "PASSWORD_RECOVERY" && nextSession?.user) {
        localStorage.setItem(PASSWORD_RECOVERY_KEY, "true");
        notifyPasswordRecovery();
        setSession(null);
        setUser(null);
        setIsAuthLoading(false);
        return;
      }

      if (event === "SIGNED_IN" && nextSession?.user) {
        if (window.location.pathname === `${APP_BASE_PATH}/reset-password` || localStorage.getItem(PASSWORD_RECOVERY_KEY) === "true") {
          localStorage.setItem(PASSWORD_RECOVERY_KEY, "true");
          notifyPasswordRecovery();
          setSession(null);
          setUser(null);
          setIsAuthLoading(false);
          return;
        }

        const pendingSignup = getPendingSignupForUser(nextSession.user);
        if (pendingSignup) {
          setSession(null);
          setUser(null);
          setIsAuthLoading(false);
          await revealVerifiedSession(nextSession, pendingSignup);
          return;
        }

        try {
          if (!hasInitialized.current) {
            hasInitialized.current = true;
            await initNewUser(nextSession.user.id, nextSession.user.user_metadata?.property_name || "My Property");
          }
        } catch (error) {
          hasInitialized.current = false;
          logError(error);
          setAuthError(getAuthError(error));
        }
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setIsAuthLoading(false);
    });

    return () => {
      mounted = false;
      clearTimeout(revealSessionTimer.current);
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email, password) {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      logError(error);
      setAuthError(getAuthError(error));
      throw error;
    }
    sessionStorage.setItem("activeTab", "dashboard");
    sessionStorage.removeItem("statsPageIndex");
  }

  async function signUp(email, password, propertyName = "My Property") {
    setAuthError(null);
    const pendingPropertyName = propertyName.trim() || "My Property";
    localStorage.setItem(PENDING_PROPERTY_NAME_KEY, pendingPropertyName);
    writePendingSignup(email);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: APP_REDIRECT_URL,
        data: { property_name: pendingPropertyName }
      }
    });
    if (error) {
      clearPendingSignup();
      logError(error);
      setAuthError(getAuthError(error));
      throw error;
    }
    return data;
  }

  async function signOut() {
    setAuthError(null);
    const { error } = await supabase.auth.signOut();
    if (error) {
      logError(error);
      setAuthError(getAuthError(error));
      throw error;
    }
    hasInitialized.current = false;
    localStorage.removeItem("activePropertyId");
    localStorage.removeItem(PASSWORD_RECOVERY_KEY);
    localStorage.removeItem("hostrack-data-cache");
    localStorage.removeItem("hostrack-base-cache");
    localStorage.removeItem("hostrack-subscription-cache");
    localStorage.removeItem("hostrack-pending-sync");
    localStorage.removeItem("hostrack-sync-id-map");
    sessionStorage.removeItem("activeTab");
    sessionStorage.removeItem("statsPageIndex");
  }

  async function sendPasswordReset() {
    if (!user?.email) return false;
    setAuthError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: RESET_REDIRECT_URL
    });
    if (error) {
      logError(error);
      setAuthError(getAuthError(error));
      return false;
    }
    return true;
  }

  return { session, user, isAuthLoading, authError, signIn, signUp, signOut, sendPasswordReset };
}
