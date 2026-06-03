import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function dateLabel(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}

export function monthKey(value) {
  return value.slice(0, 7);
}

export function monthLabel(value) {
  return new Date(`${value}-02T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric"
  });
}

export function shortMonth(value) {
  return new Date(`${value}-02T00:00:00`).toLocaleDateString("en-US", {
    month: "short"
  });
}

export function nightsBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  return Math.max(0, Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000));
}
