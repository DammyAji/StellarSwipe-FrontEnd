export const securityProgram = {
  title: "Bug Bounty Program",
  summary:
    "Help keep StellarSwipe users safe by reporting reproducible security issues through responsible disclosure.",
  scope: [
    "Authentication, session, and account protection issues",
    "Wallet connection, signing, and transaction flow vulnerabilities",
    "API routes that handle user, portfolio, or trade data",
    "Frontend handling of sensitive security or trading state",
  ],
  outOfScope: [
    "Social engineering, spam, or physical attacks",
    "Reports without clear reproduction steps",
    "Issues that require unsafe testing against other users",
  ],
  rewardTiers: [
    { severity: "Critical", reward: "Case-by-case priority bounty review" },
    { severity: "High", reward: "Eligible for bounty consideration" },
    { severity: "Medium / Low", reward: "Acknowledgement and triage" },
  ],
  submission: {
    label: "Report a vulnerability",
    href: "mailto:security@stellarswipe.app",
    text:
      "Email security@stellarswipe.app with the affected route or component, reproduction steps, expected impact, and any suggested fix.",
  },
} as const;
