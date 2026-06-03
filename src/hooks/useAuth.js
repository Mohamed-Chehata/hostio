import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function logError(error) {
  if (import.meta.env.DEV) console.error(error?.message || error);
}

export async function initNewUser(userId, propertyName = "My Property") {
  const { data: existingProperty, error: propertyReadError } = await supabase
    .from("properties")
    .select("id")
    .eq("user_id", userId)
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
        cost_label_2: "Cleaning"
      });
    if (error) throw error;
  }
}

export function useAuth() {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        logError(error);
        setAuthError("Something went wrong");
      }
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setIsAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setIsAuthLoading(false);

      if (event === "SIGNED_IN" && nextSession?.user) {
        try {
          await initNewUser(nextSession.user.id, nextSession.user.user_metadata?.property_name || "My Property");
        } catch (error) {
          logError(error);
          setAuthError("Something went wrong");
        }
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email, password) {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      logError(error);
      setAuthError("Invalid email or password");
      throw error;
    }
  }

  async function signUp(email, password, propertyName = "My Property") {
    setAuthError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { property_name: propertyName } }
    });
    if (error) {
      logError(error);
      setAuthError("Something went wrong");
      throw error;
    }
    if (data.session?.user) {
      await initNewUser(data.session.user.id, propertyName);
    }
    return data;
  }

  async function signOut() {
    setAuthError(null);
    const { error } = await supabase.auth.signOut();
    if (error) {
      logError(error);
      setAuthError("Something went wrong");
      throw error;
    }
    localStorage.removeItem("activePropertyId");
  }

  return { session, user, isAuthLoading, authError, signIn, signUp, signOut };
}
