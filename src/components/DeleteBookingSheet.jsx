import { Trash2 } from "lucide-react";
import { BottomSheet } from "./BottomSheet";

export function DeleteBookingSheet({ booking, onCancel, onConfirm }) {
  if (!booking) return null;
  return (
    <BottomSheet title="" onClose={onCancel}>
      <div className="text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-red-500/15 text-red-400">
          <Trash2 size={28} />
        </div>
        <h2 className="mt-5 text-xl font-extrabold">Delete booking?</h2>
        <p className="mt-2 text-sm leading-6 text-muted">This will permanently remove {booking.guestName}&apos;s reservation</p>
        <button onClick={onConfirm} className="mt-6 w-full rounded-2xl bg-red-500 px-4 py-3 text-sm font-extrabold text-[#FFFFFF] transition active:scale-[0.98]">Delete</button>
        <button onClick={onCancel} className="mt-2 w-full rounded-2xl bg-white/5 px-4 py-3 text-sm font-bold text-muted transition hover:bg-white/10 active:scale-[0.98]">Cancel</button>
      </div>
    </BottomSheet>
  );
}
