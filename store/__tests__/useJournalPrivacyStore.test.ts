import { useJournalPrivacyStore } from "@/store/useJournalPrivacyStore";

describe("useJournalPrivacyStore", () => {
  beforeEach(() => useJournalPrivacyStore.setState({ masked: false }));

  it("starts with values visible", () => {
    expect(useJournalPrivacyStore.getState().masked).toBe(false);
  });

  it("toggles and sets the masked state", () => {
    useJournalPrivacyStore.getState().toggle();
    expect(useJournalPrivacyStore.getState().masked).toBe(true);
    useJournalPrivacyStore.getState().toggle();
    expect(useJournalPrivacyStore.getState().masked).toBe(false);
    useJournalPrivacyStore.getState().setMasked(true);
    expect(useJournalPrivacyStore.getState().masked).toBe(true);
  });
});
