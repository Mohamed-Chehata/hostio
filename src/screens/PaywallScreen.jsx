import { useState } from "react";
import { ArrowLeft, Check, LoaderCircle, LogOut } from "lucide-react";
import { PLANS } from "../config/pricing";

export function PaywallScreen({ subscription, onChoosePlan, onBack, onSignOut }) {
  const [loadingPlan, setLoadingPlan] = useState(null);
  const trialEnded = subscription?.status === "trialing"
    && new Date(subscription.trial_ends_at).getTime() <= Date.now();

  async function choosePlan(plan) {
    if (loadingPlan) return;
    setLoadingPlan(plan);
    try {
      await onChoosePlan(plan);
    } catch {
      setLoadingPlan(null);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-[390px] bg-app px-5 py-8 text-white">
      {onBack && (
        <button onClick={onBack} aria-label="Go back" className="mb-5 grid h-11 w-11 place-items-center rounded-2xl bg-panel text-muted">
          <ArrowLeft size={18} />
        </button>
      )}
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-accent">Hostrack</p>
      <h1 className="mt-3 text-3xl font-extrabold">
        {trialEnded ? "Your trial has ended" : "Choose your plan"}
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted">Subscribe to continue using Hostrack</p>

      <div className="mt-7 space-y-3">
        {Object.entries(PLANS).map(([id, plan]) => {
          const popular = id === "growth";
          return (
            <section key={id} className={`relative rounded-2xl border bg-panel p-5 ${popular ? "border-accent shadow-glow" : "border-border"}`}>
              {popular && <span className="absolute -top-3 right-4 rounded-full bg-accent px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-ink">Most popular</span>}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold">{plan.name}</h2>
                  <p className="mt-1 text-xs font-semibold text-muted">{plan.description}</p>
                </div>
                <p className="shrink-0 text-2xl font-extrabold text-accent">${plan.price}<span className="text-xs text-muted">/month</span></p>
              </div>
              <p className="mt-4 flex items-center gap-2 text-sm font-bold">
                <Check size={16} className="text-accent" />
                {Number.isFinite(plan.propertyLimit) ? `Up to ${plan.propertyLimit} properties` : "Unlimited properties"}
              </p>
              <button onClick={() => choosePlan(id)} disabled={Boolean(loadingPlan)} className="mt-5 min-h-12 w-full rounded-2xl bg-accent px-4 text-sm font-extrabold text-ink disabled:opacity-70">
                {loadingPlan === id ? <LoaderCircle className="mx-auto animate-spin" size={19} /> : `Choose ${plan.name}`}
              </button>
            </section>
          );
        })}
      </div>

      {!onBack && (
        <button onClick={onSignOut} className="mx-auto mt-7 flex min-h-11 items-center gap-2 px-4 text-sm font-bold text-muted">
          <LogOut size={16} /> Sign out
        </button>
      )}
    </main>
  );
}
