import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors, useSolanaLedgerPlugin } from "@privy-io/react-auth/solana";
import { createContext, useContext, useEffect, useState } from "react";
import { getWallets } from "@wallet-standard/app";

const appId = import.meta.env.VITE_PRIVY_APP_ID;

const solanaConnectors = toSolanaWalletConnectors({ shouldAutoConnect: false });

const privyConfig = {
  loginMethods: ["wallet"],
  appearance: {
    theme: "dark",
    accentColor: "#86efac",
    showWalletLoginFirst: true,
    walletChainType: "solana-only",
    walletList: [
      "phantom",
      "solflare",
      "backpack",
      "detected_solana_wallets",
      "wallet_connect_qr_solana",
    ],
  },
  externalWallets: {
    solana: { connectors: solanaConnectors },
  },
  embeddedWallets: {
    ethereum: { createOnLogin: "off" },
    solana: { createOnLogin: "off" },
  },
};

const SOLANA = "solana:";

function isSolanaWallet(wallet) {
  return wallet.chains?.some((chain) => chain.startsWith(SOLANA));
}

function solanaAccount(accounts) {
  return (
    accounts?.find((account) => account.chains?.some((chain) => chain.startsWith(SOLANA))) ||
    accounts?.[0]
  );
}

function shorten(address) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

const WalletContext = createContext(null);

function SolanaLogin() {
  useSolanaLedgerPlugin();
  return null;
}

export function WalletProvider({ children }) {
  if (!appId) return <DirectWalletProvider>{children}</DirectWalletProvider>;
  return (
    <PrivyProvider appId={appId} config={privyConfig}>
      <SolanaLogin />
      <DirectWalletProvider>{children}</DirectWalletProvider>
    </PrivyProvider>
  );
}

function DirectWalletProvider({ children }) {
  const [wallets, setWallets] = useState([]);
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState("");
  const [account, setAccount] = useState(null);
  const [active, setActive] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    const api = getWallets();
    const sync = () => setWallets(api.get().filter(isSolanaWallet));
    sync();
    const stopRegister = api.on("register", sync);
    const stopUnregister = api.on("unregister", sync);
    return () => {
      stopRegister();
      stopUnregister();
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!event.target.closest(".wallet-wrap")) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  async function connect(wallet) {
    const connectFeature = wallet.features["standard:connect"];
    if (!connectFeature) return;
    setBusy(true);
    setNote("");
    try {
      const result = await connectFeature.connect();
      const account = solanaAccount(result.accounts);
      if (!account?.address) {
        setNote("That wallet did not return a Solana address.");
        setOpen(true);
        return;
      }
      setAddress(account.address);
      setAccount(account);
      setActive(wallet);
      setOpen(false);
    } catch {
      setNote("The wallet did not connect.");
      setOpen(true);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    try {
      await active?.features["standard:disconnect"]?.disconnect();
    } catch {
      // The address is cleared either way.
    }
    setAddress("");
    setAccount(null);
    setActive(null);
  }

  return (
    <WalletContext.Provider
      value={{
        address,
        account,
        wallet: active,
        wallets,
        open,
        setOpen,
        busy,
        note,
        setNote,
        connect,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const wallet = useContext(WalletContext);
  if (!wallet) throw new Error("Connect wallet is outside WalletProvider.");
  return wallet;
}

export function ConnectWallet() {
  const { address, wallets, open, setOpen, busy, note, setNote, connect, disconnect, login, ready } = useWallet();

  if (login) {
    if (address) {
      return (
        <button type="button" className="wallet on" title="Disconnect" onClick={disconnect}>
          {shorten(address)}
        </button>
      );
    }
    return (
      <button type="button" className="wallet" disabled={busy || ready === false} onClick={login}>
        Connect wallet
      </button>
    );
  }

  if (address) {
    return (
      <button type="button" className="wallet on" title="Disconnect" onClick={disconnect}>
        {shorten(address)}
      </button>
    );
  }

  return (
    <div className="wallet-wrap">
      <button
        type="button"
        className="wallet"
        aria-expanded={open}
        disabled={busy}
        onClick={() => {
          setNote("");
          if (wallets.length === 1) connect(wallets[0]);
          else setOpen((value) => !value);
        }}
      >
        Connect wallet
      </button>
      {open && (
        <div className="wallet-menu" role="menu">
          {wallets.map((wallet) => (
            <button key={wallet.name} type="button" role="menuitem" onClick={() => connect(wallet)}>
              {wallet.name}
            </button>
          ))}
          {!wallets.length && (
            <a href="https://phantom.app/" target="_blank" rel="noreferrer">
              Install Phantom
            </a>
          )}
          {note && <p>{note}</p>}
        </div>
      )}
    </div>
  );
}
