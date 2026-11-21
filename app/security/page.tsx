"use client";

import { useState } from "react";
import Link from "next/link";
import { Bug, ChevronRight, Shield, MonitorSmartphone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DisableTwoFactor,
  TwoFactorSetupWizard,
} from "@/components/TwoFactorSetupWizard";
import { bugBountyProgram } from "@/content/security";
import { auditReports } from "@/content/audits";
import { AnalyticsConsentToggle } from "@/components/AnalyticsConsentToggle";
import { DataSaverToggle } from "@/components/DataSaverToggle";
import { NotificationPermissionButton } from "@/components/NotificationPermissionButton";
import { useNotificationPreference } from "@/hooks/useNotificationPreference";
import { SettingsBreadcrumb } from "@/components/SettingsBreadcrumb";
import { AccountDeletionDialog } from "@/components/AccountDeletionDialog";
import { useWalletStore } from "@/store/useWalletStore";
import { WalletDetailsPanel } from "@/components/WalletDetailsPanel";

export default function SecuritySettingsPage() {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [showDeletion, setShowDeletion] = useState(false);
  const { categoryPreferences, toggleCategory } = useNotificationPreference();

  const publicKey = useWalletStore((s) => s.publicKey);
  const disconnect = useWalletStore((s) => s.disconnect);

  function handleSetupComplete() {
    setTwoFactorEnabled(true);
    setShowSetup(false);
  }

  function handleDeleted() {
    disconnect();
    setShowDeletion(false);
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6 sm:py-8 lg:px-8 text-foreground">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <SettingsBreadcrumb />

        {/* Page header */}
        <div className="flex items-center gap-2">
          <Shield size={20} className="text-blue-400" aria-hidden="true" />
          <h1 className="text-xl font-semibold text-foreground">
            Account Security
          </h1>
        </div>

        {/* Wallet details (#1079) */}
        <WalletDetailsPanel />

        {/* 2FA status card */}
        {!showSetup && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">
                  Two-Factor Authentication
                </h2>
                <span
                  aria-label={twoFactorEnabled ? "2FA enabled" : "2FA disabled"}
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    twoFactorEnabled
                      ? "bg-green-500/15 text-green-400"
                      : "bg-foreground-muted/10 text-foreground-muted"
                  }`}
                >
                  {twoFactorEnabled ? "Enabled" : "Disabled"}
                </span>
              </div>
              <p className="text-xs text-foreground-muted">
                {twoFactorEnabled
                  ? "Your account is protected with two-factor authentication."
                  : "Add an extra layer of security to your account by requiring a verification code on sign-in."}
              </p>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-3">
              {!twoFactorEnabled ? (
                <Button
                  size="sm"
                  onClick={() => setShowSetup(true)}
                  className="gap-1.5"
                  aria-label="Set up two-factor authentication"
                >
                  Set up 2FA <ChevronRight size={13} className="rtl-flip" />
                </Button>
              ) : (
                <DisableTwoFactor
                  onDisabled={() => setTwoFactorEnabled(false)}
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* Setup wizard */}
        {showSetup && (
          <TwoFactorSetupWizard
            accountEmail="user@stellarswipe.app"
            onComplete={handleSetupComplete}
            onCancel={() => setShowSetup(false)}
          />
        )}

        {/* Active Sessions entry point */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MonitorSmartphone
                  size={16}
                  className="text-blue-400"
                  aria-hidden="true"
                />
                <h2 className="text-sm font-semibold text-foreground">
                  Active Sessions
                </h2>
              </div>
            </div>
            <p className="text-xs text-foreground-muted">
              Review and revoke access for devices and browsers signed in to
              your account.
            </p>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <Button size="sm" asChild className="gap-1.5">
              <Link
                href="/security/active-sessions"
                aria-label="Manage active sessions"
              >
                Manage sessions <ChevronRight size={13} aria-hidden="true" className="rtl-flip" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Privacy */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-foreground">Privacy</h2>
            <p className="text-xs text-foreground-muted">
              Control how your usage data is collected.
            </p>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="space-y-4">
              <AnalyticsConsentToggle />
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-foreground-muted mb-2">
                  Need a full account export for records or compliance requests?
                </p>
                <Button asChild size="sm" variant="outline" className="gap-1.5">
                  <Link href="/security/data-export">
                    Request Account Data Export <ChevronRight size={13} className="rtl-flip" />
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Usage */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-foreground">
              Data Usage
            </h2>
            <p className="text-xs text-foreground-muted">
              Reduce network and battery usage on limited or expensive
              connections.
            </p>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <DataSaverToggle />
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-foreground">
              Notification Preferences
            </h2>
            <p className="text-xs text-foreground-muted">
              Choose the notification types you want to receive.
            </p>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-4">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  Browser/Push Alerts
                </span>
                <NotificationPermissionButton />
              </div>
              <hr className="border-border" />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label
                      htmlFor="toggle-priceAlerts"
                      className="text-xs font-semibold text-foreground"
                    >
                      Price Alerts
                    </label>
                    <p className="text-[11px] text-foreground-muted">
                      Receive alerts on significant price changes.
                    </p>
                  </div>
                  <input
                    id="toggle-priceAlerts"
                    type="checkbox"
                    checked={categoryPreferences.priceAlerts}
                    onChange={(e) =>
                      toggleCategory("priceAlerts", e.target.checked)
                    }
                    className="h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500 accent-blue-500"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <label
                      htmlFor="toggle-newSignals"
                      className="text-xs font-semibold text-foreground"
                    >
                      New Signals
                    </label>
                    <p className="text-[11px] text-foreground-muted">
                      Get notified when new trading signals are published.
                    </p>
                  </div>
                  <input
                    id="toggle-newSignals"
                    type="checkbox"
                    checked={categoryPreferences.newSignals}
                    onChange={(e) =>
                      toggleCategory("newSignals", e.target.checked)
                    }
                    className="h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500 accent-blue-500"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <label
                      htmlFor="toggle-systemUpdates"
                      className="text-xs font-semibold text-foreground"
                    >
                      System & Trade Updates
                    </label>
                    <p className="text-[11px] text-foreground-muted">
                      Receive transaction outcome and status notifications.
                    </p>
                  </div>
                  <input
                    id="toggle-systemUpdates"
                    type="checkbox"
                    checked={categoryPreferences.systemUpdates}
                    onChange={(e) =>
                      toggleCategory("systemUpdates", e.target.checked)
                    }
                    className="h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500 accent-blue-500"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Smart-Contract Audit Reports */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-foreground">
              Smart-Contract Audit Reports
            </h2>
            <p className="text-xs text-foreground-muted">
              Review third-party security audits of our protocol.
            </p>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {[...auditReports]
              .sort(
                (a, b) =>
                  new Date(b.date).getTime() - new Date(a.date).getTime()
              )
              .map((audit) => (
                <div
                  key={audit.id}
                  className="flex flex-col gap-1 border-b border-border pb-3 mb-3 last:border-0 last:pb-0 last:mb-0"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      {audit.auditor}
                    </span>
                    <span className="text-xs text-foreground-muted">
                      {audit.date}
                    </span>
                  </div>
                  <p className="text-xs text-foreground-muted">
                    Scope: {audit.scope}
                  </p>
                  <a
                    href={audit.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:underline inline-flex items-center gap-1 mt-1 w-fit"
                  >
                    View Report <ChevronRight size={12} className="rtl-flip" />
                  </a>
                </div>
              ))}
          </CardContent>
        </Card>

        {/* Bug Bounty */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bug size={16} className="text-blue-400" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-foreground">
                {bugBountyProgram.title}
              </h2>
            </div>
            <p className="text-xs text-foreground-muted">
              {bugBountyProgram.summary}
            </p>
          </CardHeader>
          <CardContent className="space-y-5 text-sm">
            <section aria-labelledby="bug-bounty-scope">
              <h3
                id="bug-bounty-scope"
                className="text-xs font-semibold uppercase tracking-wide text-foreground-muted"
              >
                Scope
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground-muted">
                {bugBountyProgram.scope.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="bug-bounty-rewards">
              <h3
                id="bug-bounty-rewards"
                className="text-xs font-semibold uppercase tracking-wide text-foreground-muted"
              >
                Reward review
              </h3>
              <dl className="mt-2 space-y-3">
                {bugBountyProgram.rewardTiers.map((tier) => (
                  <div key={tier.severity}>
                    <dt className="font-medium text-foreground">
                      {tier.severity}
                    </dt>
                    <dd className="text-xs leading-5 text-foreground-muted">
                      {tier.description}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            <section aria-labelledby="bug-bounty-submit">
              <h3
                id="bug-bounty-submit"
                className="text-xs font-semibold uppercase tracking-wide text-foreground-muted"
              >
                Submission process
              </h3>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-foreground-muted">
                {bugBountyProgram.submissionSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </section>

            <Button size="sm" asChild>
              <a
                href={bugBountyProgram.contact.href}
                target="_blank"
                rel="noreferrer"
              >
                {bugBountyProgram.contact.label}
                <ChevronRight size={13} aria-hidden="true" className="rtl-flip" />
              </a>
            </Button>
          </CardContent>
        </Card>

        {/* ── Danger Zone ───────────────────────────────────────────────────── */}
        {!showSetup && (
          <Card className="border-red-500/30">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Trash2 size={15} className="text-red-400" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-red-400">Danger Zone</h2>
              </div>
              <p className="text-xs text-foreground-muted">
                Actions in this section are irreversible. Proceed with caution.
              </p>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">
              <div className="flex flex-col gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">Delete Account</p>
                  <p className="text-xs text-foreground-muted">
                    Permanently deactivate your account. Financial and audit records
                    are anonymised and retained per our 7-year retention policy.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setShowDeletion(true)}
                  disabled={!publicKey}
                  aria-label="Open account deletion dialog"
                  className="shrink-0 gap-1.5"
                  title={
                    !publicKey
                      ? "Connect your wallet to delete your account"
                      : undefined
                  }
                >
                  <Trash2 size={13} aria-hidden="true" />
                  Delete Account
                </Button>
              </div>

              {!publicKey && (
                <p className="text-xs text-yellow-400" role="note">
                  You must connect your Freighter wallet before you can delete your account.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Account Deletion Dialog */}
      <AccountDeletionDialog
        open={showDeletion}
        publicKey={publicKey ?? ""}
        onClose={() => setShowDeletion(false)}
        onDeleted={handleDeleted}
      />
    </main>
  );
}
