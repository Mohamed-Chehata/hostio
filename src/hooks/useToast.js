import { useCallback, useEffect, useRef, useState } from "react";

const durations = {
  success: 2000,
  error: 3000,
  warning: 3000
};

export function useToast() {
  const [toast, setToast] = useState(null);
  const closeTimer = useRef(null);
  const removeTimer = useRef(null);

  const clearTimers = useCallback(() => {
    clearTimeout(closeTimer.current);
    clearTimeout(removeTimer.current);
  }, []);

  const dismissToast = useCallback(() => {
    clearTimers();
    setToast((current) => current ? { ...current, closing: true } : null);
    removeTimer.current = setTimeout(() => setToast(null), 250);
  }, [clearTimers]);

  const showToast = useCallback((message, type = "success", options = {}) => {
    clearTimers();
    setToast(null);

    requestAnimationFrame(() => {
      const duration = durations[type] || 3000;
      setToast({ message, type, closing: false, duration, persistent: Boolean(options.persistent), id: Date.now() });
      if (options.persistent) return;
      closeTimer.current = setTimeout(() => {
        setToast((current) => current ? { ...current, closing: true } : null);
        removeTimer.current = setTimeout(() => setToast(null), 250);
      }, duration);
    });
  }, [clearTimers]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  return { toast, showToast, dismissToast };
}
