import { useWalletStore } from "@/store/useWalletStore";
import { useBookmarkStore } from "@/store/useBookmarkStore";
import { useSignalStore, type Signal } from "@/store/useSignalStore";
import {
  useTransactionStore,
  type TransactionHistoryItem,
} from "@/store/useTransactionStore";
import { useDemoModeStore } from "@/store/useDemoModeStore";
import { useOnboardingStore } from "@/store/useOnboardingStore";
import { usePositionLimitStore } from "@/store/usePositionLimitStore";
import { useSignalFilterStore } from "@/store/useSignalFilterStore";
import { useThemeStore } from "@/store/useThemeStore";

// ── useWalletStore ────────────────────────────────────────────────────────────

describe("useWalletStore", () => {
  beforeEach(() => {
    useWalletStore.setState({ publicKey: null, isConnected: false, network: "TESTNET" });
  });

  it("starts disconnected with no public key", () => {
    const { publicKey, isConnected, network } = useWalletStore.getState();
    expect(publicKey).toBeNull();
    expect(isConnected).toBe(false);
    expect(network).toBe("TESTNET");
  });

  it("setPublicKey updates the key", () => {
    useWalletStore.getState().setPublicKey("GABCDEF123");
    expect(useWalletStore.getState().publicKey).toBe("GABCDEF123");
  });

  it("setConnected transitions to connected state", () => {
    useWalletStore.getState().setPublicKey("GKEY");
    useWalletStore.getState().setConnected(true);
    expect(useWalletStore.getState().isConnected).toBe(true);
  });

  it("disconnect clears key and connected flag", () => {
    useWalletStore.setState({ publicKey: "GKEY", isConnected: true });
    useWalletStore.getState().disconnect();
    const { publicKey, isConnected } = useWalletStore.getState();
    expect(publicKey).toBeNull();
    expect(isConnected).toBe(false);
  });

  it("disconnect preserves network value", () => {
    useWalletStore.setState({ network: "MAINNET" });
    useWalletStore.getState().disconnect();
    expect(useWalletStore.getState().network).toBe("MAINNET");
  });
});

// ── useSignalStore ────────────────────────────────────────────────────────────

const SAMPLE_SIGNALS: Signal[] = [
  { id: "s1", asset: "XLM", signal: "BUY", price: 0.48 },
  { id: "s2", asset: "AQUA", signal: "SELL", price: 0.15 },
];

describe("useSignalStore", () => {
  beforeEach(() => {
    useSignalStore.setState({ queue: [], isPassing: false });
  });

  it("setQueue replaces the queue", () => {
    useSignalStore.getState().setQueue(SAMPLE_SIGNALS);
    expect(useSignalStore.getState().queue).toHaveLength(2);
    expect(useSignalStore.getState().queue[0].id).toBe("s1");
  });

  it("setIsPassing toggles the flag", () => {
    useSignalStore.getState().setIsPassing(true);
    expect(useSignalStore.getState().isPassing).toBe(true);
    useSignalStore.getState().setIsPassing(false);
    expect(useSignalStore.getState().isPassing).toBe(false);
  });

  it("passSignal is a no-op when queue is empty", () => {
    useSignalStore.setState({ queue: [], isPassing: false });
    useSignalStore.getState().passSignal();
    expect(useSignalStore.getState().isPassing).toBe(false);
  });

  it("passSignal sets isPassing to true when queue is non-empty", () => {
    useSignalStore.getState().setQueue(SAMPLE_SIGNALS);
    useSignalStore.getState().passSignal();
    expect(useSignalStore.getState().isPassing).toBe(true);
  });

  it("passSignal is a no-op when already passing (debounce guard)", () => {
    useSignalStore.setState({ queue: SAMPLE_SIGNALS, isPassing: true });
    const before = useSignalStore.getState().queue.length;
    useSignalStore.getState().passSignal();
    expect(useSignalStore.getState().queue.length).toBe(before);
  });

  it("setQueue with empty array clears signals", () => {
    useSignalStore.getState().setQueue(SAMPLE_SIGNALS);
    useSignalStore.getState().setQueue([]);
    expect(useSignalStore.getState().queue).toHaveLength(0);
  });
});

