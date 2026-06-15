import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Check, LoaderCircle, LogOut } from "lucide-react";
import { PLANS, PRICING } from "../config/pricing";

const planOrder = ["starter", "growth", "pro"];

export function PaywallScreen({ subscription, onChoosePlan, onBack, onSignOut }) {
  const [loadingPlan, setLoadingPlan] = useState(null);

  async function choosePlan(plan) {
    if (loadingPlan) return;
    setLoadingPlan(plan);
    try {
      await onChoosePlan(plan);
    } catch (error) {
      console.error("Checkout redirect failed", error);
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
      <header className="text-center">
        <h1 className="text-2xl font-extrabold">Choose your plan</h1>
        <p className="mt-2 text-sm font-semibold text-muted">Start with a {PRICING.trialDays}-day free trial. Cancel anytime.</p>
      </header>

      <div className="mt-7 space-y-4">
        {planOrder.map((id, index) => {
          const plan = PLANS[id];
          const popular = id === "growth";
          return (
            <motion.section
              key={id}
              initial={{ opacity: 0, y: 20, boxShadow: "0 0 0 rgba(255, 211, 88, 0)" }}
              animate={{
                opacity: 1,
                y: 0,
                boxShadow: popular
                  ? ["0 0 0 rgba(255, 211, 88, 0)", "0 0 24px rgba(255, 211, 88, 0.35)", "0 0 0 rgba(255, 211, 88, 0)"]
                  : "0 0 0 rgba(255, 211, 88, 0)"
              }}
              transition={{
                opacity: { duration: 0.3, delay: index * 0.1, ease: "easeOut" },
                y: { duration: 0.3, delay: index * 0.1, ease: "easeOut" },
                boxShadow: popular ? { duration: 1, delay: 0.4, ease: "easeOut" } : { duration: 0 }
              }}
              whileTap={{ scale: 0.98 }}
              className={`relative rounded-2xl border bg-panel transition-transform duration-100 ${
                popular ? "border-2 border-accent p-6" : "border-border p-5"
              }`}
            >
              {popular && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.2, delay: 0.55, type: "spring", stiffness: 420, damping: 20 }}
                  className="absolute right-4 top-4 rounded-full bg-accent px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-ink"
                >
                  Most popular
                </motion.span>
              )}

              <h2 className="text-lg font-extrabold">{plan.name}</h2>
              <div className="mt-3 flex items-end gap-1">
                <span className="text-[28px] font-extrabold leading-none">${plan.price}</span>
                <span className="pb-0.5 text-sm font-semibold text-muted">/month</span>
              </div>

              <div className="mt-4">
                <span className="inline-flex min-h-7 items-center rounded-full bg-app px-3 text-xs font-bold text-muted">
                  <Check size={13} className="mr-1.5 text-accent" />
                  {Number.isFinite(plan.propertyLimit) ? `Up to ${plan.propertyLimit} properties` : "Unlimited properties"}
                </span>
              </div>

              <p className="mt-4 text-[13px] font-semibold leading-5 text-muted">{plan.description}</p>

              <button
                onClick={() => choosePlan(id)}
                disabled={Boolean(loadingPlan)}
                className={`mt-5 min-h-12 w-full rounded-2xl px-4 text-sm font-extrabold transition-[background-color,color,border-color,opacity,transform] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${
                  popular
                    ? "border border-accent bg-accent text-ink"
                    : "border border-border bg-transparent text-white"
                }`}
              >
                {loadingPlan === id ? <LoaderCircle className="mx-auto animate-spin" size={19} /> : `Choose ${plan.name}`}
              </button>
            </motion.section>
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
