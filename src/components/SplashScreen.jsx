import { useEffect } from "react";
import { motion, useAnimate } from "framer-motion";
import logo from "../assets/logo.png";

export function SplashScreen({ onReveal, onComplete }) {
  const [scope, animate] = useAnimate();

  useEffect(() => {
    async function run() {
      await animate("[data-logo]", { scale: [0.7, 1], opacity: [0, 1] }, { duration: 0.6, ease: [0.34, 1.56, 0.64, 1] });
      await new Promise((resolve) => setTimeout(resolve, 400));
      animate("[data-logo-wrap]", { y: -40 }, { duration: 0.4, ease: "easeInOut" });
      await new Promise((resolve) => setTimeout(resolve, 150));
      animate("[data-name]", { opacity: [0, 1], y: [10, 0] }, { duration: 0.3, ease: "easeOut" });
      await new Promise((resolve) => setTimeout(resolve, 250));
      await animate("[data-tagline]", { opacity: [0, 1], y: [10, 0] }, { duration: 0.3, ease: "easeOut" });
      await new Promise((resolve) => setTimeout(resolve, 300));
      onReveal();
      await animate(scope.current, { opacity: 0 }, { duration: 0.5, ease: [0.32, 0.72, 0, 1] });
      onComplete();
    }
    run();
  }, [animate, onComplete, scope]);

  return (
    <motion.div ref={scope} className="fixed inset-0 z-[100] grid place-items-center bg-[#080A0C]">
      <div data-logo-wrap className="text-center">
        <img data-logo src={logo} alt="Hostio" className="mx-auto h-[120px] w-[120px] rounded-[28px] object-cover opacity-0" />
        <h1 data-name className="mt-5 text-[32px] font-extrabold tracking-[0.15em] text-white opacity-0">HOSTIO</h1>
        <p data-tagline className="mt-2 text-sm font-semibold text-[#9A9A9A] opacity-0">Your property, simplified</p>
      </div>
    </motion.div>
  );
}