// ── useBookmarkStore ─────────────────────────────────────────────────────────

describe("useBookmarkStore", () => {
  beforeEach(() => {
    useBookmarkStore.setState({
      bookmarks: [],
      hasBookmark: (id: string) => useBookmarkStore.getState().bookmarks.includes(id),
      addBookmark: useBookmarkStore.getState().addBookmark,
      removeBookmark: useBookmarkStore.getState().removeBookmark,
      toggleBookmark: useBookmarkStore.getState().toggleBookmark,
      setBookmarks: useBookmarkStore.getState().setBookmarks,
      clearBookmarks: useBookmarkStore.getState().clearBookmarks,
    });
  });

  it("adds and removes bookmarks", () => {
    useBookmarkStore.getState().addBookmark("signal-1");
    expect(useBookmarkStore.getState().bookmarks).toEqual(["signal-1"]);
    useBookmarkStore.getState().removeBookmark("signal-1");
    expect(useBookmarkStore.getState().bookmarks).toEqual([]);
  });

  it("toggleBookmark flips membership", () => {
    useBookmarkStore.getState().toggleBookmark("signal-2");
    expect(useBookmarkStore.getState().bookmarks).toEqual(["signal-2"]);
    useBookmarkStore.getState().toggleBookmark("signal-2");
    expect(useBookmarkStore.getState().bookmarks).toEqual([]);
  });

  it("setBookmarks deduplicates ids", () => {
    useBookmarkStore.getState().setBookmarks(["signal-3", "signal-3", "signal-4"]);
    expect(useBookmarkStore.getState().bookmarks).toEqual(["signal-3", "signal-4"]);
  });

  it("hasBookmark reflects current state", () => {
    useBookmarkStore.getState().addBookmark("signal-5");
    expect(useBookmarkStore.getState().hasBookmark("signal-5")).toBe(true);
    expect(useBookmarkStore.getState().hasBookmark("signal-x")).toBe(false);
  });
});

// ── useTransactionStore ───────────────────────────────────────────────────────

const NEW_TX: TransactionHistoryItem = {
  id: "tx-new",
  hash: "aabbcc",
  assetPair: "XLM/USDC",
  amount: "50",
  price: "0.49",
  fee: "0.0001",
  token: "XLM",
  timestamp: 1000000,
  type: "SWAP",
  status: "PENDING",
  outcome: "PENDING",
};

