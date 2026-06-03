import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check } from "lucide-react";
import logo from "../assets/logo.png";
import { Input } from "../components/ui";

const variants = {
  enter: (direction) => ({ x: direction * 30, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.22, ease: "easeOut" } },
  exit: (direction) => ({ x: direction * -30, opacity: 0, transition: { duration: 0.15, ease: "easeIn" } })
};

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function AuthScreen({ onSignIn, onSignUp, error, onSignedUp }) {
  const [mode, setMode] = useState("sign-in");
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [email, setEmail] = useState("");
  const [emailBlurred, setEmailBlurred] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [propertyName, setPropertyName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState("");
  const [success, setSuccess] = useState(false);
  const activeError = localError || error;
  const emailIsValid = validEmail(email);
  const signUpEmailConfirmed = emailIsValid;
  const passwordScore = getPasswordScore(password);
  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;
  const showPasswordMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const canContinue = useMemo(() => {
    if (mode === "sign-in") return email.trim().length > 0 && password.length > 0;
    if (step === 0) return signUpEmailConfirmed;
    if (step === 1) return passwordsMatch && passwordScore >= 2;
    return propertyName.trim().length > 0;
  }, [email, mode, password.length, passwordScore, passwordsMatch, propertyName, signUpEmailConfirmed, step]);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(onSignedUp, 1500);
    return () => clearTimeout(timer);
  }, [onSignedUp, success]);

  function switchMode(nextMode) {
    setLocalError("");
    setDirection(nextMode === "sign-up" ? 1 : -1);
    setMode(nextMode);
    setStep(0);
  }

  function goForward() {
    setLocalError("");
    if (!canContinue) {
      setLocalError(step === 0 ? "Enter a valid email address." : "Complete this step first.");
      return;
    }
    setDirection(1);
    setStep((current) => Math.min(2, current + 1));
  }

  function goBack() {
    setLocalError("");
    setDirection(-1);
    setStep((current) => Math.max(0, current - 1));
  }

  async function submitSignIn(event) {
    event.preventDefault();
    if (!canContinue || submitting) return;
    setSubmitting(true);
    setLocalError("");
    try {
      await onSignIn(email.trim(), password);
    } catch {
      // The hook exposes the error text.
    } finally {
      setSubmitting(false);
    }
  }

  async function submitSignUp(event) {
    event.preventDefault();
    if (!canContinue || submitting) return;
    setSubmitting(true);
    setLocalError("");
    try {
      await onSignUp(email.trim(), password, propertyName.trim());
      setSuccess(true);
    } catch {
      // The hook exposes the error text.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-[390px] overflow-hidden bg-ink px-5 text-white">
      <AnimatePresence mode="wait" custom={direction}>
        {success ? (
          <motion.section key="success" custom={direction} variants={variants} initial="enter" animate="center" exit="exit" className="grid min-h-screen place-items-center text-center">
            <div>
              <svg className="mx-auto h-24 w-24 text-accent" viewBox="0 0 96 96" fill="none">
                <motion.circle cx="48" cy="48" r="38" stroke="currentColor" strokeWidth="6" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, ease: "easeOut" }} />
                <motion.path d="M31 49.5L43 61L68 35" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, delay: 0.25, ease: "easeOut" }} />
              </svg>
              <h1 className="mt-6 text-3xl font-extrabold">You're all set</h1>
              <p className="mt-2 text-lg font-extrabold text-accent">{propertyName}</p>
            </div>
          </motion.section>
        ) : mode === "sign-in" ? (
          <motion.section key="sign-in" custom={direction} variants={variants} initial="enter" animate="center" exit="exit" className="grid min-h-screen place-items-center py-8">
            <div className="w-full">
              <div className="mb-8 text-center">
                <img src={logo} alt="Hostio" className="mx-auto h-16 w-16 rounded-2xl object-cover" />
                <h1 className="mt-5 text-4xl font-extrabold tracking-tight">Welcome back</h1>
                <p className="mt-2 text-sm font-semibold text-muted">Log in to manage your property</p>
              </div>

              <form onSubmit={submitSignIn} className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted">Email</span>
                  <Input type="email" maxLength={254} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted">Password</span>
                  <Input type="password" maxLength={72} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" />
                </label>

                {activeError && <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200">{activeError}</p>}

                <AuthSubmitButton enabled={canContinue && !submitting} type="submit">
                  {submitting ? "Logging in..." : "Log in"}
                </AuthSubmitButton>
              </form>

              <button type="button" onClick={() => switchMode("sign-up")} className="mx-auto mt-5 block min-h-11 rounded-2xl px-4 text-sm font-bold text-accent">
                New here? Create an account
              </button>
            </div>
          </motion.section>
        ) : (
          <motion.section key={`sign-up-${step}`} custom={direction} variants={variants} initial="enter" animate="center" exit="exit" className="flex min-h-screen flex-col py-7">
            <div className="relative flex min-h-11 items-center justify-center">
              {step > 0 && (
                <button aria-label="Go back" onClick={goBack} className="absolute left-0 grid h-11 w-11 place-items-center rounded-2xl bg-white/5 text-muted">
                  <ArrowLeft size={18} />
                </button>
              )}
              <div className="flex items-center gap-2">
                {[0, 1, 2].map((dot) => (
                  <span key={dot} className={`h-2 w-2 rounded-full transition-colors ${dot === step ? "bg-accent" : "bg-white/20"}`} />
                ))}
              </div>
            </div>

            <form onSubmit={step === 2 ? submitSignUp : (event) => { event.preventDefault(); goForward(); }} className="flex flex-1 flex-col justify-center">
              {step === 0 && (
                <StepShell title="What's your email?" subtitle="We'll use this to create your account">
                  <div>
                    <div className="relative">
                      <Input
                        autoFocus
                        type="email"
                        maxLength={254}
                        autoComplete="email"
                        value={email}
                        onBlur={() => setEmailBlurred(true)}
                        onChange={(event) => {
                          setEmail(event.target.value);
                          setEmailBlurred(false);
                        }}
                        placeholder="you@example.com"
                        className="pr-12"
                      />
                      <FieldCheck visible={signUpEmailConfirmed} />
                    </div>
                    <motion.p
                      initial={false}
                      animate={{ opacity: emailBlurred && email.trim().length > 0 && !emailIsValid ? 1 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="mt-2 min-h-5 text-xs font-bold text-red-500"
                    >
                      Enter a valid email address
                    </motion.p>
                  </div>
                </StepShell>
              )}

              {step === 1 && (
                <StepShell title="Create a password" subtitle="At least 8 characters">
                  <div className="space-y-4">
                    <div>
                      <Input autoFocus type="password" maxLength={72} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" />
                      <PasswordStrength score={passwordScore} />
                    </div>
                    <div>
                      <div className="relative">
                        <Input type="password" maxLength={72} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirm password" className="pr-12" />
                        <FieldCheck visible={passwordsMatch} />
                      </div>
                      <motion.div
                        initial={false}
                        animate={{ opacity: showPasswordMismatch ? 1 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="mt-2 flex min-h-5 items-center gap-2 text-xs font-bold text-red-500"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                        <span>Passwords don't match</span>
                      </motion.div>
                    </div>
                  </div>
                </StepShell>
              )}

              {step === 2 && (
                <StepShell title="You're all set" subtitle="Let's add your first property">
                  <Input autoFocus maxLength={100} value={propertyName} onChange={(event) => setPropertyName(event.target.value)} placeholder="beach house, emma's apartments..." aria-label="Property name" />
                </StepShell>
              )}

              {activeError && <p className="mt-5 rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200">{activeError}</p>}

              <AuthSubmitButton enabled={canContinue && !submitting} className="mt-8" type="submit">
                {submitting ? "Creating..." : step === 2 ? "Get started" : "Continue"}
              </AuthSubmitButton>

              {step === 0 && (
                <button type="button" onClick={() => switchMode("sign-in")} className="mx-auto mt-4 min-h-11 rounded-2xl px-4 text-sm font-bold text-muted">
                  Already have an account? Log in
                </button>
              )}
            </form>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}

function StepShell({ title, subtitle, children }) {
  return (
    <div>
      <h1 className="text-4xl font-extrabold leading-tight tracking-tight">{title}</h1>
      <p className="mt-3 text-sm font-semibold text-muted">{subtitle}</p>
      <div className="mt-8">{children}</div>
    </div>
  );
}

function getPasswordScore(value) {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[0-9!@#$%^&*(),.?":{}|<>_\-+=~`[\]\\;/']/.test(value)) score += 1;
  if (value.length >= 12) score += 1;
  return score;
}

function AuthSubmitButton({ enabled, className = "", children, type = "button" }) {
  const [pop, setPop] = useState(false);
  const wasEnabled = useRef(enabled);

  useEffect(() => {
    if (enabled && !wasEnabled.current) {
      setPop(true);
      const timer = setTimeout(() => setPop(false), 200);
      wasEnabled.current = enabled;
      return () => clearTimeout(timer);
    }
    wasEnabled.current = enabled;
    return undefined;
  }, [enabled]);

  return (
    <motion.button
      type={type}
      disabled={!enabled}
      animate={{ scale: pop ? 1.02 : 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`min-h-11 w-full rounded-2xl bg-accent px-4 py-4 text-sm font-bold text-ink transition-opacity duration-300 ease-out ${enabled ? "cursor-pointer opacity-100" : "cursor-not-allowed opacity-40"} ${className}`}
    >
      {children}
    </motion.button>
  );
}

function FieldCheck({ visible }) {
  return (
    <motion.span
      initial={false}
      animate={{ opacity: visible ? 1 : 0, scale: visible ? 1 : 0, y: "-50%" }}
      transition={{ type: "spring", stiffness: 520, damping: 24 }}
      className="pointer-events-none absolute right-3 top-1/2 grid h-6 w-6 place-items-center rounded-full bg-green-400/10 text-green-400"
    >
      <Check size={15} strokeWidth={3} />
    </motion.span>
  );
}

function PasswordStrength({ score }) {
  const labels = [
    { text: "", color: "text-transparent" },
    { text: "Weak", color: "text-red-500" },
    { text: "Medium", color: "text-orange-500" },
    { text: "Strong", color: "text-green-400" }
  ];
  const fillColors = ["bg-red-500", "bg-orange-500", "bg-green-400"];
  const active = labels[score];
  const activeFill = fillColors[Math.max(0, score - 1)];

  return (
    <div className="mt-3">
      <div className="grid grid-cols-3 gap-1.5">
        {[1, 2, 3].map((segment) => (
          <div key={segment} className="h-2 overflow-hidden rounded-full bg-[#2A2A2A]">
            <div className={`h-full rounded-full transition-[width,background-color] duration-200 ease-out ${activeFill}`} style={{ width: score >= segment ? "100%" : "0%" }} />
          </div>
        ))}
      </div>
      <div className="relative mt-2 h-5 overflow-hidden text-xs font-bold">
        {[1, 2, 3].map((level) => (
          <span key={level} className={`absolute left-0 top-0 transition-opacity duration-150 ${labels[level].color} ${score === level ? "opacity-100" : "opacity-0"}`}>
            {labels[level].text}
          </span>
        ))}
        <span className={`transition-opacity duration-150 ${active.color} ${score === 0 ? "opacity-0" : "opacity-0"}`}>{active.text}</span>
      </div>
    </div>
  );
}
