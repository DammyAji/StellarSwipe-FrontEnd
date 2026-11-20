import {
  DEFAULT_REQUIREMENTS,
  describeMissing,
  hasRequirements,
  incompleteEntryMap,
  incompleteStatusMessage,
  missingFieldsFor,
  type CompletenessRequirements,
} from "@/lib/journalIncomplete";

const entry = (over: Partial<{ id: string; tags: string[]; status: "PENDING" | "SUCCEEDED" | "FAILED"; outcome: "WIN" | "LOSS" | "PENDING" }> = {}) => ({
  id: "e",
  tags: ["dca"],
  status: "SUCCEEDED" as const,
  outcome: "WIN" as const,
  ...over,
});

const both = DEFAULT_REQUIREMENTS;
const none: CompletenessRequirements = { requireTags: false, requireOutcome: false };

describe("missingFieldsFor", () => {
  it("does not flag a complete entry", () => {
    expect(missingFieldsFor(entry(), both)).toEqual([]);
  });

  it("flags missing tags, including an empty or absent tag list", () => {
    expect(missingFieldsFor(entry({ tags: [] }), both)).toEqual(["tags"]);
    expect(missingFieldsFor({ status: "SUCCEEDED", outcome: "WIN" }, both)).toEqual(["tags"]);
  });

  it("flags a completed entry whose outcome is still pending", () => {
    expect(missingFieldsFor(entry({ outcome: "PENDING" }), both)).toEqual(["outcome"]);
    expect(missingFieldsFor(entry({ status: "FAILED", outcome: "PENDING" }), both)).toEqual(["outcome"]);
  });

  it("reports every missing field", () => {
    expect(missingFieldsFor(entry({ tags: [], outcome: "PENDING" }), both)).toEqual(["tags", "outcome"]);
  });

  it("does not flag an outcome that cannot exist yet", () => {
    expect(missingFieldsFor(entry({ status: "PENDING", outcome: "PENDING" }), { requireTags: false, requireOutcome: true })).toEqual([]);
  });

  it("flags only what is required", () => {
    const e = entry({ tags: [], outcome: "PENDING" });
    expect(missingFieldsFor(e, { requireTags: true, requireOutcome: false })).toEqual(["tags"]);
    expect(missingFieldsFor(e, { requireTags: false, requireOutcome: true })).toEqual(["outcome"]);
    expect(missingFieldsFor(e, none)).toEqual([]);
  });
});

describe("incompleteEntryMap", () => {
  const history = [entry({ id: "a" }), entry({ id: "b", tags: [] }), entry({ id: "c", outcome: "PENDING" })];

  it("lists only the entries missing something, with their missing fields", () => {
    expect(Array.from(incompleteEntryMap(history, both))).toEqual([
      ["b", ["tags"]],
      ["c", ["outcome"]],
    ]);
  });

  it("flags nothing when no requirement is configured", () => {
    expect(incompleteEntryMap(history, none).size).toBe(0);
    expect(hasRequirements(none)).toBe(false);
  });

  it("returns an empty map for an empty journal", () => {
    expect(incompleteEntryMap([], both).size).toBe(0);
  });
});

describe("messages", () => {
  it("describes missing fields", () => {
    expect(describeMissing(["tags"])).toBe("Missing tags");
    expect(describeMissing(["tags", "outcome"])).toBe("Missing tags and outcome");
  });

  it("announces the state of the filter", () => {
    expect(incompleteStatusMessage(none, 0)).toMatch(/no requirements are configured/i);
    expect(incompleteStatusMessage(both, 0)).toBe("No entries are missing required details.");
    expect(incompleteStatusMessage(both, 1)).toBe("1 entry is missing required details.");
    expect(incompleteStatusMessage(both, 3)).toBe("3 entries are missing required details.");
  });
});
