import { useState } from "react";
import { BottomSheet } from "./BottomSheet";
import { AddBookingScreen } from "../screens/AddBookingScreen";

export function BookingEditSheet({ booking, currency, onClose, onCheckConflict, onSave, onDelete, onCancelReservation }) {
  const [saving, setSaving] = useState(false);
  if (!booking) return null;
  async function save(bookingUpdate) {
    const result = await onSave(bookingUpdate);
    if (result?.conflict || !result) return result;
    setSaving(true);
    return result;
  }
  return (
    <BottomSheet title="Edit booking" description={booking.guestName} onClose={onClose} externalClosing={saving}>
      <AddBookingScreen booking={booking} currency={currency} embedded onCheckConflict={onCheckConflict} onSave={save} onDelete={() => onDelete(booking)} onCancelReservation={onCancelReservation} />
    </BottomSheet>
  );
}
