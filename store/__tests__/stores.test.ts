import { useWalletStore } from "@/store/useWalletStore";
import { useBookmarkStore } from "@/store/useBookmarkStore";
import { useSignalStore, type Signal } from "@/store/useSignalStore";
import {
  useTransactionStore,
  type TransactionHistoryItem,
} from "@/store/useTransactionStore";
import { useDemoModeStore } from "@/store/useDemoModeStore";
import {
  useOnboardingStore,
  ONBOARDING_TOTAL_STEPS,
} from "@/store/useOnboardingStore";
import { usePositionLimitStore } from "@/store/usePositionLimitStore";
import { useSignalFilterStore } from "@/store/useSignalFilterStore";
import { useThemeStore } from "@/store/useThemeStore";

// ── useWalletStore ────────────────────────────────────────────────────────────

describe("useWalletStore", () => {
  beforeEach(() => {
    useWalletStore.setState({
      wallets: [],
      activePublicKey: null,
      defaultTradeWalletPublicKey: null,
      publicKey: null,
      isConnected: false,
      network: "TESTNET",
    });
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
    useWalletStore.setState({
      activePublicKey: "GKEY",
      publicKey: "GKEY",
      isConnected: true,
      wallets: [{ publicKey: "GKEY" }],
    });
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

  it("sets a default trade account only for a connected wallet", () => {
    useWalletStore.setState({
      wallets: [{ publicKey: "GWALLET_A" }, { publicKey: "GWALLET_B" }],
      activePublicKey: "GWALLET_A",
      publicKey: "GWALLET_A",
      isConnected: true,
    });

    useWalletStore.getState().setDefaultTradeWallet("GWALLET_B");
    expect(useWalletStore.getState().defaultTradeWalletPublicKey).toBe("GWALLET_B");

    useWalletStore.getState().setDefaultTradeWallet("GNOT_CONNECTED");
    expect(useWalletStore.getState().defaultTradeWalletPublicKey).toBe("GWALLET_B");
  });

  it("retains the saved preference through disconnect so it can be revalidated later", () => {
    useWalletStore.setState({
      wallets: [{ publicKey: "GWALLET_A" }],
      activePublicKey: "GWALLET_A",
      publicKey: "GWALLET_A",
      isConnected: true,
    });
    useWalletStore.getState().setDefaultTradeWallet("GWALLET_A");

    useWalletStore.getState().disconnectAll();

    expect(useWalletStore.getState().defaultTradeWalletPublicKey).toBe("GWALLET_A");
    expect(useWalletStore.getState().isConnected).toBe(false);
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
      hasBookmark: (id: string) =>
        useBookmarkStore.getState().bookmarks.includes(id),
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
    useBookmarkStore
      .getState()
      .setBookmarks(["signal-3", "signal-3", "signal-4"]);
    expect(useBookmarkStore.getState().bookmarks).toEqual([
      "signal-3",
      "signal-4",
    ]);
  });

  it("hasBookmark reflects current state", () => {
    useBookmarkStore.getState().addBookmark("signal-5");
    expect(useBookmarkStore.getState().hasBookmark("signal-5")).toBe(true);
    expect(useBookmarkStore.getState().hasBookmark("signal-x")).toBe(false);
  });
});

// ── Bookmark Folders ──────────────────────────────────────────────────────────

describe("bookmark folders", () => {
  beforeEach(() => {
    useBookmarkStore.setState({
      bookmarks: [],
      folders: [],
    });
  });

  it("createFolder adds a new folder with the given name", () => {
    const id = useBookmarkStore.getState().createFolder("Watching");
    const folders = useBookmarkStore.getState().folders;
    expect(folders).toHaveLength(1);
    expect(folders[0].id).toBe(id);
    expect(folders[0].name).toBe("Watching");
    expect(folders[0].signalIds).toEqual([]);
  });

  it("createFolder returns a unique id each time", () => {
    const id1 = useBookmarkStore.getState().createFolder("A");
    const id2 = useBookmarkStore.getState().createFolder("B");
    expect(id1).not.toBe(id2);
    expect(useBookmarkStore.getState().folders).toHaveLength(2);
  });

  it("renameFolder updates the folder name", () => {
    const id = useBookmarkStore.getState().createFolder("Watch");
    useBookmarkStore.getState().renameFolder(id, "Watching");
    const folder = useBookmarkStore.getState().folders.find((f) => f.id === id);
    expect(folder?.name).toBe("Watching");
  });

  it("deleteFolder removes the folder", () => {
    const id = useBookmarkStore.getState().createFolder("Temp");
    expect(useBookmarkStore.getState().folders).toHaveLength(1);
    useBookmarkStore.getState().deleteFolder(id);
    expect(useBookmarkStore.getState().folders).toHaveLength(0);
  });

  it("assignSignalToFolder adds signal id to folder signalIds", () => {
    const id = useBookmarkStore.getState().createFolder("High Conviction");
    useBookmarkStore.getState().assignSignalToFolder("signal-1", id);
    const folder = useBookmarkStore.getState().folders.find((f) => f.id === id);
    expect(folder?.signalIds).toEqual(["signal-1"]);
  });

  it("assignSignalToFolder does not duplicate signal ids", () => {
    const id = useBookmarkStore.getState().createFolder("Test");
    useBookmarkStore.getState().assignSignalToFolder("s1", id);
    useBookmarkStore.getState().assignSignalToFolder("s1", id);
    const folder = useBookmarkStore.getState().folders.find((f) => f.id === id);
    expect(folder?.signalIds).toEqual(["s1"]);
  });

  it("removeSignalFromFolder removes signal id from folder", () => {
    const id = useBookmarkStore.getState().createFolder("Test");
    useBookmarkStore.getState().assignSignalToFolder("s1", id);
    useBookmarkStore.getState().assignSignalToFolder("s2", id);
    useBookmarkStore.getState().removeSignalFromFolder("s1", id);
    const folder = useBookmarkStore.getState().folders.find((f) => f.id === id);
    expect(folder?.signalIds).toEqual(["s2"]);
  });

  it("getSignalsByFolder returns signal ids for the folder", () => {
    const id = useBookmarkStore.getState().createFolder("Test");
    useBookmarkStore.getState().assignSignalToFolder("s1", id);
    useBookmarkStore.getState().assignSignalToFolder("s2", id);
    const ids = useBookmarkStore.getState().getSignalsByFolder(id);
    expect(ids).toEqual(["s1", "s2"]);
  });

  it("getSignalsByFolder returns empty array for nonexistent folder", () => {
    const ids = useBookmarkStore.getState().getSignalsByFolder("nonexistent");
    expect(ids).toEqual([]);
  });

  it("getFoldersForSignal returns all folders containing the signal", () => {
    const id1 = useBookmarkStore.getState().createFolder("A");
    const id2 = useBookmarkStore.getState().createFolder("B");
    useBookmarkStore.getState().assignSignalToFolder("s1", id1);
    useBookmarkStore.getState().assignSignalToFolder("s1", id2);
    useBookmarkStore.getState().assignSignalToFolder("s2", id1);
    const folders = useBookmarkStore.getState().getFoldersForSignal("s1");
    expect(folders).toHaveLength(2);
    expect(folders.map((f) => f.name).sort()).toEqual(["A", "B"]);
  });

  it("removeBookmark also removes signal from all folders", () => {
    const id = useBookmarkStore.getState().createFolder("Test");
    useBookmarkStore.getState().addBookmark("s1");
    useBookmarkStore.getState().assignSignalToFolder("s1", id);
    useBookmarkStore.getState().removeBookmark("s1");
    const folder = useBookmarkStore.getState().folders.find((f) => f.id === id);
    expect(folder?.signalIds).toEqual([]);
  });

  it("clearBookmarks clears folders too", () => {
    useBookmarkStore.getState().createFolder("A");
    useBookmarkStore.getState().createFolder("B");
    useBookmarkStore.getState().clearBookmarks();
    expect(useBookmarkStore.getState().bookmarks).toEqual([]);
    expect(useBookmarkStore.getState().folders).toEqual([]);
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
    const details = {
      hash: "h1",
      amount: "10",
      price: "0.5",
      fee: "0.001",
      token: "XLM",
      timestamp: 0,
    };
    useTransactionStore.getState().setSuccess(details);
    const { success, showSuccess, showError } = useTransactionStore.getState();
    expect(success).toEqual(details);
    expect(showSuccess).toBe(true);
    expect(showError).toBe(false);
  });

  it("clearSuccess hides the success panel", () => {
    const details = {
      hash: "h1",
      amount: "10",
      price: "0.5",
      fee: "0.001",
      token: "XLM",
      timestamp: 0,
    };
    useTransactionStore.getState().setSuccess(details);
    useTransactionStore.getState().clearSuccess();
    expect(useTransactionStore.getState().success).toBeNull();
    expect(useTransactionStore.getState().showSuccess).toBe(false);
  });

  it("setError stores error and hides success", () => {
    useTransactionStore
      .getState()
      .setError({ message: "Network error", code: "ERR_01" });
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
    useTransactionStore
      .getState()
      .updateTransactionStatus("tx-new", "SUCCEEDED");
    const tx = useTransactionStore
      .getState()
      .history.find((t) => t.id === "tx-new");
    expect(tx?.status).toBe("SUCCEEDED");
    expect(tx?.outcome).toBe("WIN");
  });

  it("updateTransactionStatus changes status to FAILED", () => {
    useTransactionStore.getState().addTransaction(NEW_TX);
    useTransactionStore.getState().updateTransactionStatus("tx-new", "FAILED");
    const tx = useTransactionStore
      .getState()
      .history.find((t) => t.id === "tx-new");
    expect(tx?.status).toBe("FAILED");
    expect(tx?.outcome).toBe("LOSS");
  });

  it("updateTransactionStatus accepts an explicit outcome override", () => {
    useTransactionStore.getState().addTransaction(NEW_TX);
    useTransactionStore
      .getState()
      .updateTransactionStatus("tx-new", "SUCCEEDED", "LOSS");
    const tx = useTransactionStore
      .getState()
      .history.find((t) => t.id === "tx-new");
    expect(tx?.outcome).toBe("LOSS");
  });

  it("updateTransactionStatus does not mutate unrelated transactions", () => {
    const other: TransactionHistoryItem = { ...NEW_TX, id: "tx-other" };
    useTransactionStore.getState().addTransaction(NEW_TX);
    useTransactionStore.getState().addTransaction(other);
    useTransactionStore
      .getState()
      .updateTransactionStatus("tx-new", "SUCCEEDED");
    const untouched = useTransactionStore
      .getState()
      .history.find((t) => t.id === "tx-other");
    expect(untouched?.status).toBe("PENDING");
  });

  it("setPreservedInput stores arbitrary input and can be cleared", () => {
    useTransactionStore
      .getState()
      .setPreservedInput({ amount: "42", type: "LIMIT" });
    expect(useTransactionStore.getState().preservedInput).toEqual({
      amount: "42",
      type: "LIMIT",
    });
    useTransactionStore.getState().setPreservedInput(null);
    expect(useTransactionStore.getState().preservedInput).toBeNull();
  });
});

// ── useOnboardingStore — resumable flow ──────────────────────────────────────

describe("useOnboardingStore", () => {
  beforeEach(() => {
    useOnboardingStore.setState({
      completed: false,
      dismissed: false,
      currentStep: 0,
    });
  });

  it("starts with step 0 and not completed", () => {
    const s = useOnboardingStore.getState();
    expect(s.currentStep).toBe(0);
    expect(s.completed).toBe(false);
    expect(s.dismissed).toBe(false);
  });

  it("setCurrentStep persists the step", () => {
    useOnboardingStore.getState().setCurrentStep(1);
    expect(useOnboardingStore.getState().currentStep).toBe(1);
  });

  it("setCompleted marks completed and dismissed and sets step to max", () => {
    useOnboardingStore.getState().setCompleted();
    const s = useOnboardingStore.getState();
    expect(s.completed).toBe(true);
    expect(s.dismissed).toBe(true);
    expect(s.currentStep).toBe(ONBOARDING_TOTAL_STEPS);
  });

  it("setDismissed marks dismissed without changing step", () => {
    useOnboardingStore.getState().setCurrentStep(2);
    useOnboardingStore.getState().setDismissed();
    const s = useOnboardingStore.getState();
    expect(s.dismissed).toBe(true);
    expect(s.completed).toBe(false);
    expect(s.currentStep).toBe(2);
  });

  it("resume from step 1 after simulated reload", () => {
    useOnboardingStore.getState().setCurrentStep(1);
    const state = useOnboardingStore.getState();
    expect(state.currentStep).toBe(1);
    expect(state.completed).toBe(false);
    expect(state.dismissed).toBe(false);
  });

  it("resume from step 2 after simulated reload", () => {
    useOnboardingStore.getState().setCurrentStep(2);
    const state = useOnboardingStore.getState();
    expect(state.currentStep).toBe(2);
    expect(state.completed).toBe(false);
  });

  it("reset clears everything including currentStep", () => {
    useOnboardingStore.getState().setCurrentStep(2);
    useOnboardingStore.getState().setCompleted();
    useOnboardingStore.getState().reset();
    const s = useOnboardingStore.getState();
    expect(s.completed).toBe(false);
    expect(s.dismissed).toBe(false);
    expect(s.currentStep).toBe(0);
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
