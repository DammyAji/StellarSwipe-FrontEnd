"use client";

import { ReactNode, useId, useState } from "react";
import { Bell, Globe2, History, LayoutGrid, Moon, Network, Palette, Search, Wallet2, X } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AccentColorPicker } from "@/components/AccentColorPicker";
import { HighContrastPreview } from "@/components/HighContrastPreview";
import { useContrastStore } from "@/store/useContrastStore";
import { CurrencySelector } from "@/components/CurrencySelector";
import { FeedDensityToggle } from "@/components/FeedDensityToggle";
import { DataSaverToggle } from "@/components/DataSaverToggle";
import { SwipeSettings } from "@/components/SwipeSettings";
import { LanguageSelector } from "@/components/LanguageSelector";
import { NotificationManageMenu } from "@/components/NotificationManageMenu";
import { QuietHoursSettings } from "@/components/QuietHoursSettings";
import { NetworkSwitcher } from "@/components/NetworkSwitcher";
import { SettingsHistory } from "@/components/SettingsHistory";
import { useCurrencyStore } from "@/store/useCurrencyStore";
import { useFeedDensityStore } from "@/store/useFeedDensityStore";
import { useThemeStore } from "@/store/useThemeStore";
import { useOnboardingStore } from "@/store/useOnboardingStore";
import { useGuidedTourStore } from "@/store/useGuidedTourStore";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { searchSettings, type SettingsSearchEntry } from "@/lib/settingsSearch";

interface PreferencesSectionProps {
  id: string;
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}

function PreferencesSection({
  id,
  icon,
  title,
  description,
  children,
}: PreferencesSectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-20 rounded-2xl border border-border bg-surface/40 p-5"
    >
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-foreground/5 text-foreground-muted">
          {icon}
        </div>
        <div>
          <h2 id={`${id}-title`} className="text-sm font-semibold text-foreground">
            {title}
          </h2>
          <p className="text-xs text-foreground-muted">{description}</p>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

/**
 * Single destination for display and notification preferences. Every
 * control here reads from and writes to the same persisted stores used
 * elsewhere in the app (theme, currency, density, data saver, notifications),
 * so changes take effect immediately and stay in sync across every surface
 * that reads them — this page doesn't introduce a second source of truth.
 */
export function PreferencesHub() {
  const { theme, accentColor } = useThemeStore();
  const { currency } = useCurrencyStore();
  const { density } = useFeedDensityStore();
  const highContrast = useContrastStore((s) => s.highContrast);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-xl font-bold text-foreground">Preferences</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Manage how StellarSwipe looks and how it notifies you. Every change
          here applies immediately and is remembered on this device.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-foreground/[0.03] p-3 text-xs text-foreground-muted">
        <span className="font-medium text-foreground">Currently:</span>
        <span>
          {theme === "dark" ? "Dark" : "Light"} theme
          {highContrast ? " (high contrast)" : ""}
        </span>
        <span aria-hidden="true">·</span>
        <span>{accentColor ? "Custom accent" : "Default accent"}</span>
        <span aria-hidden="true">·</span>
        <span>{currency} display</span>
        <span aria-hidden="true">·</span>
        <span>{density === "compact" ? "Compact" : "Comfortable"} feed</span>
      </div>

      <SettingsSearch />

      <PreferencesSection
        id="prefs-appearance"
        icon={<Moon size={16} aria-hidden="true" />}
        title="Appearance"
        description="Theme and accent color for the whole app."
      >
        <div
          id="setting-theme"
          tabIndex={-1}
          className="flex scroll-mt-20 items-center justify-between gap-4 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div>
            <p className="text-xs font-medium text-foreground">Theme</p>
            <p className="text-xs text-foreground-muted">
              Switch between light and dark mode.
            </p>
          </div>
          <ThemeToggle />
        </div>
        <div className="border-t border-border pt-4">
          <SettingAnchor id="setting-high-contrast">
            <HighContrastPreview />
          </SettingAnchor>
        </div>
        <div className="border-t border-border pt-4">
          <SettingAnchor id="setting-accent-color">
            <AccentColorPicker />
          </SettingAnchor>
        </div>
        <div className="border-t border-border pt-4">
          <SettingAnchor id="setting-chart-palette">
            <ChartPaletteRow />
          </SettingAnchor>
        </div>
      </PreferencesSection>

      <PreferencesSection
        id="prefs-density"
        icon={<LayoutGrid size={16} aria-hidden="true" />}
        title="Display density"
        description="Control how much information is visible per screen."
      >
        <div
          id="setting-feed-density"
          tabIndex={-1}
          className="flex scroll-mt-20 items-center justify-between gap-4 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div>
            <p className="text-xs font-medium text-foreground">Signal feed density</p>
            <p className="text-xs text-foreground-muted">
              Compact fits more signals on screen; comfortable adds breathing room.
            </p>
          </div>
          <FeedDensityToggle />
        </div>
        <div className="border-t border-border pt-4">
          <SettingAnchor id="setting-data-saver">
            <DataSaverToggle />
          </SettingAnchor>
        </div>
        <div className="border-t border-border pt-4">
          <SettingAnchor id="setting-swipe">
            <SwipeSettings />
          </SettingAnchor>
        </div>
      </PreferencesSection>

      <PreferencesSection
        id="prefs-currency"
        icon={<Wallet2 size={16} aria-hidden="true" />}
        title="Currency"
        description="Choose the currency used to display prices and P&L."
      >
        <div
          id="setting-currency"
          tabIndex={-1}
          className="flex scroll-mt-20 items-center justify-between gap-4 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div>
            <p className="text-xs font-medium text-foreground">Display currency</p>
            <p className="text-xs text-foreground-muted">
              Applies across the dashboard, signals, and journal.
            </p>
          </div>
          <CurrencySelector />
        </div>
      </PreferencesSection>

      <PreferencesSection
        id="prefs-network"
        icon={<Network size={16} aria-hidden="true" />}
        title="Network"
        description="Preview what a network change affects before switching."
      >
        <NetworkSwitcher />
      </PreferencesSection>

      <PreferencesSection
        id="prefs-language"
        icon={<Globe2 size={16} aria-hidden="true" />}
        title="Language"
        description="Set your preferred display language."
      >
        <div
          id="setting-language"
          tabIndex={-1}
          className="flex scroll-mt-20 items-center justify-between gap-4 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div>
            <p className="text-xs font-medium text-foreground">App language</p>
            <p className="text-xs text-foreground-muted">
              Translations apply immediately, no reload required.
            </p>
          </div>
          <LanguageSelector />
        </div>
      </PreferencesSection>

      <PreferencesSection
        id="prefs-notifications"
        icon={<Bell size={16} aria-hidden="true" />}
        title="Notifications"
        description="Control push notification permission, categories, and quiet hours."
      >
        <SettingAnchor id="setting-notifications">
          <NotificationManageMenu />
        </SettingAnchor>
        <div className="border-t border-border pt-4">
          <QuietHoursSettings />
        </div>
      </PreferencesSection>

      <PreferencesSection
        id="prefs-onboarding"
        icon={<Palette size={16} aria-hidden="true" />}
        title="Onboarding"
        description="Revisit the guided tour of core features."
      >
        <SettingAnchor id="setting-guided-tour">
          <ReplayOnboardingRow />
        </SettingAnchor>
      </PreferencesSection>

      <PreferencesSection
        id="prefs-history"
        icon={<History size={16} aria-hidden="true" />}
        title="Change history"
        description="Review recent preference changes and restore an earlier value."
      >
        <SettingsHistory />
      </PreferencesSection>
    </div>
  );
}

