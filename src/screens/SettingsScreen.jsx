import { useState } from "react";
import { ArrowLeft, Check, ChevronRight, Coins, CreditCard, FileUp, KeyRound, LogOut, Mail, Trash2 } from "lucide-react";
import { BottomSheet } from "../components/BottomSheet";
import { Button, Card, Input } from "../components/ui";
import { PLANS } from "../config/pricing";

export function SettingsScreen({ currency, currencies, theme, subscription, trialDaysRemaining, updateTheme, updateCurrency, onCurrencyUpdated, email, onImportData, onChoosePlan, onManageSubscription, onChangePassword, onSignOut, onDeleteAccount, onBack }) {
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <main className="px-5 pb-12 pt-6">
      <button onClick={onBack} aria-label="Back to Dashboard" className="mb-6 grid h-11 w-11 place-items-center rounded-2xl bg-panel text-muted transition-transform duration-100 active:scale-[0.98]">
        <ArrowLeft size={18} />
      </button>
      <h1 className="text-2xl font-extrabold">Settings</h1>

      <SettingsSection title="Data">
        <SettingsRow icon={FileUp} label="Import data" value="CSV or Excel" onClick={onImportData} navigation />
      </SettingsSection>

      <SettingsSection title="Account">
        <SettingsRow icon={Mail} label="Email" value={email} />
        <SettingsRow icon={KeyRound} label="Change password" onClick={() => setChangePasswordOpen(true)} navigation />
        <SettingsRow icon={LogOut} label="Sign out" onClick={() => setSignOutOpen(true)} navigation danger />
      </SettingsSection>

      <SettingsSection title="Preferences">
        <SettingsRow icon={Coins} label="Currency" value={`${currency.symbol} ${currency.code}`} onClick={() => setCurrencyOpen(true)} navigation />
      </SettingsSection>

      <SettingsSection title="Subscription">
        <SettingsRow
          icon={CreditCard}
          label="Plan"
          value={subscriptionLabel(subscription, trialDaysRemaining)}
          valueDanger={subscription?.status === "expired" || subscription?.status === "canceled"}
          multiline
        />
        {subscription?.status === "trialing" ? (
          <button onClick={onChoosePlan} className="min-h-14 w-full px-4 text-left text-sm font-extrabold text-accent">Choose a plan</button>
        ) : subscription?.status === "active" ? (
          <button onClick={onManageSubscription} className="min-h-14 w-full px-4 text-left text-sm font-extrabold text-accent">Manage subscription</button>
        ) : null}
      </SettingsSection>

      <SettingsSection title="Appearance">
        <div className="p-2">
          <div className="grid grid-cols-3 rounded-2xl bg-app p-1">
            {["light", "dark", "system"].map((option) => (
              <button
                key={option}
                onClick={() => option !== theme && updateTheme(option)}
                className={`min-h-11 rounded-xl text-sm font-extrabold capitalize transition-[background-color,color,transform] duration-200 active:scale-[0.98] ${theme === option ? "bg-accent text-[#0A0A0A]" : "text-muted"}`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Danger Zone" danger>
        <SettingsRow icon={Trash2} label="Delete account" onClick={() => setDeleteOpen(true)} danger />
      </SettingsSection>

      <p className="mt-10 text-center text-xs font-semibold text-muted opacity-50">Hostrack v1.0</p>

      {currencyOpen && (
        <CurrencySheet
          currency={currency}
          currencies={currencies}
          onClose={() => setCurrencyOpen(false)}
          onSelect={updateCurrency}
          onUpdated={onCurrencyUpdated}
        />
      )}
      {changePasswordOpen && (
        <ChangePasswordSheet
          email={email}
          onClose={() => setChangePasswordOpen(false)}
          onConfirm={onChangePassword}
        />
      )}
      {signOutOpen && <SignOutSheet onClose={() => setSignOutOpen(false)} onConfirm={onSignOut} />}
      {deleteOpen && <DeleteAccountSheet onClose={() => setDeleteOpen(false)} onConfirm={onDeleteAccount} />}
    </main>
  );
}

function subscriptionLabel(subscription, trialDaysRemaining) {
  if (subscription?.status === "trialing") {
    return `Free trial — ${trialDaysRemaining} ${trialDaysRemaining === 1 ? "day" : "days"} remaining`;
  }
  if (subscription?.status === "active") {
    const plan = PLANS[subscription.plan];
    const planLabel = plan ? `${plan.name} — $${plan.price}/month` : "Active subscription";
    if (!subscription.current_period_end) return planLabel;
    const renewalDate = new Date(subscription.current_period_end).toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
    return `${planLabel} · renews ${renewalDate}`;
  }
  return "Inactive";
}

function ChangePasswordSheet({ email, onClose, onConfirm }) {
  const [submitting, setSubmitting] = useState(false);

  async function confirm() {
    if (submitting) return;
    setSubmitting(true);
    const sent = await onConfirm();
    if (sent) {
      onClose();
      return;
    }
    setSubmitting(false);
  }

  return (
    <BottomSheet title="Change password" onClose={onClose}>
      <div className="text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent/10 text-accent">
          <KeyRound size={23} />
        </div>
        <h2 className="mt-4 text-xl font-extrabold">Send password reset email?</h2>
        <p className="mt-2 text-sm leading-5 text-muted">
          We'll send a secure password change link to
        </p>
        <p className="mt-1 break-all text-sm font-bold text-accent">{email}</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={confirm} disabled={submitting}>
            {submitting ? "Sending..." : "Send email"}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}

function SettingsSection({ title, danger = false, children }) {
  return (
    <section className="mt-8">
      <h2 className={`mb-3 text-[11px] font-extrabold uppercase tracking-[0.18em] ${danger ? "text-[#EF4444]" : "text-muted"}`}>{title}</h2>
      <Card className="overflow-hidden">{children}</Card>
    </section>
  );
}

function SettingsRow({ icon: Icon, label, value, onClick, navigation = false, danger = false, valueDanger = false, multiline = false }) {
  const content = (
    <>
      <Icon className={`shrink-0 ${danger ? "text-[#EF4444]" : "text-muted"}`} size={18} />
      <span className={`text-sm font-bold ${danger ? "text-[#EF4444]" : "text-white"}`}>{label}</span>
      {value && (
        <span className={`ml-auto text-sm font-semibold ${multiline ? "max-w-[190px] whitespace-normal break-words text-right leading-5" : "max-w-[200px] truncate"} ${valueDanger ? "text-[#EF4444]" : "text-muted"}`}>
          {value}
        </span>
      )}
      {navigation && <ChevronRight className="ml-auto text-muted" size={17} />}
    </>
  );
  const className = `flex min-h-14 w-full gap-3 border-b border-white/5 px-4 text-left transition-transform duration-100 last:border-b-0 active:scale-[0.98] ${multiline ? "items-start py-4" : "items-center"}`;
  return onClick ? <button onClick={onClick} className={className}>{content}</button> : <div className={className}>{content}</div>;
}

function CurrencySheet({ currency, currencies, onClose, onSelect, onUpdated }) {
  const [selectedCode, setSelectedCode] = useState(currency.code);
  const [closing, setClosing] = useState(false);

  async function selectCurrency(option) {
    if (option.code === selectedCode || closing) return;
    setSelectedCode(option.code);
    const updated = await onSelect(option.code);
    if (!updated) {
      setSelectedCode(currency.code);
      return;
    }
    setTimeout(() => {
      setClosing(true);
      setTimeout(() => {
        onClose();
        onUpdated();
      }, 400);
    }, 300);
  }

  return (
    <BottomSheet title="Select currency" onClose={onClose} externalClosing={closing}>
      <div className="space-y-2">
        {Object.values(currencies).map((option) => {
          const selected = selectedCode === option.code;
          return (
            <button key={option.code} onClick={() => selectCurrency(option)} className="flex min-h-14 w-full items-center rounded-2xl bg-white/[0.04] px-4 text-left transition-transform duration-100 active:scale-[0.98]">
              <span className="text-sm font-extrabold">{option.symbol} {option.code}</span>
              <span className="ml-2 text-sm font-semibold text-muted">— {option.name}</span>
              <Check className={`ml-auto text-accent transition-transform ${selected ? "scale-100 duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]" : "scale-0 duration-150 ease-in"}`} size={18} />
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}

function SignOutSheet({ onClose, onConfirm }) {
  const [closing, setClosing] = useState(false);

  function confirm() {
    if (closing) return;
    setClosing(true);
    setTimeout(onConfirm, 400);
  }

  return (
    <BottomSheet title="" onClose={onClose} externalClosing={closing}>
      <div className="text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/[0.06] text-muted"><LogOut size={23} /></div>
        <h2 className="mt-4 text-xl font-extrabold">Sign out?</h2>
        <p className="mt-2 text-sm leading-5 text-muted">You'll need to log in again to access your properties</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="ghost" onClick={confirm} className="text-[#EF4444]">Sign out</Button>
        </div>
      </div>
    </BottomSheet>
  );
}

function DeleteAccountSheet({ onClose, onConfirm }) {
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const enabled = confirmation === "DELETE";

  async function confirm() {
    if (!enabled || submitting) return;
    setSubmitting(true);
    const deleted = await onConfirm();
    if (!deleted) setSubmitting(false);
  }

  return (
    <BottomSheet title="Delete your account?" description="This will permanently delete all your properties, bookings, expenses, and data. This cannot be undone." onClose={onClose}>
      <label className="block">
        <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted">Type DELETE to confirm</span>
        <Input
          autoFocus
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder="DELETE"
          className={`transition-colors duration-200 ${enabled ? "border-[#4ADE80]" : "border-[#EF4444]"}`}
        />
      </label>
      <Button
        variant="danger"
        disabled={!enabled || submitting}
        onClick={confirm}
        className={`mt-4 w-full bg-red-500 py-4 text-[#FFFFFF] transition-[opacity,transform] duration-300 ease-out disabled:cursor-not-allowed disabled:opacity-40 ${enabled ? "animate-auth-button-ready" : ""}`}
      >
        {submitting ? "Deleting..." : "Delete account"}
      </Button>
    </BottomSheet>
  );
}
