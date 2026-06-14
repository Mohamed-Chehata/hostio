import { forwardRef } from "react";
import { Pin } from "lucide-react";
import { cn } from "../lib/utils";

export const Card = forwardRef(function Card({ className, ...props }, ref) {
  return <div ref={ref} className={cn("rounded-2xl border border-border bg-panel", className)} {...props} />;
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
      className={cn("field-control min-h-11 w-full rounded-2xl border border-border bg-panel px-4 py-3 text-sm text-white placeholder:text-muted", className)}
      {...props}
    />
  );
}

export function Badge({ status, overridden = false, onClick, animating = false, onAnimationEnd }) {
  const paid = status === "Paid";
  const pending = status === "Pending";
  const badge = (
    <span onAnimationEnd={onAnimationEnd} className={cn("status-badge relative inline-flex min-w-[64px] items-center justify-center gap-1 rounded-full px-2.5 py-1 text-center text-[10px] font-bold uppercase tracking-wider", paid ? "bg-[#E6F9F0] text-[#1A7A4A] dark:bg-[#1A3D2E] dark:text-[#4ADE80]" : "bg-[#FFF0E0] text-[#C45C00] dark:bg-[#3D2A1A] dark:text-[#FB923C]", animating && "animate-status-toggle")}>
      {overridden && <Pin size={10} fill="currentColor" />}
      {pending ? "Pending" : status}
    </span>
  );
  if (onClick) {
    return <button type="button" aria-label="Payment status options" onClick={onClick} className="grid min-h-11 place-items-center">{badge}</button>;
  }
  return badge;
}
