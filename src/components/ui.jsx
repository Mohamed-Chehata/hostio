import { forwardRef } from "react";
import { cn } from "../lib/utils";

export const Card = forwardRef(function Card({ className, ...props }, ref) {
  return <div ref={ref} className={cn("rounded-2xl bg-panel", className)} {...props} />;
});

export function Button({ className, variant = "primary", ...props }) {
  return (
    <button
      className={cn(
        "rounded-2xl px-4 py-3 text-sm font-bold transition active:scale-[0.98]",
        variant === "primary" && "bg-accent text-ink",
        variant === "ghost" && "bg-white/5 text-white hover:bg-white/10",
        variant === "danger" && "bg-red-500/10 text-red-300",
        className
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }) {
  return (
    <input
      className={cn("field-control min-h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-muted", className)}
      {...props}
    />
  );
}

export function Badge({ status, onClick, animating = false, onAnimationEnd }) {
  const paid = status === "Paid";
  const badge = (
    <span onAnimationEnd={onAnimationEnd} className={cn("status-badge relative block min-w-[54px] rounded-full px-2.5 py-1 text-center text-[10px] font-bold uppercase tracking-wider", paid ? "bg-emerald-400/10 text-emerald-300" : "bg-orange-400/10 text-orange-300", animating && "animate-status-toggle")}>
      <span className={cn("status-badge-label", paid ? "opacity-100" : "opacity-0")}>Paid</span>
      <span className={cn("status-badge-label absolute inset-0 grid place-items-center", paid ? "opacity-0" : "opacity-100")}>Unpaid</span>
    </span>
  );
  if (onClick) {
    return <button type="button" aria-label={`Mark as ${paid ? "Unpaid" : "Paid"}`} onClick={onClick} className="grid min-h-11 place-items-center">{badge}</button>;
  }
  return badge;
}
