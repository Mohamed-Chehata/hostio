import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, Eye, EyeOff } from "lucide-react";
import logo from "../assets/logo.png";
import { supabase } from "../lib/supabase";
import { Input } from "../components/ui";
import { getAuthError } from "../utils/errorHandler";

const variants = {
  enter: (direction) => ({ x: direction * 30, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.22, ease: "easeOut" } },
  exit: (direction) => ({ x: direction * -30, opacity: 0, transition: { duration: 0.15, ease: "easeIn" } })
};

const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;
const RESET_REDIRECT_URL = `${APP_URL.replace(/\/$/, "")}/reset-password`;
const SIGNUP_SUCCESS_KEY = "hostrack-signup-success";

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function AuthScreen({ onSignIn, onSignUp, onLoadingChange, error, onSignedUp, initialMode, onRecoveryComplete, onBackFromForgot }) {
  const [mode, setMode] = useState(() => initialMode || (window.location.pathname === "/reset-password" ? "reset-password" : "sign-in"));
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [email, setEmail] = useState("");
  const [emailBlurred, setEmailBlurred] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [propertyName, setPropertyName] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [resendSeconds, setResendSeconds] = useState(0);
  const [successTitle, setSuccessTitle] = useState("You're all set");
  const [successSubtitle, setSuccessSubtitle] = useState("");
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
    if (mode === "forgot-password") return emailIsValid;
    if (mode === "reset-password") return passwordsMatch && passwordScore >= 2;
    if (step === 0) return signUpEmailConfirmed;
    if (step === 1) return passwordsMatch && passwordScore >= 2;
    return propertyName.trim().length > 0;
  }, [email, emailIsValid, mode, password.length, passwordScore, passwordsMatch, propertyName, signUpEmailConfirmed, step]);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => {
      if (mode === "reset-success") {
        supabase.auth.signOut().finally(() => {
          localStorage.removeItem("hostrackPasswordRecovery");
          window.history.replaceState({}, "", "/");
          setSuccess(false);
          setMode("sign-in");
          setPassword("");
          setConfirmPassword("");
          setLocalError("");
          onRecoveryComplete?.();
        });
        return;
      }
      onSignedUp();
    }, 1500);
    return () => clearTimeout(timer);
  }, [mode, onRecoveryComplete, onSignedUp, success]);

  useEffect(() => {
    if (initialMode !== "reset-password") return;
    setDirection(1);
    setMode("reset-password");
    setSuccess(false);
    setLocalError("");
  }, [initialMode]);

  useEffect(() => {
    function handleEmailVerified(event) {
      sessionStorage.removeItem(SIGNUP_SUCCESS_KEY);
      setPropertyName(event.detail?.propertyName || propertyName || "My Property");
      setSuccessTitle("You're all set");
      setSuccessSubtitle(event.detail?.propertyName || propertyName || "My Property");
      setMode("sign-up");
      setSuccess(true);
    }

    window.addEventListener("hostrack:email-verified", handleEmailVerified);
    return () => window.removeEventListener("hostrack:email-verified", handleEmailVerified);
  }, [propertyName]);

  useEffect(() => {
    const completedPropertyName = sessionStorage.getItem(SIGNUP_SUCCESS_KEY);
    if (!completedPropertyName) return;
    sessionStorage.removeItem(SIGNUP_SUCCESS_KEY);
    setPropertyName(completedPropertyName);
    setSuccessTitle("You're all set");
    setSuccessSubtitle(completedPropertyName);
    setDirection(1);
    setMode("sign-up");
    setSuccess(true);
  }, []);

  useEffect(() => {
    if (!verificationEmail || resendSeconds <= 0) return undefined;
    const timer = setTimeout(() => setResendSeconds((current) => Math.max(0, current - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendSeconds, verificationEmail]);

  useEffect(() => {
    function handlePasswordRecovery() {
      setDirection(1);
      setMode("reset-password");
      setSuccess(false);
      setLocalError("");
      window.history.replaceState({}, "", "/reset-password");
    }

    window.addEventListener("hostrack:password-recovery", handlePasswordRecovery);
    return () => window.removeEventListener("hostrack:password-recovery", handlePasswordRecovery);
  }, []);

  useEffect(() => {
    if (mode !== "reset-password") return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled || data.session) return;
      window.history.replaceState({}, "", "/");
      setDirection(-1);
      setMode("sign-in");
      setLocalError("");
      onRecoveryComplete?.();
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mode, onRecoveryComplete]);

  function switchMode(nextMode) {
    setLocalError("");
    setDirection(nextMode === "sign-up" ? 1 : -1);
    setMode(nextMode);
    setStep(0);
  }

  function openForgotPassword() {
    setLocalError("");
    setDirection(1);
    setMode("forgot-password");
  }

  function togglePasswordVisibility(field) {
    setVisiblePasswords((current) => ({ ...current, [field]: !current[field] }));
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
    onLoadingChange?.("login");
    try {
      await onSignIn(email.trim(), password);
    } catch (error) {
      setLocalError(getAuthError(error));
      setSubmitting(false);
      onLoadingChange?.(null);
    }
  }

  async function submitSignUp(event) {
    event.preventDefault();
    if (!canContinue || submitting) return;
    setSubmitting(true);
    setLocalError("");
    onLoadingChange?.("create");
    try {
      await onSignUp(email.trim(), password, propertyName.trim());
      setVerificationEmail(email.trim());
      setResendSeconds(60);
      setDirection(1);
      setMode("verify");
    } catch (error) {
      setLocalError(getAuthError(error));
    } finally {
      setSubmitting(false);
      onLoadingChange?.(null);
    }
  }

  async function resendVerificationEmail() {
    if (!verificationEmail || resendSeconds > 0 || submitting) return;
    setSubmitting(true);
    setLocalError("");
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: verificationEmail,
        options: { emailRedirectTo: window.location.origin }
      });
      if (error) throw error;
      setResendSeconds(60);
    } catch (error) {
      setLocalError(getAuthError(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function sendResetLink(event) {
    event.preventDefault();
    if (!canContinue || submitting) return;
    setSubmitting(true);
    setLocalError("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: RESET_REDIRECT_URL
      });
      if (error) throw error;
      setVerificationEmail(email.trim());
      setResendSeconds(60);
      setDirection(1);
      setMode("forgot-success");
    } catch (error) {
      setLocalError(getAuthError(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function resendResetLink() {
    if (!verificationEmail || resendSeconds > 0 || submitting) return;
    setSubmitting(true);
    setLocalError("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(verificationEmail, {
        redirectTo: RESET_REDIRECT_URL
      });
      if (error) throw error;
      setResendSeconds(60);
    } catch (error) {
      setLocalError(getAuthError(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function updatePassword(event) {
    event.preventDefault();
    if (!canContinue || submitting) return;
    setSubmitting(true);
    setLocalError("");
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccessTitle("Password updated");
      setSuccessSubtitle("You can now log in with your new password");
      setMode("reset-success");
      setSuccess(true);
    } catch (error) {
      setLocalError(getAuthError(error));
    } finally {
      setSubmitting(false);
    }
  }

  function goBackToEmail() {
    setLocalError("");
    setDirection(-1);
    setSuccess(false);
    setVerificationEmail("");
    setResendSeconds(0);
    setMode("sign-up");
    setStep(0);
  }

  return (
    <main className="mx-auto min-h-screen max-w-[390px] overflow-hidden bg-app px-5 text-white">
      <AnimatePresence mode="wait" custom={direction}>
        {success ? (
          <motion.section key="success" custom={direction} variants={variants} initial="enter" animate="center" exit="exit" className="grid min-h-screen place-items-center text-center">
            <div>
              <svg className="mx-auto h-24 w-24 text-accent" viewBox="0 0 96 96" fill="none">
                <motion.circle cx="48" cy="48" r="38" stroke="currentColor" strokeWidth="6" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, ease: "easeOut" }} />
                <motion.path d="M31 49.5L43 61L68 35" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, delay: 0.25, ease: "easeOut" }} />
              </svg>
              <h1 className="mt-6 text-3xl font-extrabold">{successTitle}</h1>
              <p className={`mt-2 ${mode === "reset-success" ? "text-sm font-semibold text-muted" : "text-lg font-extrabold text-accent"}`}>{successSubtitle || propertyName}</p>
            </div>
          </motion.section>
        ) : mode === "verify" ? (
          <motion.section key="verify-email" custom={direction} variants={variants} initial="enter" animate="center" exit="exit" className="flex min-h-screen flex-col justify-center py-8 text-center">
            <div className="flex flex-1 flex-col items-center justify-center">
              <EnvelopeIcon />
              <h1 className="mt-8 text-4xl font-extrabold tracking-tight">Check your email</h1>
              <p className="mt-4 text-sm font-semibold leading-6 text-muted">
                We sent a verification link to
                <span className="mt-1 block text-accent">{verificationEmail}</span>
              </p>
              <p className="mt-5 max-w-[280px] text-xs font-semibold leading-5 text-muted">Tap the link in the email to activate your account</p>

              {activeError && <p className="mt-6 rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200">{activeError}</p>}

              <button
                type="button"
                disabled={resendSeconds > 0 || submitting}
                onClick={resendVerificationEmail}
                className={`mt-7 min-h-11 rounded-2xl px-5 text-sm font-bold transition-colors ${resendSeconds > 0 || submitting ? "cursor-not-allowed text-muted" : "text-accent"}`}
              >
                {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Resend email"}
              </button>
            </div>

            <button type="button" onClick={goBackToEmail} className="mx-auto mb-2 min-h-11 rounded-2xl px-4 text-sm font-bold text-muted">
              Wrong email? Go back
            </button>
          </motion.section>
        ) : mode === "forgot-success" ? (
          <EmailWaitingScreen
            email={verificationEmail}
            title="Check your email"
            subtitle="We sent a reset link to"
            instructions=""
            resendSeconds={resendSeconds}
            submitting={submitting}
            error={activeError}
            onResend={resendResetLink}
            onBack={() => {
              setDirection(-1);
              setMode("forgot-password");
            }}
            backText="Wrong email? Go back"
          />
        ) : mode === "forgot-password" ? (
          <motion.section key="forgot-password" custom={direction} variants={variants} initial="enter" animate="center" exit="exit" className="flex min-h-screen flex-col py-7">
            <div className="relative flex min-h-11 items-center justify-center">
              <button aria-label="Go back" onClick={() => {
                if (onBackFromForgot) {
                  onBackFromForgot();
                  return;
                }
                setDirection(-1);
                setMode("sign-in");
                setLocalError("");
              }} className="absolute left-0 grid h-11 w-11 place-items-center rounded-2xl bg-white/5 text-muted">
                <ArrowLeft size={18} />
              </button>
            </div>

            <form onSubmit={sendResetLink} className="flex flex-1 flex-col justify-center">
              <StepShell title="Reset your password" subtitle="Enter your email and we'll send you a reset link">
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
                    <FieldCheck visible={emailIsValid} />
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

              {activeError && <p className="mt-5 rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200">{activeError}</p>}

              <AuthSubmitButton enabled={canContinue && !submitting} loading={submitting} className="mt-8" type="submit">
                Send reset link
              </AuthSubmitButton>
            </form>
          </motion.section>
        ) : mode === "reset-password" ? (
          <motion.section key="reset-password" custom={direction} variants={variants} initial="enter" animate="center" exit="exit" className="flex min-h-screen flex-col py-7">
            <form onSubmit={updatePassword} className="flex flex-1 flex-col justify-center">
              <StepShell title="Choose a new password" subtitle="">
                <PasswordFields
                  password={password}
                  confirmPassword={confirmPassword}
                  passwordScore={passwordScore}
                  passwordsMatch={passwordsMatch}
                  showPasswordMismatch={showPasswordMismatch}
                  setPassword={setPassword}
                  setConfirmPassword={setConfirmPassword}
                  passwordPlaceholder="New password"
                  passwordVisible={!!visiblePasswords.resetPassword}
                  confirmVisible={!!visiblePasswords.resetConfirm}
                  onTogglePassword={() => togglePasswordVisibility("resetPassword")}
                  onToggleConfirm={() => togglePasswordVisibility("resetConfirm")}
                />
              </StepShell>

              <AuthSubmitButton enabled={canContinue && !submitting} loading={submitting} className="mt-8" type="submit">
                Update password
              </AuthSubmitButton>

              <motion.p
                initial={false}
                animate={{ opacity: activeError ? 1 : 0 }}
                transition={{ duration: 0.2 }}
                className="mt-4 min-h-5 text-center text-sm font-bold text-red-500"
              >
                {activeError}
              </motion.p>
            </form>
          </motion.section>
        ) : mode === "sign-in" ? (
          <motion.section key="sign-in" custom={direction} variants={variants} initial="enter" animate="center" exit="exit" className="grid min-h-screen place-items-center py-8">
            <div className="w-full">
              <div className="mb-8 text-center">
                <img src={logo} alt="Hostrack" className="mx-auto h-16 w-16 rounded-2xl object-cover" />
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
                  <PasswordInput
                    id="login-password"
                    visible={!!visiblePasswords.login}
                    onToggle={() => togglePasswordVisibility("login")}
                    maxLength={72}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Password"
                  />
                </label>
                <button type="button" onClick={openForgotPassword} className="-mt-2 block min-h-11 w-full rounded-2xl text-right text-sm font-bold text-muted">
                  Forgot password?
                </button>

                {activeError && <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200">{activeError}</p>}

                <AuthSubmitButton enabled={canContinue && !submitting} loading={submitting} type="submit">
                  Log in
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
                  <PasswordFields
                    password={password}
                    confirmPassword={confirmPassword}
                    passwordScore={passwordScore}
                    passwordsMatch={passwordsMatch}
                    showPasswordMismatch={showPasswordMismatch}
                    setPassword={setPassword}
                    setConfirmPassword={setConfirmPassword}
                    passwordVisible={!!visiblePasswords.signUpPassword}
                    confirmVisible={!!visiblePasswords.signUpConfirm}
                    onTogglePassword={() => togglePasswordVisibility("signUpPassword")}
                    onToggleConfirm={() => togglePasswordVisibility("signUpConfirm")}
                  />
                </StepShell>
              )}

              {step === 2 && (
                <StepShell title="You're all set" subtitle="Let's add your first property">
                  <Input autoFocus maxLength={100} value={propertyName} onChange={(event) => setPropertyName(event.target.value)} placeholder="beach house, emma's apartments..." aria-label="Property name" />
                </StepShell>
              )}

              {activeError && <p className="mt-5 rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200">{activeError}</p>}

              <AuthSubmitButton enabled={canContinue && !submitting} loading={submitting} className="mt-8" type="submit">
                {step === 2 ? "Create account" : "Continue"}
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

function EnvelopeIcon() {
  return (
    <motion.svg
      width="112"
      height="112"
      viewBox="0 0 112 112"
      fill="none"
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 2, ease: "easeInOut", repeat: Infinity }}
      aria-hidden="true"
      className="text-accent"
    >
      <rect x="18" y="30" width="76" height="56" rx="16" stroke="currentColor" strokeWidth="6" />
      <path d="M24 39L56 61L88 39" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M26 80L46 58" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <path d="M86 80L66 58" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
    </motion.svg>
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

function AuthSubmitButton({ enabled, loading = false, className = "", children, type = "button" }) {
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
      {loading ? <span className="mx-auto block h-5 w-5 animate-spin rounded-full border-2 border-ink/30 border-t-ink" /> : children}
    </motion.button>
  );
}

function EmailWaitingScreen({ email, title, subtitle, instructions, resendSeconds, submitting, error, onResend, onBack, backText }) {
  return (
    <motion.section key={title + email} custom={1} variants={variants} initial="enter" animate="center" exit="exit" className="flex min-h-screen flex-col justify-center py-8 text-center">
      <div className="flex flex-1 flex-col items-center justify-center">
        <EnvelopeIcon />
        <h1 className="mt-8 text-4xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-4 text-sm font-semibold leading-6 text-muted">
          {subtitle}
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.3 }} className="mt-1 block text-accent">
            {email}
          </motion.span>
        </p>
        {instructions && <p className="mt-5 max-w-[280px] text-xs font-semibold leading-5 text-muted">{instructions}</p>}

        {error && <p className="mt-6 rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200">{error}</p>}

        <button
          type="button"
          disabled={resendSeconds > 0 || submitting}
          onClick={onResend}
          className={`mt-7 min-h-11 rounded-2xl px-5 text-sm font-bold transition-opacity duration-300 ${resendSeconds > 0 || submitting ? "cursor-not-allowed text-muted opacity-40" : "text-accent opacity-100"}`}
        >
          {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Resend email"}
        </button>
      </div>

      <button type="button" onClick={onBack} className="mx-auto mb-2 min-h-11 rounded-2xl px-4 text-sm font-bold text-muted">
        {backText}
      </button>
    </motion.section>
  );
}

function PasswordFields({
  password,
  confirmPassword,
  passwordScore,
  passwordsMatch,
  showPasswordMismatch,
  setPassword,
  setConfirmPassword,
  passwordPlaceholder = "Password",
  passwordVisible,
  confirmVisible,
  onTogglePassword,
  onToggleConfirm
}) {
  return (
    <div className="space-y-4">
      <div>
        <PasswordInput
          id={`${passwordPlaceholder.toLowerCase().replace(/\s+/g, "-")}-field`}
          autoFocus
          visible={passwordVisible}
          onToggle={onTogglePassword}
          maxLength={72}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={passwordPlaceholder}
        />
        <PasswordStrength score={passwordScore} />
      </div>
      <div>
        <PasswordInput
          id="confirm-password-field"
          visible={confirmVisible}
          onToggle={onToggleConfirm}
          maxLength={72}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Confirm password"
          showCheck={passwordsMatch}
        />
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
  );
}

function PasswordInput({ id, visible, onToggle, showCheck = false, className = "", ...props }) {
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        className={`${showCheck ? "pr-20" : "pr-12"} ${className}`}
        {...props}
      />
      <button
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        onClick={onToggle}
        className={`absolute right-0 top-1/2 h-11 w-11 -translate-y-1/2 rounded-2xl transition-colors ${visible ? "text-accent" : "text-[#6B6B6B]"}`}
      >
        {visible ? <Eye size={19} className="absolute right-3 top-1/2 -translate-y-1/2" /> : <EyeOff size={19} className="absolute right-3 top-1/2 -translate-y-1/2" />}
      </button>
      <FieldCheck visible={showCheck} offsetClassName="right-12" />
    </div>
  );
}

function FieldCheck({ visible, offsetClassName = "right-3" }) {
  return (
    <motion.span
      initial={false}
      animate={{ opacity: visible ? 1 : 0, scale: visible ? 1 : 0, y: "-50%" }}
      transition={{ type: "spring", stiffness: 520, damping: 24 }}
      className={`pointer-events-none absolute top-1/2 grid h-6 w-6 place-items-center rounded-full bg-green-400/10 text-green-400 ${offsetClassName}`}
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
          <div key={segment} className="h-2 overflow-hidden rounded-full bg-border">
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
