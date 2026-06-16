import { useRef, useState } from "react";
import { motion } from "framer-motion";

const TRIGGER_DISTANCE = 60;
const MAX_PULL = 92;

export function PullToRefresh({ onRefresh, children }) {
  const startY = useRef(null);
  const rawDistance = useRef(0);
  const pulling = useRef(false);
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  function handleTouchStart(event) {
    if (refreshing || window.scrollY > 0) return;
    startY.current = event.touches[0]?.clientY ?? null;
    rawDistance.current = 0;
    pulling.current = startY.current !== null;
  }

  function handleTouchMove(event) {
    if (!pulling.current || startY.current === null || window.scrollY > 0) return;
    const delta = (event.touches[0]?.clientY ?? startY.current) - startY.current;
    rawDistance.current = Math.max(0, delta);
    if (delta <= 0) {
      setDistance(0);
      return;
    }
    event.preventDefault();
    setDistance(Math.min(MAX_PULL, delta * 0.55));
  }

  async function handleTouchEnd() {
    const shouldRefresh = pulling.current && rawDistance.current >= TRIGGER_DISTANCE;
    pulling.current = false;
    startY.current = null;
    rawDistance.current = 0;

    if (!shouldRefresh) {
      setDistance(0);
      return;
    }

    setRefreshing(true);
    setDistance(TRIGGER_DISTANCE);
    try {
      await onRefresh?.();
    } finally {
      setRefreshing(false);
      setDistance(0);
    }
  }

  const progress = Math.min(1, distance / (TRIGGER_DISTANCE * 0.55));

  return (
    <div
      className="relative"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-3 z-40 grid h-9 w-9 -translate-x-1/2 place-items-center rounded-full border border-border bg-panel shadow-lg"
        initial={{ opacity: 0, scale: 0 }}
        animate={{
          opacity: refreshing || distance > 0 ? 1 : 0,
          scale: refreshing ? 1 : progress
        }}
        transition={{ duration: 0.15, ease: "easeOut" }}
      >
        <span className={`h-6 w-6 rounded-full border-2 border-accent/25 border-t-accent ${refreshing ? "animate-spin" : ""}`} />
      </motion.div>
      <motion.div
        animate={{ y: distance }}
        transition={pulling.current ? { duration: 0 } : { duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
      >
        {children}
      </motion.div>
    </div>
  );
}
