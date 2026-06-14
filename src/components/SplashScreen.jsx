import { useEffect, useRef } from "react";
import { motion, useAnimate } from "framer-motion";
import logo from "../assets/logo.png";

export function SplashScreen({ onReveal, onComplete }) {
  const [scope, animate] = useAnimate();
  const runId = useRef(0);
  const onRevealRef = useRef(onReveal);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onRevealRef.current = onReveal;
    onCompleteRef.current = onComplete;
  }, [onComplete, onReveal]);

  useEffect(() => {
    const currentRun = runId.current + 1;
    runId.current = currentRun;
    let cancelled = false;
    const isCurrent = () => !cancelled && runId.current === currentRun;

    async function run() {
      if (!scope.current) return;
      await animate("[data-logo]", { scale: 0.7, opacity: 0 }, { duration: 0 });
      await animate("[data-logo-wrap]", { y: 0 }, { duration: 0 });
      await animate("[data-name]", { opacity: 0, y: 10 }, { duration: 0 });
      await animate("[data-tagline]", { opacity: 0, y: 10 }, { duration: 0 });
      if (!isCurrent()) return;
      await animate("[data-logo]", { scale: [0.7, 1], opacity: [0, 1] }, { duration: 0.6, ease: [0.34, 1.56, 0.64, 1] });
      if (!isCurrent()) return;
      await new Promise((resolve) => setTimeout(resolve, 400));
      if (!isCurrent()) return;
      animate("[data-logo-wrap]", { y: -40 }, { duration: 0.4, ease: "easeInOut" });
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (!isCurrent()) return;
      animate("[data-name]", { opacity: [0, 1], y: [10, 0] }, { duration: 0.3, ease: "easeOut" });
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (!isCurrent()) return;
      await animate("[data-tagline]", { opacity: [0, 1], y: [10, 0] }, { duration: 0.3, ease: "easeOut" });
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (!isCurrent()) return;
      onRevealRef.current();
      await animate(scope.current, { opacity: 0 }, { duration: 0.5, ease: [0.32, 0.72, 0, 1] });
      if (!isCurrent()) return;
      onCompleteRef.current();
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [animate, scope]);

  return (
    <motion.div ref={scope} className="fixed inset-0 z-[100] grid place-items-center bg-app">
      <div data-logo-wrap className="text-center">
        <img data-logo src={logo} alt="Hostrack" className="mx-auto h-[120px] w-[120px] rounded-[28px] object-cover opacity-0" />
        <h1 data-name className="mt-5 text-[32px] font-extrabold tracking-[0.15em] text-white opacity-0">HOSTRACK</h1>
        <p data-tagline className="mt-2 text-sm font-semibold text-muted opacity-0">Your property, simplified</p>
      </div>
    </motion.div>
  );
}
