import { useEffect, useState } from "react";
import { PLANS } from "../config/pricing";

const catalogCache = new Map();

export function usePlanCatalog(audience = "hidden") {
  const [plans, setPlans] = useState(() => catalogCache.get(audience) || PLANS);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/whop-plan-catalog?audience=${audience}`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Plan catalog unavailable")))
      .then((result) => {
        if (cancelled || !result?.plans) return;
        const merged = Object.fromEntries(Object.entries(PLANS).map(([id, fallback]) => [
          id,
          { ...fallback, ...(result.plans[id] || {}) }
        ]));
        catalogCache.set(audience, merged);
        setPlans(merged);
      })
      .catch(() => null);
    return () => { cancelled = true; };
  }, [audience]);

  return plans;
}
