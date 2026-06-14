import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { cn } from "../lib/utils";
import { effectivePaymentStatus, isPaymentOverridden } from "../utils/paymentStatus";
import { Badge } from "./ui";

export function PaymentStatusControl({ booking, onChange, onPulse, className }) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const ref = useRef(null);
  const status = effectivePaymentStatus(booking);
  const overridden = isPaymentOverridden(booking);
  const current = booking.paymentOverride ?? null;

  function closeMenu() {
    if (closing) return;
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 150);
  }

  useEffect(() => {
    if (!open) return undefined;
    function updatePosition() {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      const menuWidth = 176;
      const menuHeight = 140;
      const below = rect.bottom + 4;
      setPosition({
        left: Math.max(12, Math.min(rect.left, window.innerWidth - menuWidth - 12)),
        top: below + menuHeight > window.innerHeight - 12 ? Math.max(12, rect.top - menuHeight - 4) : below
      });
    }
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  function selectOverride(next) {
    closeMenu();
    setAnimating(false);
    requestAnimationFrame(() => {
      setAnimating(true);
      setTimeout(() => setAnimating(false), 350);
    });
    onPulse?.();
    onChange?.(next);
  }

  return (
    <div
      ref={ref}
      className={cn("relative inline-flex", className)}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <Badge
        status={status}
        overridden={overridden}
        animating={animating}
        onClick={() => {
          if (open) closeMenu();
          else setOpen(true);
        }}
      />
      {open && createPortal(
        <>
          <button
            type="button"
            aria-label="Close payment options"
            className="fixed inset-0 z-[59] min-h-0 cursor-default bg-transparent"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              closeMenu();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          />
          <div
            className={`${closing ? "animate-payment-menu-out" : "animate-payment-menu"} fixed z-[60] w-44 origin-top-left rounded-2xl border border-border bg-panel p-1 text-xs font-extrabold shadow-2xl`}
            style={{ left: position.left, top: position.top }}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <PaymentOption label="Automatic" selected={current === null} onClick={() => selectOverride(null)} />
            <PaymentOption label="Mark as Paid" selected={current === "paid"} onClick={() => selectOverride("paid")} />
            <PaymentOption label="Mark as Unpaid" selected={current === "unpaid"} onClick={() => selectOverride("unpaid")} />
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

function PaymentOption({ label, selected, onClick }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-white transition hover:bg-white/5">
      <span>{label}</span>
      {selected && <Check size={15} className="text-accent" strokeWidth={3} />}
    </button>
  );
}
