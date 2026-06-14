import { dateLabel } from "../lib/utils";

export function payoutDate(checkOut) {
  const date = new Date(`${checkOut}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return date;
}

export function payoutDateLabel(checkOut) {
  if (!checkOut) return "";
  return dateLabel(payoutDate(checkOut).toISOString().slice(0, 10));
}

export function effectivePaymentStatus(booking, now = new Date()) {
  if (booking.paymentOverride === "paid") return "Paid";
  if (booking.paymentOverride === "unpaid") return "Unpaid";
  if (booking.bookingStatus === "cancelled" && booking.cancellationPayoutAvailableAt) {
    return now >= new Date(booking.cancellationPayoutAvailableAt) ? "Paid" : "Pending";
  }
  if (!booking.checkOut) return "Pending";
  const payout = payoutDate(booking.checkOut);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return today >= payout ? "Paid" : "Pending";
}

export function isPaymentOverridden(booking) {
  return booking.paymentOverride === "paid" || booking.paymentOverride === "unpaid";
}

export function isCancelled(booking) {
  return booking.bookingStatus === "cancelled";
}

export function hasPendingCancellationPayout(booking, now = new Date()) {
  return isCancelled(booking) && booking.cancellationPayoutAvailableAt && new Date(booking.cancellationPayoutAvailableAt) > now;
}

export function countsAsRevenue(booking, now = new Date()) {
  if (hasPendingCancellationPayout(booking, now)) return false;
  return effectivePaymentStatus(booking, now) === "Paid";
}
