export function getAuthError(error) {
  const msg = error?.message?.toLowerCase() || "";
  const status = error?.status;

  if (status === 429) return "Too many attempts. Please wait a few minutes and try again.";
  if (msg.includes("invalid login credentials")) return "Incorrect email or password.";
  if (msg.includes("email not confirmed")) return "Please verify your email first. Check your inbox.";
  if (msg.includes("user already registered")) return "An account with this email already exists. Try logging in.";
  if (msg.includes("password should be at least")) return "Password must be at least 8 characters.";
  if (msg.includes("unable to validate email")) return "Please enter a valid email address.";
  if (msg.includes("email rate limit")) return "Too many emails sent. Please wait before trying again.";
  if (msg.includes("network") || msg.includes("fetch")) return "No internet connection. Check your network and try again.";
  if (msg.includes("token is expired") || msg.includes("invalid token")) return "This link has expired. Please request a new one.";
  return "Something went wrong. Please try again.";
}

export function getDataError(error) {
  const msg = error?.message?.toLowerCase() || "";
  const status = error?.status || error?.code;

  if (msg.includes("no active property")) return "Select a property before making changes.";
  if (msg.includes("invalid cost amount")) return "Enter a valid cost amount.";
  if (msg.includes("invalid property name")) return "Property name must be 100 characters or less.";
  if (status === 429) return "Too many requests. Please slow down and try again.";
  if (status === 403 || msg.includes("row level security")) return "You don't have permission to do that.";
  if (status === 404 || msg.includes("not found")) return "This item no longer exists.";
  if (msg.includes("duplicate") || msg.includes("unique")) return "This entry already exists.";
  if (status === "23P01" || msg.includes("no_overlapping_bookings") || msg.includes("exclusion constraint")) return "These dates overlap with another booking.";
  if (msg.includes("network") || msg.includes("fetch") || msg.includes("failed to fetch")) return "No internet connection. Check your network and try again.";
  if (msg.includes("invalid input") || msg.includes("violates check constraint")) return "Some information is invalid. Please check your inputs.";
  if (msg.includes("foreign key")) return "This item is linked to other data and cannot be removed.";
  return "Something went wrong. Please try again.";
}

export function getToastTypeForError(error, message) {
  const msg = `${error?.message || ""} ${message || ""}`.toLowerCase();
  if (msg.includes("at least one property")) return "warning";
  if (error?.status === 429 || msg.includes("too many") || msg.includes("wait") || msg.includes("slow down")) return "warning";
  return "error";
}
