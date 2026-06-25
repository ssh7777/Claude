"use client";

import { useState, useEffect } from "react";
import { Shield, LogOut, ChevronDown, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { shortenAddress } from "@/lib/utils";

interface WalletState {
  address: string;
  type: "monero" | "ethereum";
}

export default function WalletConnect() {
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [open, setOpen] = useState(false);
  const [walletType, setWalletType] = useState<"monero" | "ethereum">("ethereum");
  const [address, setAddress] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("privasim_wallet");
    if (stored) {
      try { setWallet(JSON.parse(stored)); } catch { localStorage.removeItem("privasim_wallet"); }
    }
  }, []);

  const connect = async () => {
    setConnecting(true);
    setError("");
    try {
      let addr = address.trim();

      // Auto-detect MetaMask if Ethereum selected and no address typed
      if (walletType === "ethereum" && !addr && typeof window !== "undefined" && window.ethereum) {
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }) as string[];
        addr = accounts[0];
        setAddress(addr);
      }

      if (!addr) {
        setError("Enter your wallet address.");
        setConnecting(false);
        return;
      }

      const res = await fetch("/api/auth/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: addr, walletType }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Connection failed"); setConnecting(false); return; }

      const walletData: WalletState = { address: addr, type: walletType };
      localStorage.setItem("privasim_wallet", JSON.stringify(walletData));
      localStorage.setItem("privasim_jwt", data.jwt);
      setWallet(walletData);
      setOpen(false);
      setAddress("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = () => {
    localStorage.removeItem("privasim_wallet");
    localStorage.removeItem("privasim_jwt");
    setWallet(null);
  };

  if (wallet) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant={wallet.type === "monero" ? "monero" : "ethereum"} className="px-3 py-1.5">
          <Shield className="h-3 w-3 mr-1" />
          {shortenAddress(wallet.address)}
        </Badge>
        <Button size="sm" variant="ghost" onClick={disconnect} className="text-gray-400 hover:text-white">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (open) {
    return (
      <div className="flex flex-col gap-3 p-4 bg-[#1a1a2e] border border-white/15 rounded-xl shadow-xl min-w-[280px]">
        <p className="text-sm font-semibold text-white">Connect Wallet</p>

        <div className="flex gap-2">
          {(["ethereum", "monero"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setWalletType(t); setAddress(""); setError(""); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                walletType === t
                  ? t === "ethereum" ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    : "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                  : "text-gray-400 hover:text-white border border-transparent"
              }`}
            >
              {t === "ethereum" ? "Ethereum" : "Monero"}
            </button>
          ))}
        </div>

        {walletType === "ethereum" && typeof window !== "undefined" && window.ethereum && (
          <Button
            onClick={() => connect()}
            disabled={connecting}
            className="w-full bg-[#627eea] hover:bg-[#4f6acc] text-white"
          >
            <Wallet className="h-4 w-4 mr-2" />
            {connecting ? "Connecting..." : "Connect MetaMask"}
          </Button>
        )}

        <div className="relative">
          {walletType === "ethereum" && typeof window !== "undefined" && window.ethereum && (
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-xs text-gray-500">or paste address</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>
          )}
          <input
            type="text"
            placeholder={walletType === "ethereum" ? "0x... Ethereum address" : "4... Monero address"}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#ff6600]/50"
          />
        </div>

        {!(walletType === "ethereum" && typeof window !== "undefined" && window.ethereum) && (
          <Button
            onClick={() => connect()}
            disabled={connecting || address.length < 10}
            className={`w-full ${walletType === "monero" ? "bg-[#ff6600] hover:bg-[#e55c00]" : "bg-[#627eea] hover:bg-[#4f6acc]"} text-white`}
          >
            {connecting ? "Connecting..." : "Connect"}
          </Button>
        )}

        {address.length >= 10 && (
          <Button
            onClick={() => connect()}
            disabled={connecting}
            variant="outline"
            className="w-full border-white/20 text-white hover:bg-white/10 text-sm"
          >
            {connecting ? "Connecting..." : "Connect with address"}
          </Button>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}
        <button onClick={() => setOpen(false)} className="text-xs text-gray-500 hover:text-gray-300 mt-1">
          Cancel — I&apos;ll pay anonymously
        </button>
      </div>
    );
  }

  return (
    <Button
      onClick={() => setOpen(true)}
      variant="outline"
      className="border-white/20 text-white hover:bg-white/10"
    >
      <Shield className="h-4 w-4 mr-2" />
      Connect Wallet
      <ChevronDown className="h-4 w-4 ml-1" />
    </Button>
  );
}
