import { test, expect } from "@playwright/test";

test.describe("forced-colors accessibility", () => {
  test("renders key controls with visible high-contrast styling", async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await page.goto("/forced-colors-demo");

    const buyBadge = page.locator('[aria-label="BUY signal"]').first();
    const premiumBadge = page.locator('[aria-label*="Premium signal"]').first();
    const toggle = page.getByRole("button", { name: /demo mode/i }).first();

    await expect(buyBadge).toBeVisible();
    await expect(premiumBadge).toBeVisible();
    await expect(toggle).toBeVisible();

    const badgeStyles = await buyBadge.evaluate((element) => {
      const styles = window.getComputedStyle(element);
      return {
        backgroundColor: styles.backgroundColor,
        color: styles.color,
        borderColor: styles.borderColor,
      };
    });

    expect(badgeStyles.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(badgeStyles.color).not.toBe("rgba(0, 0, 0, 0)");
    expect(badgeStyles.borderColor).not.toBe("rgba(0, 0, 0, 0)");
  });
});