function ChartPaletteRow() {
  const chartPalette = useThemeStore((s) => s.chartPalette);
  const setChartPalette = useThemeStore((s) => s.setChartPalette);
  const enabled = chartPalette === "colorblind";

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p id="chart-palette-label" className="text-xs font-medium text-foreground">
          Color-blind-safe charts
        </p>
        <p className="text-xs text-foreground-muted">
          Uses a palette that stays distinguishable with common color-vision
          deficiencies.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-labelledby="chart-palette-label"
        onClick={() => setChartPalette(enabled ? "default" : "colorblind")}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
          enabled ? "bg-blue-600" : "bg-foreground/20"
        }`}
      >
        <span
          aria-hidden="true"
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function ReplayOnboardingRow() {
  const reset = useOnboardingStore((s) => s.reset);
  const replayTour = useGuidedTourStore((s) => s.replay);

  const handleReplay = () => {
    reset();
    replayTour();
  };

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-xs font-medium text-foreground">Guided tour</p>
        <p className="text-xs text-foreground-muted">
          Replays the intro walkthrough and the contextual spotlight tour of
          the wallet, signal feed, comparison view, and the guided
          first-session signal review.
        </p>
      </div>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={handleReplay}>
        <RotateCcw size={13} aria-hidden="true" />
        Replay tour
      </Button>
    </div>
  );
}

function SettingAnchor({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div
      id={id}
      tabIndex={-1}
      className="scroll-mt-20 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </div>
  );
}

/**
 * #895 Lets users find a setting by term. Results name their section, and
 * selecting one scrolls to the setting and moves focus to it. All sections
 * stay rendered regardless of the query, so normal navigation is never lost.
 */
export function SettingsSearch() {
  const inputId = useId();
  const resultsId = useId();
  const [query, setQuery] = useState("");
  const results = searchSettings(query);
  const hasQuery = query.trim().length > 0;

  const goTo = (entry: SettingsSearchEntry) => {
    const target =
      document.getElementById(entry.id) ?? document.getElementById(entry.sectionId);
    if (!target) return;
    target.scrollIntoView?.({ behavior: "smooth", block: "start" });
    target.focus({ preventScroll: true });
  };

  return (
    <div role="search" aria-label="Search preferences" className="space-y-2">
      <label htmlFor={inputId} className="sr-only">
        Search preferences
      </label>
      <div className="relative">
        <Search
          size={14}
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted"
        />
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setQuery("");
            if (e.key === "Enter" && results[0]) {
              e.preventDefault();
              goTo(results[0]);
            }
          }}
          placeholder="Search settings, e.g. theme, currency, alerts"
          aria-controls={hasQuery ? resultsId : undefined}
          aria-describedby={hasQuery ? `${resultsId}-status` : undefined}
          className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-8 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {hasQuery && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear settings search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-foreground-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X size={12} aria-hidden="true" />
          </button>
        )}
      </div>

      {hasQuery && (
        <>
          <p id={`${resultsId}-status`} role="status" aria-live="polite" className="text-xs text-foreground-muted">
            {results.length === 0
              ? `No settings match "${query.trim()}". All sections are still listed below.`
              : `${results.length} setting${results.length === 1 ? "" : "s"} found`}
          </p>
          {results.length > 0 && (
            <ul id={resultsId} aria-label="Settings search results" className="space-y-1">
              {results.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => goTo(entry)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="font-medium text-foreground">{entry.label}</span>
                    <span className="text-xs text-foreground-muted">in {entry.section}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
