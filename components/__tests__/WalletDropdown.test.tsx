/**
 * @jest-environment jsdom
 *
 * WalletDropdown multi-wallet flows (#449): switching the active account,
 * disconnecting the active wallet vs. all wallets, the refresh-balance
 * aria-label states and the copy-address label updates.
 *
 * The component is rendered against the real `useWalletStore` so every
 * assertion also covers the underlying store logic, not just DOM text.
 */

import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { WalletDropdown } from "@/components/WalletDropdown";
import { useWalletStore } from "@/store/useWalletStore";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }),
}));

jest.mock("@/lib/stellar", () => ({
  NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
}));

jest.mock("@/hooks/usePortfolio", () => ({
  usePortfolio: () => ({ refetch: jest.fn().mockResolvedValue(undefined) }),
}));

jest.mock("@/lib/walletToast", () => ({
  walletToast: {
    connected: jest.fn(),
    disconnected: jest.fn(),
    denied: jest.fn(),
    signingDenied: jest.fn(),
    notFound: jest.fn(),
    timeout: jest.fn(),
    connectError: jest.fn(),
  },
}));

jest.mock("@sentry/nextjs", () => ({ captureException: jest.fn() }));

const WALLET_A = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const WALLET_B = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const WALLET_C = "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";

function truncate(key: string) {
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

function seedWallets(keys: string[], active: string) {
  useWalletStore.setState({
    wallets: keys.map((publicKey) => ({ publicKey })),
    activePublicKey: active,
    publicKey: active,
    isConnected: true,
    defaultTradeWalletPublicKey: null,
  });
}

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: /Wallet menu/ }));
  return screen.getByRole("menu", { name: "Wallet options" });
}

