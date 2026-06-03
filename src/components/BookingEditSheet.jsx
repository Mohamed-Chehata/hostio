import { useState } from "react";
import { BottomSheet } from "./BottomSheet";
import { AddBookingScreen } from "../screens/AddBookingScreen";

export function BookingEditSheet({ booking, currency, onClose, onSave, onDelete }) {
  const [saving, setSaving] = useState(false);
  if (!booking) return null;
  function save(bookingUpdate) {
    setSaving(true);
    setTimeout(() => onSave(bookingUpdate), 400);
  }
  return (
    <BottomSheet title="Edit booking" description={booking.guestName} onClose={onClose} externalClosing={saving}>
      <AddBookingScreen booking={booking} currency={currency} embedded onCancel={onClose} onSave={save} onDelete={() => onDelete(booking)} />
    </BottomSheet>
  );
}
