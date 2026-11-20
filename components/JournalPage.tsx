"use client";

import { TransactionActivityFeed } from "@/components/TransactionActivityFeed";
import { JournalEntryForm } from "@/components/JournalEntryForm";
import { CSVImportModal } from "@/components/CSVImportModal";
import { JournalTagSummary } from "@/components/JournalTagSummary";
import { JournalPrivacyToggle } from "@/components/JournalPrivacyToggle";
import { PrivateValue } from "@/components/PrivateValue";
import { JournalRevisionTracker } from "@/components/JournalRevisionTracker";
import { JournalReminderScheduler } from "@/components/JournalReminderScheduler";
import { BookMarked, TrendingUp, History } from "lucide-react";

export function JournalPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <JournalRevisionTracker />
      <JournalReminderScheduler />
      {/* Header section with cumulative stats and primary actions */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-blue-400 mb-1">
            <BookMarked size={18} />
            <span className="text-xs font-bold uppercase tracking-widest">
              Trading Journal
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white sm:text-4xl">
            Backfill History
          </h1>
          <p className="mt-2 text-slate-400 max-w-lg">
            Import your past trades or add manual entries to build a complete
            picture of your performance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <JournalPrivacyToggle />
          <CSVImportModal />
          <JournalEntryForm />
        </div>
      </div>

      {/* Stats summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-400 mb-4">
            <History size={16} />
            <span className="text-xs font-medium uppercase tracking-wider">
              Total Entries
            </span>
          </div>
          <p className="text-2xl font-bold text-white">482</p>
          <p className="text-xs text-emerald-400 mt-1">+12 today</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-400 mb-4">
            <TrendingUp size={16} />
            <span className="text-xs font-medium uppercase tracking-wider">
              Win Rate
            </span>
          </div>
          <p className="text-2xl font-bold text-white">64.2%</p>
          <p className="text-xs text-slate-500 mt-1">Last 30 days</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-blue-500/10 p-5 shadow-sm border-blue-500/20">
          <div className="flex items-center gap-2 text-blue-300 mb-4">
            <span className="text-xs font-medium uppercase tracking-wider text-blue-400">
              Total Profit
            </span>
          </div>
          <p className="text-2xl font-bold text-blue-300">
            <PrivateValue>+$2.4k</PrivateValue>
          </p>
          <p className="text-xs text-blue-400/60 mt-1">0.52% avg / trade</p>
        </div>
      </div>

      <JournalTagSummary />

      {/* Main activity feed - reusing existing component */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-lg font-semibold text-white">Journal History</h2>
        </div>
        <TransactionActivityFeed />
      </div>
    </div>
  );
}
