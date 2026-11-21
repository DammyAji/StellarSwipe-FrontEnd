"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ShieldCheck, Lock, FileCheck2, Activity } from "lucide-react";

const METRICS = [
  { label: "Total Value Locked", value: "$4.2M", sub: "across active vaults" },
  {
    label: "Audit Status",
    value: "Passed",
    sub: "OtterSec · March 2025",
    highlight: true,
  },
  {
    label: "Contract Status",
    value: "Live",
    sub: "Soroban Testnet",
    highlight: true,
  },
  { label: "On-chain Signals", value: "12,840", sub: "verified executions" },
];

const TRUST_POINTS = [
  {
    icon: Lock,
    title: "Non-Custodial",
    body: "Your keys, your assets. StellarSwipe never holds or controls your funds.",
  },
  {
    icon: ShieldCheck,
    title: "Soroban Verified",
    body: "Every trade is executed via audited Soroban smart contracts — transparent and immutable on-chain.",
  },
  {
    icon: FileCheck2,
    title: "On-Chain Proof",
    body: "All signal executions are recorded on the Stellar ledger. Verify any transaction independently.",
  },
];

export function SecurityMetrics() {
  const prefersReduced = useReducedMotion();

  return (
    <section className="w-full max-w-5xl mx-auto px-4 py-16">
      <div className="flex flex-col md:flex-row gap-12 items-start">
        {/* Left — trust copy */}
        <motion.div
          className="flex-1 space-y-8"
          initial={prefersReduced ? { opacity: 0 } : { opacity: 0, x: -20 }}
          whileInView={prefersReduced ? { opacity: 1 } : { opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={prefersReduced ? { duration: 0 } : { duration: 0.5 }}
        >
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-blue-500 mb-3">
              <ShieldCheck size={14} /> Security First
            </span>
            <h2 className="text-3xl font-bold tracking-tight">
              Built on trust,
              <br />
              verified on-chain.
            </h2>
            <p className="mt-3 text-muted-foreground text-sm leading-relaxed">
              StellarSwipe is a fully non-custodial protocol. No intermediaries,
              no hidden custody — every action is provable on the Stellar
              ledger.
            </p>
          </div>

          <ul className="space-y-6">
            {TRUST_POINTS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="mt-0.5 flex-shrink-0 rounded-lg bg-blue-500/10 p-2 text-blue-500">
                  <Icon size={18} />
                </span>
                <div>
                  <p className="font-semibold text-sm">{title}</p>
                  <p className="text-muted-foreground text-sm mt-0.5">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Right — stats card */}
        <motion.div
          className="flex-1 w-full"
          initial={prefersReduced ? { opacity: 0 } : { opacity: 0, x: 20 }}
          whileInView={prefersReduced ? { opacity: 1 } : { opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={
            prefersReduced ? { duration: 0 } : { duration: 0.5, delay: 0.1 }
          }
        >
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-1">
            {/* Soroban badge */}
            <div className="flex items-center gap-2 mb-5">
              <span className="flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-500">
                <Activity size={12} />
                Soroban Verified Contract
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {METRICS.map(({ label, value, sub, highlight }) => (
                <div
                  key={label}
                  className={`rounded-xl p-4 ${
                    highlight
                      ? "bg-blue-500/10 border border-blue-500/20"
                      : "bg-muted/50"
                  }`}
                >
                  <p className="text-xs text-muted-foreground mb-1">{label}</p>
                  <p
                    className={`text-xl font-bold ${
                      highlight ? "text-blue-500" : ""
                    }`}
                  >
                    {value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                </div>
              ))}
            </div>

            <p className="pt-4 text-xs text-muted-foreground text-center">
              Metrics reflect mock data · mainnet launch pending audit sign-off
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
