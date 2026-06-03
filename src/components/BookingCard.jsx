import { useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, Star, Trash2 } from "lucide-react";
import { Badge, Card } from "./ui";
import { dateLabel } from "../lib/utils";

export function BookingCard({
  booking,
  formatCurrency,
  onClick,
  onRequestDelete,
  onToggleStatus,
  onOpenSwipe,
  onCloseSwipe,
  onFirstSwipe,
  isOpen = false,
  teachSwipe = false,
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

  useEffect(() => {
    if (!teachSwipe || deletionStage) return;
    const slide = setTimeout(() => {
      setShowDeleteZone(true);
      setOffset(-60);
    }, 250);
    const snap = setTimeout(() => {
      setOffset(0);
      setTimeout(() => setShowDeleteZone(false), 150);
    }, 850);
    return () => {
      clearTimeout(slide);
      clearTimeout(snap);
    };
  }, [teachSwipe, deletionStage]);

  function toggleStatus() {
    if (!onToggleStatus || deletionStage) return;
    setStatusAnimating(false);
    requestAnimationFrame(() => setStatusAnimating(true));
    onToggleStatus(booking.id);
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
    if (Math.abs(distance) > 22) onFirstSwipe?.();
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
        <button aria-label={`Delete ${booking.guestName}`} onClick={(event) => { event.stopPropagation(); onRequestDelete?.(booking); }} className="absolute inset-0 flex items-center justify-end bg-red-500 pr-4 text-white">
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
        className={`booking-card-content relative z-10 flex h-[112px] cursor-pointer touch-pan-y items-center justify-between gap-3 rounded-[16px] bg-panel p-4 transition-transform duration-150 ease-in-out active:scale-[0.97] ${deletionStage ? "opacity-40" : ""}`}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-bold">{booking.guestName}</h3>
            <Badge status={booking.status} animating={statusAnimating} onAnimationEnd={() => setStatusAnimating(false)} onClick={(event) => { event.stopPropagation(); toggleStatus(); }} />
          </div>
          <p className="mt-1 text-xs text-muted">{dateLabel(booking.checkIn)} → {dateLabel(booking.checkOut)}{!compact && ` · ${booking.nights} nights`}</p>
          {!compact && booking.rating && (
            <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-accent">
              <Star size={12} fill="currentColor" /> {booking.rating}.0
            </div>
          )}
        </div>
        <p className={`shrink-0 text-sm font-extrabold text-accent ${statusAnimating ? "animate-revenue-pulse" : ""}`}>{formatCurrency(booking.revenue)}</p>
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
