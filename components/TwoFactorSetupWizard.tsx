"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import {
  Shield,
  Smartphone,
  MessageSquare,
  QrCode,
  Key,
  Download,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Copy,
  Check,
  AlertTriangle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  generateSecret,
  buildOtpAuthUri,
  buildQrImageUrl,
  generateBackupCodes,
  formatBackupCodesText,
  formatSecretForDisplay,
  isValidSixDigitCode,
  isValidPhoneNumber,
  maskPhoneNumber,
} from "@/lib/twoFactorUtils";

export type TwoFactorMethod = "app" | "sms";

type Step =
  | "intro"
  | "choose-method"
  | "setup-app"
  | "setup-sms"
  | "verify"
  | "backup-codes"
  | "done";

interface TwoFactorSetupWizardProps {
  accountEmail?: string;
  onComplete?: () => void;
  onCancel?: () => void;
}

const STEP_LABELS: Record<Step, string> = {
  intro: "Introduction",
  "choose-method": "Choose Method",
  "setup-app": "Scan QR Code",
  "setup-sms": "Add Phone",
  verify: "Verify",
  "backup-codes": "Backup Codes",
  done: "Done",
};

const ORDERED_STEPS: Step[] = [
  "intro",
  "choose-method",
  "setup-app",
  "verify",
  "backup-codes",
  "done",
];

