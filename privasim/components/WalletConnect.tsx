"use client";

import { useState, useEffect } from "react";
import { Shield, LogOut, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { shortenAddress } from "@/lib/utils";

interface WalletState {
  address: string;
  type: "monero" | "ethereum";
  jwt: string;
}

export default function WalletConnect() {
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [step, setStep] = useState<"idle" | "input" | "signing" | "done">("idle");
  const [inputAddress, setInputAddress] = useState("");
  const [walletType, setWalletType] = useState<"monero" | "ethereum">("monero");
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("privasim_wallet");
    const jwt = localStorage.getItem("privasim_jwt");
    if (stored && jwt) {
      try {
        const parsed = JSON.parse(stored);
        setWallet({ ...parsed, jwt });
      } catch {
        localStorage.removeItem("privasim_wallet");
        localStorage.removeItem("privasim_jwt");
      }
    }
  }, []);

  const connectWithEthereum = async () => {
    if (!window.ethereum) {
      setError("No Ethereum wallet detected. Install MetaMask.");
      return;
    }

    setConnecting(true);
    setError("");

    try {
      const { ethers } = await import("ethers");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      const challengeRes = await fetch("/api/auth/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address, walletType: "ethereum" }),
      });
      const { challenge, challengeToken } = await challengeRes.json();

      const signature = await signer.signMessage(challenge);

      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          walletType: "ethereum",
          signature,
          challenge,
          challengeToken,
        }),
      });
      const { jwt, error: apiError } = await verifyRes.json();
      if (apiError) throw new Error(apiError);

      const walletData = { address, type: "ethereum" as const };
      localStorage.setItem("privasim_wallet", JSON.stringify(walletData));
      localStorage.setItem("privasim_jwt", jwt);
      setWallet({ ...walletData, jwt });
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setConnecting(false);
    }
  };

  const connectWithMonero = async (address: string) => {
    setConnecting(true);
    setError("");

    try {
      const challengeRes = await fetch("/api/auth/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address, walletType: "monero" }),
      });
      const { challenge, challengeToken } = await challengeRes.json();

      const sig = prompt(
        `Sign this message with your Monero wallet:\n\n${challenge}\n\nPaste the signature here:`
      );
      if (!sig) throw new Error("Signing cancelled");

      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          walletType: "monero",
          signature: sig,
          challenge,
          challengeToken,
        }),
      });
      const { jwt, error: apiError } = await verifyRes.json();
      if (apiError) throw new Error(apiError);

      const walletData = { address, type: "monero" as const };
      localStorage.setItem("privasim_wallet", JSON.stringify(walletData));
      localStorage.setItem("privasim_jwt", jwt);
      setWallet({ ...walletData, jwt });
      setStep("done");
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
    setStep("idle");
  };

  if (wallet) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant={wallet.type === "monero" ? "monero" : "ethereum"} className="px-3 py-1.5">
          <Shield className="h-3 w-3 mr-1" />
          {shortenAddress(wallet.address)}
        </Badge>
        <Button
          size="sm"
          variant="ghost"
          onClick={disconnect}
          className="text-gray-400 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (step === "input") {
    return (
      <div className="flex flex-col gap-3 p-4 bg-white/5 rounded-lg border border-white/10">
        <div className="flex gap-2">
          <button
            onClick={() => setWalletType("monero")}
            className={`flex-1 py-2 rounded text-sm font-medium transition-colors ${
              walletType === "monero"
                ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Monero (XMR)
          </button>
          <button
            onClick={() => setWalletType("ethereum")}
            className={`flex-1 py-2 rounded text-sm font-medium transition-colors ${
              walletType === "ethereum"
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Ethereum
          </button>
        </div>

        {walletType === "ethereum" && (
          <Button
            onClick={connectWithEthereum}
            disabled={connecting}
            variant="ethereum"
            className="w-full"
          >
            {connecting ? "Connecting..." : "Connect MetaMask"}
          </Button>
        )}

        {walletType === "monero" && (
          <>
            <input
              type="text"
              placeholder="Enter your Monero address (4...)..."
              value={inputAddress}
              onChange={(e) => setInputAddress(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-md px-3 py-2 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:border-orange-500/50"
            />
            <Button
              onClick={() => connectWithMonero(inputAddress)}
              disabled={connecting || inputAddress.length < 95}
              variant="monero"
              className="w-full"
            >
              {connecting ? "Signing..." : "Connect Monero Wallet"}
            </Button>
          </>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          onClick={() => setStep("idle")}
          className="text-xs text-gray-500 hover:text-gray-300"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <Button
      onClick={() => setStep("input")}
      variant="outline"
      className="border-white/20 text-white hover:bg-white/10"
    >
      <Shield className="h-4 w-4 mr-2" />
      Connect Wallet
      <ChevronDown className="h-4 w-4 ml-1" />
    </Button>
  );
}
