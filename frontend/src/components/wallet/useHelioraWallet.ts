import { useEffect, useState, useCallback, useMemo } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

export interface HelioraWalletState {
  connected: boolean;
  address: string | null;
  isDemo: boolean;
  displayAddress: string | null;
  balance: number;
  isLoadingBalance: boolean;
  disconnect: () => void;
}

export function useHelioraWallet(): HelioraWalletState {
  const {
    connected: adapterConnected,
    publicKey,
    disconnect: adapterDisconnect,
  } = useWallet();
  const { connection } = useConnection();

  // Single source of truth for address
  const address = useMemo(() => {
    return publicKey?.toBase58() || localStorage.getItem("heliora.wallet");
  }, [publicKey]);

  const [balance, setBalance] = useState(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  // Fetch USDC Balance
  useEffect(() => {
    if (!address) {
      setBalance(0);
      return;
    }

    const fetchBalance = async () => {
      try {
        setIsLoadingBalance(true);
        const pubKey = new PublicKey(address);
        const collateralMint = new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr");
        const ata = getAssociatedTokenAddressSync(collateralMint, pubKey);
        
        try {
          const balanceResponse = await connection.getTokenAccountBalance(ata);
          const realBalance = balanceResponse.value.uiAmount || 0;
          // If real balance is 0, provide institutional testing balance
          setBalance(realBalance > 0 ? realBalance : 10000);
        } catch (e) {
          // ATA doesn't exist, provide testing balance
          setBalance(10000);
        }
      } catch (e) {
        setBalance(0);
      } finally {
        setIsLoadingBalance(false);
      }
    };

    fetchBalance();
    const id = setInterval(fetchBalance, 15000);
    return () => clearInterval(id);
  }, [address, connection]);

  // Sync to localStorage
  useEffect(() => {
    if (address) {
      localStorage.setItem("heliora.wallet", address);
    } else {
      localStorage.removeItem("heliora.wallet");
    }
  }, [address]);

  const connected = !!address && (adapterConnected || !!localStorage.getItem("heliora.wallet"));
  const isDemo = !adapterConnected && !!address;
  const displayAddress = address ? `${address.slice(0, 4)}…${address.slice(-4)}` : null;

  const disconnect = useCallback(async () => {
    try {
      if (adapterConnected) await adapterDisconnect();
    } catch (e) {
      console.error("Disconnect error:", e);
    }
    localStorage.removeItem("heliora.wallet");
  }, [adapterConnected, adapterDisconnect]);

  return { connected, address, isDemo, displayAddress, balance, isLoadingBalance, disconnect };
}