describe("useTransactionStore", () => {
  beforeEach(() => {
    useTransactionStore.getState().reset();
  });

  it("reset clears success, error, and history", () => {
    const { success, showSuccess, error, showError, history } =
      useTransactionStore.getState();
    expect(success).toBeNull();
    expect(showSuccess).toBe(false);
    expect(error).toBeNull();
    expect(showError).toBe(false);
    expect(history).toHaveLength(0);
  });

  it("setSuccess stores details and shows success panel", () => {
    const details = { hash: "h1", amount: "10", price: "0.5", fee: "0.001", token: "XLM", timestamp: 0 };
    useTransactionStore.getState().setSuccess(details);
    const { success, showSuccess, showError } = useTransactionStore.getState();
    expect(success).toEqual(details);
    expect(showSuccess).toBe(true);
    expect(showError).toBe(false);
  });

  it("clearSuccess hides the success panel", () => {
    const details = { hash: "h1", amount: "10", price: "0.5", fee: "0.001", token: "XLM", timestamp: 0 };
    useTransactionStore.getState().setSuccess(details);
    useTransactionStore.getState().clearSuccess();
    expect(useTransactionStore.getState().success).toBeNull();
    expect(useTransactionStore.getState().showSuccess).toBe(false);
  });

  it("setError stores error and hides success", () => {
    useTransactionStore.getState().setError({ message: "Network error", code: "ERR_01" });
    const { error, showError, showSuccess } = useTransactionStore.getState();
    expect(error?.message).toBe("Network error");
    expect(showError).toBe(true);
    expect(showSuccess).toBe(false);
  });

  it("clearError hides the error panel", () => {
    useTransactionStore.getState().setError({ message: "err" });
    useTransactionStore.getState().clearError();
    expect(useTransactionStore.getState().error).toBeNull();
    expect(useTransactionStore.getState().showError).toBe(false);
  });

  it("addTransaction prepends to history", () => {
    useTransactionStore.getState().addTransaction(NEW_TX);
    const { history } = useTransactionStore.getState();
    expect(history[0].id).toBe("tx-new");
    expect(history).toHaveLength(1);
  });

  it("updateTransactionStatus changes status to SUCCEEDED", () => {
    useTransactionStore.getState().addTransaction(NEW_TX);
    useTransactionStore.getState().updateTransactionStatus("tx-new", "SUCCEEDED");
    const tx = useTransactionStore.getState().history.find((t) => t.id === "tx-new");
    expect(tx?.status).toBe("SUCCEEDED");
    expect(tx?.outcome).toBe("WIN");
  });

  it("updateTransactionStatus changes status to FAILED", () => {
    useTransactionStore.getState().addTransaction(NEW_TX);
    useTransactionStore.getState().updateTransactionStatus("tx-new", "FAILED");
    const tx = useTransactionStore.getState().history.find((t) => t.id === "tx-new");
    expect(tx?.status).toBe("FAILED");
    expect(tx?.outcome).toBe("LOSS");
  });

  it("updateTransactionStatus accepts an explicit outcome override", () => {
    useTransactionStore.getState().addTransaction(NEW_TX);
    useTransactionStore.getState().updateTransactionStatus("tx-new", "SUCCEEDED", "LOSS");
    const tx = useTransactionStore.getState().history.find((t) => t.id === "tx-new");
    expect(tx?.outcome).toBe("LOSS");
  });

  it("updateTransactionStatus does not mutate unrelated transactions", () => {
    const other: TransactionHistoryItem = { ...NEW_TX, id: "tx-other" };
    useTransactionStore.getState().addTransaction(NEW_TX);
    useTransactionStore.getState().addTransaction(other);
    useTransactionStore.getState().updateTransactionStatus("tx-new", "SUCCEEDED");
    const untouched = useTransactionStore.getState().history.find((t) => t.id === "tx-other");
    expect(untouched?.status).toBe("PENDING");
  });

  it("setPreservedInput stores arbitrary input and can be cleared", () => {
    useTransactionStore.getState().setPreservedInput({ amount: "42", type: "LIMIT" });
    expect(useTransactionStore.getState().preservedInput).toEqual({ amount: "42", type: "LIMIT" });
    useTransactionStore.getState().setPreservedInput(null);
    expect(useTransactionStore.getState().preservedInput).toBeNull();
  });
});

// ── Rehydration guard — _hasHydrated flag ────────────────────────────────────

describe("Rehydration guard – _hasHydrated flag", () => {
  const stores = [
    { name: "useBookmarkStore", store: useBookmarkStore },
    { name: "useDemoModeStore", store: useDemoModeStore },
    { name: "useOnboardingStore", store: useOnboardingStore },
    { name: "usePositionLimitStore", store: usePositionLimitStore },
    { name: "useSignalFilterStore", store: useSignalFilterStore },
    { name: "useThemeStore", store: useThemeStore },
  ] as const;

  stores.forEach(({ name, store }) => {
    it(`${name}: _hasHydrated starts false`, () => {
      (store as any).setState({ _hasHydrated: false });
      expect((store.getState() as any)._hasHydrated).toBe(false);
    });

    it(`${name}: setHasHydrated(true) sets _hasHydrated to true`, () => {
      (store as any).setState({ _hasHydrated: false });
      (store.getState() as any).setHasHydrated(true);
      expect((store.getState() as any)._hasHydrated).toBe(true);
    });

    it(`${name}: setHasHydrated(false) resets _hasHydrated`, () => {
      (store as any).setState({ _hasHydrated: true });
      (store.getState() as any).setHasHydrated(false);
      expect((store.getState() as any)._hasHydrated).toBe(false);
    });
  });
});
