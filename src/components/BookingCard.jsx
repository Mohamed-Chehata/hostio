import { useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, Trash2 } from "lucide-react";
import { PaymentStatusControl } from "./PaymentStatusControl";
import { Card } from "./ui";
import { dateLabel } from "../lib/utils";

export function BookingCard({
  booking,
  formatCurrency,
  onClick,
  onRequestDelete,
  onPaymentOverride,
  onOpenSwipe,
  onCloseSwipe,
  isOpen = false,
  deletionStage,
  compact = false
}) {
  const startX = useRef(0);
  const startOffset = useRef(0);
  const moved = useRef(false);
  const cardRef = useRef(null);
  const [offset, setOffset] = useState(0);
  const [showDeleteZone, setShowDeleteZone] = useState(false);
  const [statusAnimating, setStatusAnimating] = useState(false);
  const cancelled = booking.bookingStatus === "cancelled";

  useEffect(() => {
    cardRef.current.style.transform = `translateX(${offset}px)`;
  }, [offset]);

  useEffect(() => {
    if (deletionStage) {
      setOffset(0);
      setShowDeleteZone(false);
      return;
    }
    setOffset(isOpen ? -88 : 0);
    if (isOpen) {
      setShowDeleteZone(true);
    } else {
      setTimeout(() => setShowDeleteZone(false), 150);
    }
  }, [isOpen, deletionStage]);

  function pulseStatus() {
    if (deletionStage) return;
    setStatusAnimating(false);
    requestAnimationFrame(() => {
      setStatusAnimating(true);
      setTimeout(() => setStatusAnimating(false), 350);
    });
  }

  function changePaymentOverride(paymentOverride) {
    if (!onPaymentOverride || deletionStage) return;
    onPaymentOverride(booking.id, paymentOverride);
  }

  function pointerDown(event) {
    if (deletionStage) return;
    startX.current = event.clientX;
    startOffset.current = isOpen ? -88 : 0;
    moved.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function pointerMove(event) {
    if (deletionStage || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const distance = event.clientX - startX.current;
    if (Math.abs(distance) > 8) moved.current = true;
    if (distance < 0) setShowDeleteZone(true);
    setOffset(Math.max(-88, Math.min(0, startOffset.current + distance)));
  }

  function pointerUp(event) {
    if (deletionStage) return;
    const distance = event.clientX - startX.current;
    if (startOffset.current + distance < -54) {
      onOpenSwipe?.(booking.id);
      setOffset(-88);
    } else {
      onCloseSwipe?.();
      setOffset(0);
      setTimeout(() => setShowDeleteZone(false), 150);
    }
  }

  function cardClick(event) {
    if (moved.current || deletionStage) {
      event.preventDefault();
      return;
    }
    if (isOpen) {
      onCloseSwipe?.();
      return;
    }
    onClick?.();
  }

  return (
    <div
      data-booking-card={booking.id}
      className={`booking-card-shell relative h-[112px] overflow-hidden rounded-[16px] ${deletionStage === "removing" ? "booking-card-removing" : ""}`}
    >
      {showDeleteZone && (
        <button aria-label={`Delete ${booking.guestName}`} onClick={(event) => { event.stopPropagation(); onRequestDelete?.(booking); }} className="absolute inset-0 flex items-center justify-end bg-red-500 pr-4 text-[#FFFFFF]">
          <Trash2 size={16} /> Delete
        </button>
      )}
      <Card
        ref={cardRef}
        role="button"
        tabIndex={0}
        onClick={cardClick}
        onKeyDown={(event) => event.key === "Enter" && cardClick(event)}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        className={`booking-card-content relative z-10 h-[112px] cursor-pointer touch-pan-y rounded-[16px] bg-panel p-4 transition-transform duration-150 ease-in-out active:scale-[0.97] ${deletionStage ? "opacity-40" : ""}`}
      >
        {booking.pendingSync && <span aria-label="Waiting to sync" className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent shadow-[0_0_0_2px_rgb(var(--color-panel))]" />}
        <div className={`flex h-full items-center justify-between gap-3 ${cancelled ? "opacity-60" : ""}`}>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-bold">{booking.guestName}</h3>
              {cancelled ? <span className="rounded-full bg-[#F0F0F0] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#6B6B6B] dark:bg-[#2A2A2A] dark:text-[#9A9A9A]">Cancelled</span> : <PaymentStatusControl booking={booking} onChange={changePaymentOverride} onPulse={pulseStatus} />}
            </div>
            <p className={`mt-1 text-xs text-muted ${cancelled ? "line-through decoration-red-300/70" : ""}`}>{dateLabel(booking.checkIn)} &rarr; {dateLabel(booking.checkOut)}{!compact && <> &middot; {booking.nights} nights</>}</p>
          </div>
          <p className={`shrink-0 text-sm font-extrabold text-accent ${statusAnimating ? "animate-revenue-pulse" : ""}`}>{formatCurrency(booking.revenue)}</p>
        </div>
      </Card>
      {deletionStage && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          {deletionStage === "loading" ? <LoaderCircle className="animate-spin text-accent" size={24} /> : (
            <div className="animate-delete-done flex flex-col items-center gap-1 text-emerald-300">
              <Check size={25} strokeWidth={3} />
              <span className="text-[11px] font-extrabold">Done</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