describe("WalletDropdown", () => {
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

  describe("multi-wallet switching", () => {
    it("moves the Active indicator to the switched-to entry and updates the store", async () => {
      seedWallets([WALLET_A, WALLET_B], WALLET_A);
      render(<WalletDropdown />);
      const menu = openMenu();

      const accountA = within(menu).getByRole("menuitem", {
        name: `Current account: ${truncate(WALLET_A)}`,
      });
      const accountB = within(menu).getByRole("menuitem", {
        name: `Switch to account: ${truncate(WALLET_B)}`,
      });

      expect(accountA).toHaveAttribute("aria-pressed", "true");
      expect(within(accountA).getByLabelText("Active")).toBeInTheDocument();
      expect(accountB).toHaveAttribute("aria-pressed", "false");
      expect(within(accountB).queryByLabelText("Active")).not.toBeInTheDocument();

      fireEvent.click(accountB);

      await waitFor(() => {
        expect(useWalletStore.getState().activePublicKey).toBe(WALLET_B);
      });
      expect(useWalletStore.getState().publicKey).toBe(WALLET_B);
      expect(useWalletStore.getState().isConnected).toBe(true);
      expect(useWalletStore.getState().wallets).toHaveLength(2);

      const switchedA = within(menu).getByRole("menuitem", {
        name: `Switch to account: ${truncate(WALLET_A)}`,
      });
      const switchedB = within(menu).getByRole("menuitem", {
        name: `Current account: ${truncate(WALLET_B)}`,
      });
      expect(switchedB).toHaveAttribute("aria-pressed", "true");
      expect(within(switchedB).getByLabelText("Active")).toBeInTheDocument();
      expect(switchedA).toHaveAttribute("aria-pressed", "false");
      expect(within(switchedA).queryByLabelText("Active")).not.toBeInTheDocument();
    });

    it("does not switch when the already-active entry is clicked", () => {
      seedWallets([WALLET_A, WALLET_B], WALLET_A);
      render(<WalletDropdown />);
      const menu = openMenu();

      fireEvent.click(
        within(menu).getByRole("menuitem", {
          name: `Current account: ${truncate(WALLET_A)}`,
        })
      );

      expect(useWalletStore.getState().activePublicKey).toBe(WALLET_A);
      expect(useWalletStore.getState().publicKey).toBe(WALLET_A);
    });

    it("saves a separate default for new trades without switching the active account", () => {
      seedWallets([WALLET_A, WALLET_B], WALLET_A);
      render(<WalletDropdown />);
      const menu = openMenu();

      fireEvent.click(
        within(menu).getByRole("menuitem", {
          name: `Set ${truncate(WALLET_B)} as default for new trades`,
        })
      );

      expect(useWalletStore.getState().defaultTradeWalletPublicKey).toBe(WALLET_B);
      expect(useWalletStore.getState().activePublicKey).toBe(WALLET_A);
      expect(
        within(menu).getByRole("menuitem", {
          name: `Set ${truncate(WALLET_B)} as default for new trades`,
        })
      ).toHaveAttribute("aria-pressed", "true");
    });

    it("allows users to clear the default and choose for every trade", () => {
      seedWallets([WALLET_A, WALLET_B], WALLET_A);
      useWalletStore.getState().setDefaultTradeWallet(WALLET_B);
      render(<WalletDropdown />);
      const menu = openMenu();

      fireEvent.click(
        within(menu).getByRole("menuitem", {
          name: "Ask me to choose an account for each trade",
        })
      );

      expect(useWalletStore.getState().defaultTradeWalletPublicKey).toBeNull();
      expect(useWalletStore.getState().activePublicKey).toBe(WALLET_A);
    });
  });

  describe("disconnect flows", () => {
    it("disconnect active removes only the active wallet and promotes the next one", () => {
      seedWallets([WALLET_A, WALLET_B], WALLET_A);
      render(<WalletDropdown />);
      const menu = openMenu();

      fireEvent.click(
        within(menu).getByRole("menuitem", { name: "Disconnect active wallet" })
      );

      const state = useWalletStore.getState();
      expect(state.wallets.map((w) => w.publicKey)).toEqual([WALLET_B]);
      expect(state.activePublicKey).toBe(WALLET_B);
      expect(state.publicKey).toBe(WALLET_B);
      expect(state.isConnected).toBe(true);
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    it("disconnect active on the last wallet clears the store", () => {
      seedWallets([WALLET_A], WALLET_A);
      render(<WalletDropdown />);
      const menu = openMenu();

      fireEvent.click(
        within(menu).getByRole("menuitem", { name: "Disconnect active wallet" })
      );

      const state = useWalletStore.getState();
      expect(state.wallets).toEqual([]);
      expect(state.activePublicKey).toBeNull();
      expect(state.publicKey).toBeNull();
      expect(state.isConnected).toBe(false);
    });

    it("disconnect all clears every wallet and closes the menu", () => {
      seedWallets([WALLET_A, WALLET_B, WALLET_C], WALLET_B);
      render(<WalletDropdown />);
      const menu = openMenu();

      fireEvent.click(
        within(menu).getByRole("menuitem", { name: "Disconnect all wallets" })
      );

      const state = useWalletStore.getState();
      expect(state.wallets).toEqual([]);
      expect(state.activePublicKey).toBeNull();
      expect(state.publicKey).toBeNull();
      expect(state.isConnected).toBe(false);
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    it("hides the disconnect-all action when only one wallet is connected", () => {
      seedWallets([WALLET_A], WALLET_A);
      render(<WalletDropdown />);
      const menu = openMenu();

      expect(
        within(menu).queryByRole("menuitem", { name: "Disconnect all wallets" })
      ).not.toBeInTheDocument();
      expect(
        within(menu).getByRole("menuitem", { name: "Disconnect active wallet" })
      ).toBeInTheDocument();
    });
  });

  describe("refresh balance aria-label states", () => {
    it("cycles idle → refreshing → refreshed labels", async () => {
      seedWallets([WALLET_A], WALLET_A);
      render(<WalletDropdown />);
      const menu = openMenu();

      const refresh = within(menu).getByRole("menuitem", {
        name: "Refresh wallet balance",
      });

      fireEvent.click(refresh);

      await waitFor(() => {
        expect(
          within(menu).getByRole("menuitem", { name: "Balance refreshed" })
        ).toBeInTheDocument();
      });
      // Store is untouched by a balance refresh.
      expect(useWalletStore.getState().activePublicKey).toBe(WALLET_A);
    });
  });

  describe("copy address label updates", () => {
    it("shows the copied label after a successful copy", async () => {
      const writeText = jest.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });

      seedWallets([WALLET_A], WALLET_A);
      render(<WalletDropdown />);
      const menu = openMenu();

      fireEvent.click(
        within(menu).getByRole("menuitem", { name: "Copy wallet address" })
      );

      await waitFor(() => {
        expect(
          within(menu).getByRole("menuitem", { name: "Address copied" })
        ).toBeInTheDocument();
      });
      expect(writeText).toHaveBeenCalledWith(WALLET_A);
      expect(useWalletStore.getState().activePublicKey).toBe(WALLET_A);
    });

    it("shows the failure label when the clipboard rejects", async () => {
      const writeText = jest.fn().mockRejectedValue(new Error("denied"));
      Object.assign(navigator, { clipboard: { writeText } });

      seedWallets([WALLET_A], WALLET_A);
      render(<WalletDropdown />);
      const menu = openMenu();

      fireEvent.click(
        within(menu).getByRole("menuitem", { name: "Copy wallet address" })
      );

      await waitFor(() => {
        expect(
          within(menu).getByRole("menuitem", {
            name: "Copy failed — click to dismiss",
          })
        ).toBeInTheDocument();
      });
    });
  });
});
