"use client";

import { useEffect, useState } from "react";
import { Shield, LogOut, ChevronDown, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { shortenAddress } from "@/lib/utils";

interface WalletState {
  address: string;
  type: "ethereum";
}

interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

interface DiscoveredWallet {
  name: string;
  icon: string;
  provider: Eip1193Provider;
}

function asMessageHex(message: string): string {
  return `0x${Array.from(new TextEncoder().encode(message), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export default function WalletConnect() {
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [open, setOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [discovered, setDiscovered] = useState<DiscoveredWallet[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("privasim_wallet");
    if (stored && localStorage.getItem("privasim_wallet_auth_version") !== "2") {
      localStorage.removeItem("privasim_wallet");
      localStorage.removeItem("privasim_jwt");
    }
    if (stored && localStorage.getItem("privasim_wallet_auth_version") === "2") {
      try {
        const parsed = JSON.parse(stored) as WalletState;
        if (parsed.type === "ethereum" && /^0x[a-fA-F0-9]{40}$/.test(parsed.address)) {
          setWallet(parsed);
        } else {
          localStorage.removeItem("privasim_wallet");
          localStorage.removeItem("privasim_jwt");
        }
      } catch {
        localStorage.removeItem("privasim_wallet");
        localStorage.removeItem("privasim_jwt");
      }
    }
  }, []);

  useEffect(() => {
    const providers = new Map<string, DiscoveredWallet>();
    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        info?: { name?: string; icon?: string; uuid?: string };
        provider?: Eip1193Provider;
      };
      if (!detail.info?.name || !detail.provider) return;
      const id = detail.info.uuid ?? detail.info.name;
      if (!providers.has(id)) {
        providers.set(id, {
          name: detail.info.name,
          icon: detail.info.icon ?? "",
          provider: detail.provider,
        });
        setDiscovered([...providers.values()]);
      }
    };
    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return () => window.removeEventListener("eip6963:announceProvider", onAnnounce);
  }, [open]);

  const connect = async (provider?: Eip1193Provider) => {
    setConnecting(true);
    setError("");
    try {
      const selected = provider ?? window.ethereum;
      if (!selected) throw new Error("Install or unlock an Ethereum browser wallet first.");

      const accounts = await selected.request({ method: "eth_requestAccounts" }) as string[];
      const address = accounts?.[0];
      if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
        throw new Error("The wallet did not return a valid Ethereum address.");
      }

      const challengeResponse = await fetch("/api/auth/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address, walletType: "ethereum" }),
      });
      const challengeData = await challengeResponse.json();
      if (!challengeResponse.ok) throw new Error(challengeData.error ?? "Could not start wallet verification.");

      const signature = await selected.request({
        method: "personal_sign",
        params: [asMessageHex(challengeData.challenge), address],
      }) as string;

      const verifyResponse = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          walletType: "ethereum",
          signature,
          challenge: challengeData.challenge,
          challengeToken: challengeData.challengeToken,
        }),
      });
      const verifyData = await verifyResponse.json();
      if (!verifyResponse.ok) throw new Error(verifyData.error ?? "Wallet signature verification failed.");

      const walletData: WalletState = { address, type: "ethereum" };
      localStorage.setItem("privasim_wallet", JSON.stringify(walletData));
      localStorage.setItem("privasim_jwt", verifyData.jwt);
      localStorage.setItem("privasim_wallet_auth_version", "2");
      setWallet(walletData);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet connection failed.");
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = () => {
    localStorage.removeItem("privasim_wallet");
    localStorage.removeItem("privasim_jwt");
    localStorage.removeItem("privasim_wallet_auth_version");
    setWallet(null);
  };

  if (wallet) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="ethereum" className="px-3 py-1.5">
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
        <p className="text-sm font-semibold text-white">Verify Ethereum wallet ownership</p>
        <p className="text-xs text-gray-400">
          Your wallet will ask you to sign a one-time message. This is not a transaction. Connecting is optional for checkout.
        </p>

        {discovered.length > 0 ? (
          <div className="space-y-2">
            {discovered.map((item) => (
              <Button
                key={item.name}
                onClick={() => connect(item.provider)}
                disabled={connecting}
                className="w-full bg-[#627eea] hover:bg-[#4f6acc] text-white justify-start"
              >
                {item.icon ? (
                  // Wallet logos are provider-supplied data URLs; the image is never interpreted as markup.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.icon} alt="" className="h-4 w-4 mr-2 rounded" />
                ) : <Wallet className="h-4 w-4 mr-2" />}
                {connecting ? "Verifying…" : `Connect ${item.name}`}
              </Button>
            ))}
          </div>
        ) : (
          <Button
            onClick={() => connect()}
            disabled={connecting || typeof window.ethereum === "undefined"}
            className="w-full bg-[#627eea] hover:bg-[#4f6acc] text-white"
          >
            <Wallet className="h-4 w-4 mr-2" />
            {connecting ? "Verifying…" : "Connect Browser Wallet"}
          </Button>
        )}

        {typeof window.ethereum === "undefined" && discovered.length === 0 && (
          <p className="text-xs text-yellow-300">No Ethereum wallet extension was detected.</p>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button onClick={() => setOpen(false)} className="text-xs text-gray-500 hover:text-gray-300 mt-1">
          Cancel — checkout does not require a wallet account
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
