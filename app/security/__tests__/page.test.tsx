/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import SecuritySettingsPage from "../page";
import { bugBountyProgram } from "@/content/security";

describe("SecuritySettingsPage", () => {
  it("renders the public bug-bounty program section", () => {
    const { container } = render(<SecuritySettingsPage />);

    expect(
      screen.getByRole("heading", { name: bugBountyProgram.title })
    ).toBeTruthy();
    expect(screen.getByText(bugBountyProgram.summary)).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: bugBountyProgram.contact.label })
        .getAttribute("href")
    ).toBe(bugBountyProgram.contact.href);

    for (const scopeItem of bugBountyProgram.scope) {
      expect(screen.getByText(scopeItem)).toBeTruthy();
    }

    for (const tier of bugBountyProgram.rewardTiers) {
      expect(screen.getByText(tier.severity)).toBeTruthy();
      expect(screen.getByText(tier.description)).toBeTruthy();
    }

    expect(container).toMatchSnapshot();
  });
});
