import { maskValue, privateModeAnnouncement, PRIVATE_MASK } from "@/lib/journalPrivacy";

describe("journalPrivacy", () => {
  it("masks only when private mode is on and never changes the input", () => {
    const value = "120 XLM";
    expect(maskValue(value, false)).toBe("120 XLM");
    expect(maskValue(value, true)).toBe(PRIVATE_MASK);
    expect(value).toBe("120 XLM");
  });

  it("announces both states", () => {
    expect(privateModeAnnouncement(true)).toMatch(/hidden/i);
    expect(privateModeAnnouncement(false)).toMatch(/visible/i);
  });
});
