import { useEffect, useState } from "react";
import { Input } from "./ui";
import { cn } from "../lib/utils";

export function sanitizeMoneyInput(value) {
  const text = String(value ?? "");
  let hasDecimal = false;
  return [...text].reduce((result, char) => {
    if (/\d/.test(char)) return result + char;
    if (char === "." && !hasDecimal) {
      hasDecimal = true;
      return result + char;
    }
    return result;
  }, "");
}

export function validateMoneyValue(value, { revenue = false } = {}) {
  const text = String(value ?? "").trim();
  const amount = Number(text);
  if (!text) return "This field is required";
  if (!Number.isFinite(amount)) return "Please enter a number - e.g. 12.50";
  if (amount < 0) return "Amount must be greater than 0";
  if (revenue && amount === 0) return "Revenue can't be zero";
  if (amount > 99999) return "That seems too high - double check the amount";
  return "";
}

export function MoneyInput({
  value,
  onChange,
  currency,
  ariaLabel,
  placeholder = "0",
  revenue = false,
  externalError = "",
  className = "",
  inputClassName = "",
  onValidityChange
}) {
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!externalError) return;
    setTouched(true);
    setError(externalError);
  }, [externalError]);

  function runValidation(nextValue = value, markTouched = true) {
    const nextError = validateMoneyValue(nextValue, { revenue });
    if (markTouched) setTouched(true);
    setError(nextError);
    onValidityChange?.(!nextError, nextError);
    return nextError;
  }

  function handleChange(event) {
    const next = sanitizeMoneyInput(event.target.value);
    onChange(next);
    if (error) {
      setError("");
      onValidityChange?.(true, "");
    }
  }

  function handleBlur() {
    runValidation(value, true);
  }

  const showError = touched && Boolean(error);

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="relative">
        {currency?.symbol && <span className="absolute left-4 top-3 text-sm font-bold text-accent">{currency.symbol}</span>}
        <Input
          aria-label={ariaLabel}
          className={cn(
            "pl-8 transition-colors duration-150",
            showError ? "border-red-500 focus:border-red-500" : "focus:border-accent",
            inputClassName
          )}
          type="text"
          inputMode="decimal"
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
        />
      </div>
      <p className={cn("min-h-5 text-xs font-bold text-red-500 transition-all", showError ? "translate-y-0 opacity-100 duration-200 ease-out" : "-translate-y-1 opacity-0 duration-150")}>
        {error}
      </p>
    </div>
  );
}
