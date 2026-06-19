import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, MoreVertical, Share, Smartphone } from "lucide-react";
import logo from "../assets/logo.png";
import { PLANS, PRICING } from "../config/pricing";
import { getDeviceType } from "../utils/device";

const PUBLIC_URL = (import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, "").replace(/\/app$/, "");

const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (index) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut", delay: index * 0.1 }
  })
};

const tabVariants = {
  enter: (direction) => ({ opacity: 0, x: direction * 14 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.2, ease: "easeOut" } },
  exit: (direction) => ({ opacity: 0, x: direction * -14, transition: { duration: 0.15, ease: "easeIn" } })
};

export function LandingPage({ onGetStarted }) {
  const [deviceType, setDeviceType] = useState(() => getDeviceType());
  const [platform, setPlatform] = useState(() => getDeviceType() === "iphone" ? "iphone" : "android");
  const [direction, setDirection] = useState(1);
  const isDesktop = deviceType === "desktop";
  const qrUrl = useMemo(() => `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(PUBLIC_URL)}`, []);

  useEffect(() => {
    function handleResize() {
      const nextType = getDeviceType();
      setDeviceType(nextType);
      if (nextType === "iphone") setPlatform("iphone");
      if (nextType === "android") setPlatform("android");
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  function selectPlatform(nextPlatform) {
    if (nextPlatform === platform) return;
    setDirection(nextPlatform === "iphone" ? 1 : -1);
    setPlatform(nextPlatform);
  }

  return (
    <main className="min-h-screen bg-app px-5 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[480px] flex-col justify-center">
        <motion.header custom={0} variants={sectionVariants} initial="hidden" animate="visible" className="text-center">
          <img src={logo} alt="Hostrack" className="mx-auto h-16 w-16 rounded-2xl object-cover shadow-glow" />
          <p className="mt-4 text-2xl font-extrabold tracking-[0.15em]">HOSTRACK</p>
          <h1 className="mt-8 text-4xl font-extrabold leading-tight tracking-tight">Manage your properties. Simplified.</h1>
          <p className="mx-auto mt-4 max-w-[340px] text-sm font-semibold leading-6 text-muted">
            Track bookings, expenses, and revenue for your Airbnb properties right from your phone.
          </p>
        </motion.header>

        {isDesktop ? (
          <motion.section custom={1} variants={sectionVariants} initial="hidden" animate="visible" className="mt-8 rounded-2xl bg-panel p-6 text-center shadow-2xl">
            <div className="mx-auto w-fit rounded-2xl bg-[#FFFFFF] p-4">
              <img src={qrUrl} alt="QR code to open Hostrack on mobile" className="h-[200px] w-[200px]" />
            </div>
            <p className="mt-5 text-sm font-extrabold">Scan with your phone to get started</p>
            <p className="mt-2 text-xs font-bold text-muted">{PUBLIC_URL.replace(/^https?:\/\//, "")}</p>
          </motion.section>
        ) : (
          <motion.section custom={1} variants={sectionVariants} initial="hidden" animate="visible" className="mt-8 rounded-2xl bg-panel p-4 shadow-2xl">
            <button
              type="button"
              onClick={onGetStarted}
              className="w-full rounded-2xl bg-accent px-5 py-4 text-sm font-extrabold text-ink shadow-glow transition active:scale-[0.98]"
            >
              Get Started
            </button>
            <p className="mt-4 text-center text-xs font-bold text-muted">New to Hostrack? Here's how to install it:</p>

            <div className="mt-5 grid grid-cols-2 rounded-2xl bg-border/50 p-1">
              {["android", "iphone"].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => selectPlatform(option)}
                  className={`min-h-11 rounded-2xl text-sm font-extrabold capitalize transition-colors ${
                    platform === option ? "bg-accent text-ink" : "text-muted"
                  }`}
                >
                  {option === "iphone" ? "iPhone" : "Android"}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait" custom={direction}>
              <motion.div key={platform} custom={direction} variants={tabVariants} initial="enter" animate="center" exit="exit" className="mt-6">
                <InstallSteps platform={platform} />
              </motion.div>
            </AnimatePresence>
          </motion.section>
        )}

        <motion.section custom={2} variants={sectionVariants} initial="hidden" animate="visible" className="mt-6 rounded-2xl border border-border bg-panel/70 p-5 text-center">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-sm font-extrabold">Plans starting at ${PLANS.starter.price}/month</span>
            <span className="rounded-full bg-accent px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-ink">{PRICING.trialDays}-day free trial</span>
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {Object.values(PLANS).map((plan) => (
              <span key={plan.name} className="rounded-full bg-border/60 px-3 py-2 text-xs font-extrabold text-muted">{plan.name}</span>
            ))}
          </div>
        </motion.section>

        <motion.footer custom={3} variants={sectionVariants} initial="hidden" animate="visible" className="mt-8 text-center text-xs font-bold text-muted">
          <p>&copy; 2026 Hostrack</p>
          <a href="mailto:support@hostrack.app" className="mt-2 inline-block min-h-11 rounded-2xl px-4 py-3 text-accent">support@hostrack.app</a>
        </motion.footer>
      </div>
    </main>
  );
}

export function InstallSteps({ platform }) {
  const steps = platform === "iphone"
    ? [
        { text: "Open this page in Safari", icon: Smartphone, safariNote: true },
        { text: 'Tap the Share icon, then "Add to Home Screen"', icon: Share },
        { text: "Open Hostrack from your home screen", icon: Smartphone }
      ]
    : [
        { text: "Tap the three dots menu in the top right of your browser", icon: MoreVertical },
        { text: 'Tap "Install app" or "Add to Home Screen"', icon: Check },
        { text: "Open Hostrack from your home screen", icon: Smartphone }
      ];

  return (
    <ol className="space-y-3">
      {steps.map((step, index) => {
        const Icon = step.icon;
        return (
          <li key={step.text} className="rounded-2xl bg-app/70 p-3">
            <div className="flex items-start gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-xs font-extrabold text-ink">{index + 1}</span>
              <span className="flex min-h-7 flex-1 items-center gap-2 text-left text-sm font-bold leading-5">
                <Icon size={16} className="shrink-0 text-accent" />
                {step.text}
              </span>
            </div>
            {step.safariNote && (
              <p className="ml-10 mt-2 rounded-2xl bg-[#78350F] px-3 py-2 text-left text-[11px] font-bold leading-4 text-[#FEF3C7]">
                Must be opened in Safari. Chrome and other browsers can't install apps on iPhone.
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
