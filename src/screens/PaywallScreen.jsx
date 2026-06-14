import { Check, LogOut } from "lucide-react";
import { PRICING } from "../config/pricing";

export function PaywallScreen({ subscription, onSubscribe, onSignOut }) {
  const trialEnded = subscription?.status === "trialing";

  return (
    <main className="mx-auto flex min-h-screen max-w-[390px] flex-col bg-[#080A0C] px-5 py-10 text-[#FFFFFF]">
      <div className="flex flex-1 flex-col justify-center">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#FFD358]">Hostrack</p>
        <h1 className="mt-3 text-3xl font-extrabold">
          {trialEnded ? "Your trial has ended" : "Subscription required"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#9A9A9A]">
          Subscribe to continue using Hostrack
        </p>

        <section className="mt-8 rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-[#9A9A9A]">Monthly plan</p>
          <p className="mt-3 text-4xl font-extrabold text-[#FFD358]">
            {PRICING.monthly.displayPrice}
            <span className="text-base font-bold text-[#9A9A9A]">/month</span>
          </p>
          <div className="mt-5 flex items-center gap-3 text-sm font-bold">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-[#FFD358] text-[#0A0A0A]">
              <Check size={14} strokeWidth={3} />
            </span>
            Unlimited properties, unlimited bookings
          </div>
          <button
            type="button"
            onClick={onSubscribe}
            className="mt-7 min-h-12 w-full rounded-2xl bg-[#FFD358] px-4 py-3 text-sm font-extrabold text-[#0A0A0A] transition-transform active:scale-[0.98]"
          >
            Subscribe
          </button>
        </section>
      </div>

      <button
        type="button"
        onClick={onSignOut}
        className="mx-auto flex min-h-11 items-center gap-2 px-4 text-sm font-bold text-[#9A9A9A]"
      >
        <LogOut size={16} />
        Sign out
      </button>
    </main>
  );
}
