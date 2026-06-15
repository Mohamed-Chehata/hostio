import { motion } from "framer-motion";
import { Check, LoaderCircle } from "lucide-react";
import { PLANS } from "../config/pricing";

export function CheckoutStatusScreen({ status, planId }) {
  const complete = status === "complete";
  return (
    <main className="mx-auto grid min-h-screen max-w-[390px] place-items-center bg-app px-5 text-center text-white">
      <div>
        {complete ? (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }} className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-500 text-[#FFFFFF]">
            <Check size={36} strokeWidth={3} />
          </motion.div>
        ) : <LoaderCircle className="mx-auto animate-spin text-accent" size={32} />}
        <h1 className="mt-6 text-2xl font-extrabold">{complete ? "You're all set!" : "Setting up your subscription..."}</h1>
        {complete && <p className="mt-2 text-sm font-bold text-accent">Welcome to {PLANS[planId]?.name || "Hostrack"}</p>}
      </div>
    </main>
  );
}