function StepIndicator({ current, steps }: { current: Step; steps: Step[] }) {
  const index = steps.indexOf(current);
  return (
    <ol
      aria-label="Setup progress"
      className="flex items-center gap-1"
    >
      {steps.map((step, i) => (
        <li key={step} className="flex items-center gap-1">
          <span
            aria-current={step === current ? "step" : undefined}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold transition-colors",
              i < index
                ? "bg-green-500 text-white"
                : i === index
                ? "bg-blue-500 text-white"
                : "bg-border text-foreground-muted"
            )}
          >
            {i < index ? <Check size={10} /> : i + 1}
          </span>
          {i < steps.length - 1 && (
            <span className="h-px w-4 bg-border" aria-hidden="true" />
          )}
        </li>
      ))}
    </ol>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);
  return (
    <button
      onClick={handleCopy}
      aria-label={copied ? "Copied" : label}
      className="ml-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-foreground-muted hover:text-foreground transition-colors"
    >
      {copied ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function TwoFactorSetupWizard({
  accountEmail = "user@example.com",
  onComplete,
  onCancel,
}: TwoFactorSetupWizardProps) {
  const [step, setStep] = useState<Step>("intro");
  const [method, setMethod] = useState<TwoFactorMethod>("app");
  const [secret] = useState(() => generateSecret());
  const [backupCodes] = useState(() => generateBackupCodes(8));
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationError, setVerificationError] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [qrError, setQrError] = useState(false);
  const [backupDownloaded, setBackupDownloaded] = useState(false);

  const otpUri = buildOtpAuthUri(secret, accountEmail);
  const qrUrl = buildQrImageUrl(otpUri);

  const steps: Step[] =
    method === "app"
      ? ["intro", "choose-method", "setup-app", "verify", "backup-codes", "done"]
      : ["intro", "choose-method", "setup-sms", "verify", "backup-codes", "done"];

  function goNext() {
    const idx = steps.indexOf(step);
    if (idx < steps.length - 1) setStep(steps[idx + 1]);
  }

  function goBack() {
    const idx = steps.indexOf(step);
    if (idx > 0) setStep(steps[idx - 1]);
  }

  function handleVerify() {
    if (!isValidSixDigitCode(verificationCode)) {
      setVerificationError("Please enter a valid 6-digit code.");
      return;
    }
    setVerificationError("");
    goNext();
  }

  function handlePhoneNext() {
    if (!isValidPhoneNumber(phoneNumber)) {
      setPhoneError("Please enter a valid phone number.");
      return;
    }
    setPhoneError("");
    goNext();
  }

  function handleDownloadBackupCodes() {
    const text = formatBackupCodesText(backupCodes, accountEmail);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "stellarswipe-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
    setBackupDownloaded(true);
  }

  return (
    <div className="space-y-4" role="region" aria-label="Two-factor authentication setup">
      {/* Step indicator */}
      <div className="flex items-center justify-between">
        <StepIndicator current={step} steps={steps} />
        <span className="text-xs text-foreground-muted">
          {STEP_LABELS[step]}
        </span>
      </div>

      {/* Step: Intro */}
      {step === "intro" && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield size={18} className="text-blue-400" aria-hidden="true" />
              <h2 className="text-base font-semibold text-foreground">
                Two-Factor Authentication
              </h2>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-4">
            <p className="text-sm text-foreground-muted">
              Two-factor authentication adds an extra layer of security to your account.
              In addition to your password, you&apos;ll need to enter a code from your phone
              each time you sign in.
            </p>
            <ul className="space-y-2 text-sm text-foreground-muted">
              {[
                "Protects your account even if your password is compromised",
                "Works with Google Authenticator, Authy, and other TOTP apps",
                "SMS backup option available for account recovery",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle size={13} className="mt-0.5 shrink-0 text-green-400" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={goNext} className="gap-1.5">
                Get started <ChevronRight size={13} />
              </Button>
              {onCancel && (
                <Button size="sm" variant="ghost" onClick={onCancel}>
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Choose method */}
      {step === "choose-method" && (
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-foreground">
              Choose Authentication Method
            </h2>
            <p className="text-xs text-foreground-muted">
              Select how you&apos;d like to receive your verification codes.
            </p>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3">
            <button
              onClick={() => setMethod("app")}
              aria-pressed={method === "app"}
              className={cn(
                "w-full flex items-start gap-3 rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                method === "app"
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-border hover:border-foreground-muted"
              )}
            >
              <Smartphone
                size={18}
                className={method === "app" ? "text-blue-400 mt-0.5" : "text-foreground-muted mt-0.5"}
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-medium text-foreground">Authenticator App</p>
                <p className="text-xs text-foreground-muted mt-0.5">
                  Use Google Authenticator, Authy, or any TOTP-compatible app.
                  Most secure option.
                </p>
              </div>
              {method === "app" && (
                <Check size={14} className="ml-auto mt-0.5 text-blue-400 shrink-0" />
              )}
            </button>

            <button
              onClick={() => setMethod("sms")}
              aria-pressed={method === "sms"}
              className={cn(
                "w-full flex items-start gap-3 rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                method === "sms"
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-border hover:border-foreground-muted"
              )}
            >
              <MessageSquare
                size={18}
                className={method === "sms" ? "text-blue-400 mt-0.5" : "text-foreground-muted mt-0.5"}
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-medium text-foreground">SMS Backup</p>
                <p className="text-xs text-foreground-muted mt-0.5">
                  Receive a code via text message. Use as a backup recovery option.
                </p>
              </div>
              {method === "sms" && (
                <Check size={14} className="ml-auto mt-0.5 text-blue-400 shrink-0" />
              )}
            </button>

            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={goBack} className="gap-1">
                <ChevronLeft size={13} /> Back
              </Button>
              <Button size="sm" onClick={goNext} className="gap-1.5">
                Continue <ChevronRight size={13} />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Setup app — QR code */}
      {step === "setup-app" && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <QrCode size={16} className="text-blue-400" aria-hidden="true" />
              <h2 className="text-base font-semibold text-foreground">Scan QR Code</h2>
            </div>
            <p className="text-xs text-foreground-muted">
              Open your authenticator app and scan the QR code below.
            </p>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-4">
            {/* QR code image */}
            <div
              className="flex justify-center"
              aria-label="QR code for authenticator app"
            >
              {!qrError ? (
                <Image
                  src={qrUrl}
                  alt="Scan this QR code with your authenticator app"
                  width={180}
                  height={180}
                  className="rounded-md border border-border bg-white p-2"
                  onError={() => setQrError(true)}
                  unoptimized
                />
              ) : (
                <div className="flex h-44 w-44 items-center justify-center rounded-md border border-border bg-card text-center text-xs text-foreground-muted p-3">
                  QR code unavailable. Use the manual code below.
                </div>
              )}
            </div>

            {/* Manual entry */}
            <div className="rounded-lg border border-border bg-card p-3 space-y-1">
              <p className="text-xs font-medium text-foreground-muted flex items-center gap-1">
                <Key size={11} aria-hidden="true" />
                Manual entry code (if QR scan fails)
              </p>
              <div className="flex items-center gap-1 flex-wrap">
                <code className="font-mono text-sm text-foreground tracking-wider break-all">
                  {formatSecretForDisplay(secret)}
                </code>
                <CopyButton text={secret} label="Copy secret key" />
              </div>
              <p className="text-[11px] text-foreground-subtle">
                Enter this key manually in your authenticator app under &ldquo;Enter a setup key.&rdquo;
              </p>
            </div>

            {/* Instructions */}
            <ol className="space-y-1 text-xs text-foreground-muted list-decimal list-inside">
              <li>Open Google Authenticator, Authy, or another TOTP app</li>
              <li>Tap the &ldquo;+&rdquo; or &ldquo;Add account&rdquo; button</li>
              <li>Scan the QR code above, or enter the key manually</li>
              <li>A 6-digit code will appear — you&apos;ll verify it next</li>
            </ol>

            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={goBack} className="gap-1">
                <ChevronLeft size={13} /> Back
              </Button>
              <Button size="sm" onClick={goNext} className="gap-1.5">
                I&apos;ve scanned it <ChevronRight size={13} />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Setup SMS */}
      {step === "setup-sms" && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-blue-400" aria-hidden="true" />
              <h2 className="text-base font-semibold text-foreground">Add Phone Number</h2>
            </div>
            <p className="text-xs text-foreground-muted">
              Enter your phone number to receive verification codes via SMS.
            </p>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="phone-input"
                className="text-xs font-medium text-foreground-muted"
              >
                Phone number
              </label>
              <input
                id="phone-input"
                type="tel"
                value={phoneNumber}
                onChange={(e) => {
                  setPhoneNumber(e.target.value);
                  if (phoneError) setPhoneError("");
                }}
                placeholder="+1 555 000 0000"
                autoComplete="tel"
                className={cn(
                  "w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring",
                  phoneError ? "border-red-500" : "border-border"
                )}
                aria-describedby={phoneError ? "phone-error" : undefined}
                aria-invalid={!!phoneError}
              />
              {phoneError && (
                <p id="phone-error" role="alert" className="text-xs text-red-500">
                  {phoneError}
                </p>
              )}
              <p className="text-[11px] text-foreground-subtle">
                Include country code (e.g. +1 for US). Standard messaging rates may apply.
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={goBack} className="gap-1">
                <ChevronLeft size={13} /> Back
              </Button>
              <Button size="sm" onClick={handlePhoneNext} className="gap-1.5">
                Send code <ChevronRight size={13} />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Verify */}
      {step === "verify" && (
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-foreground">
              Enter Verification Code
            </h2>
            <p className="text-xs text-foreground-muted">
              {method === "app"
                ? "Enter the 6-digit code shown in your authenticator app."
                : `Enter the 6-digit code sent to ${maskPhoneNumber(phoneNumber)}.`}
            </p>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="verification-code"
                className="text-xs font-medium text-foreground-muted"
              >
                Verification code
              </label>
              <input
                id="verification-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={verificationCode}
                onChange={(e) => {
                  setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                  if (verificationError) setVerificationError("");
                }}
                placeholder="000000"
                autoComplete="one-time-code"
                className={cn(
                  "w-40 rounded-md border bg-background px-3 py-2 text-center font-mono text-lg tracking-widest text-foreground focus:outline-none focus:ring-2 focus:ring-ring",
                  verificationError ? "border-red-500" : "border-border"
                )}
                aria-describedby={verificationError ? "verify-error" : undefined}
                aria-invalid={!!verificationError}
              />
              {verificationError && (
                <p id="verify-error" role="alert" className="text-xs text-red-500">
                  {verificationError}
                </p>
              )}
              <p className="text-[11px] text-foreground-subtle">
                Codes refresh every 30 seconds. Do not share this code with anyone.
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={goBack} className="gap-1">
                <ChevronLeft size={13} /> Back
              </Button>
              <Button
                size="sm"
                onClick={handleVerify}
                disabled={verificationCode.length < 6}
                className="gap-1.5"
              >
                Verify <ChevronRight size={13} />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Backup codes */}
      {step === "backup-codes" && (
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-foreground">Save Backup Codes</h2>
            <p className="text-xs text-foreground-muted">
              Store these codes somewhere safe. Each can be used once if you lose access to your authenticator.
            </p>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-4">
            <div className="rounded-lg border border-border bg-card p-3">
              <ul
                className="grid grid-cols-2 gap-1.5"
                aria-label="Backup codes"
              >
                {backupCodes.map((code, i) => (
                  <li
                    key={code}
                    className="font-mono text-xs text-foreground flex items-center gap-1.5"
                  >
                    <span className="text-foreground-subtle w-4 text-right shrink-0">
                      {String(i + 1).padStart(2, "0")}.
                    </span>
                    {code}
                  </li>
                ))}
              </ul>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadBackupCodes}
              className="gap-1.5 w-full"
              aria-label="Download backup codes as text file"
            >
              <Download size={13} aria-hidden="true" />
              {backupDownloaded ? "Downloaded ✓" : "Download backup codes (.txt)"}
            </Button>

            <div
              role="note"
              className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-foreground-muted"
            >
              <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-400" aria-hidden="true" />
              <span>
                These codes will not be shown again. Download or write them down before continuing.
              </span>
            </div>

            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={goBack} className="gap-1">
                <ChevronLeft size={13} /> Back
              </Button>
              <Button size="sm" onClick={goNext} className="gap-1.5">
                I&apos;ve saved my codes <ChevronRight size={13} />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Done */}
      {step === "done" && (
        <Card>
          <CardContent className="px-5 py-8 flex flex-col items-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/15">
              <Shield size={26} className="text-green-400" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                2FA Enabled Successfully
              </h2>
              <p className="mt-1 text-sm text-foreground-muted max-w-sm">
                Your account is now protected with two-factor authentication.
                {method === "app"
                  ? " You'll need your authenticator app each time you sign in."
                  : " You'll receive SMS codes each time you sign in."}
              </p>
            </div>

            {/* Session timeout reminder */}
            <div
              role="note"
              aria-label="Session timeout reminder"
              className="w-full flex gap-2 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-xs text-left text-foreground-muted"
            >
              <Shield size={13} className="mt-0.5 shrink-0 text-blue-400" aria-hidden="true" />
              <span>
                <span className="font-medium text-foreground">Session reminder: </span>
                For your security, sessions expire after 30 minutes of inactivity when 2FA is enabled.
                You&apos;ll be asked to re-authenticate with your 2FA code on the next sign-in.
              </span>
            </div>

            <Button
              size="sm"
              onClick={onComplete}
              className="gap-1.5 mt-1"
              aria-label="Finish 2FA setup"
            >
              <CheckCircle size={13} aria-hidden="true" />
              Done
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface DisableTwoFactorProps {
  onDisabled?: () => void;
}

export function DisableTwoFactor({ onDisabled }: DisableTwoFactorProps) {
  const [confirmEmail, setConfirmEmail] = useState("");
  const [step, setStep] = useState<"idle" | "confirm" | "done">("idle");
  const [error, setError] = useState("");

  function handleDisable() {
    if (!confirmEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    setStep("done");
    onDisabled?.();
  }

  if (step === "done") {
    return (
      <div className="flex items-center gap-2 text-sm text-green-400">
        <CheckCircle size={14} aria-hidden="true" />
        2FA has been disabled for your account.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {step === "idle" && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setStep("confirm")}
          className="gap-1.5 text-red-500 border-red-500/30 hover:bg-red-500/10"
          aria-label="Disable two-factor authentication"
        >
          <X size={13} aria-hidden="true" />
          Disable 2FA
        </Button>
      )}

      {step === "confirm" && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 space-y-3">
          <p className="text-sm text-foreground-muted">
            To confirm, enter your account email address:
          </p>
          <input
            type="email"
            value={confirmEmail}
            onChange={(e) => {
              setConfirmEmail(e.target.value);
              if (error) setError("");
            }}
            placeholder="your@email.com"
            autoComplete="email"
            className={cn(
              "w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring",
              error ? "border-red-500" : "border-border"
            )}
            aria-label="Confirm email to disable 2FA"
            aria-invalid={!!error}
          />
          {error && (
            <p role="alert" className="text-xs text-red-500">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setStep("idle");
                setConfirmEmail("");
                setError("");
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleDisable}
              className="bg-red-600 hover:bg-red-700 text-white gap-1"
            >
              Confirm Disable
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
