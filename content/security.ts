export const bugBountyProgram = {
  title: "Responsible Disclosure",
  summary:
    "Security researchers can report vulnerabilities that affect StellarSwipe accounts, wallets, trading flows, or platform data integrity.",
  scope: [
    "Authentication and session handling",
    "Wallet connection and transaction-signing flows",
    "Signal, portfolio, subscription, and webhook data access",
    "Cross-site scripting, injection, or authorization bypasses",
  ],
  rewardTiers: [
    {
      severity: "Critical",
      description:
        "Eligible for the highest reward review when a report demonstrates direct wallet, account, or funds-risk impact.",
    },
    {
      severity: "High",
      description:
        "Eligible for reward review when a report demonstrates account takeover, sensitive data exposure, or privileged action abuse.",
    },
    {
      severity: "Medium",
      description:
        "Eligible for recognition or a smaller reward review when a report demonstrates limited but reproducible security impact.",
    },
  ],
  submissionSteps: [
    "Open a private GitHub vulnerability report with a clear summary and affected route or component.",
    "Include reproducible steps, expected impact, screenshots or logs, and any proof-of-concept payloads.",
    "Allow maintainers time to triage and remediate before public disclosure.",
  ],
  contact: {
    label: "Submit a private vulnerability report",
    href: "https://github.com/AgesEmpire/StellarSwipe-FrontEnd/security/advisories/new",
  },
};
