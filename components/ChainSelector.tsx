"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import dynamic from "next/dynamic";
import { useState } from "react";

const SolanaConnectButton = dynamic(() => import("./SolanaConnectButton"), {
  ssr: false,
});

type ChainId = "solana" | "base" | "polygon" | "bnb";

interface TokenOption {
  symbol: string;
  available: boolean;
}

interface ChainDef {
  id: ChainId;
  label: string;
  network: string;
  routeSuffix: string;
  tokens: TokenOption[];
  banner: string | null;
}

const CHAINS: ChainDef[] = [
  {
    id: "solana",
    label: "Solana",
    network: "solana-mainnet",
    routeSuffix: "/solana",
    tokens: [
      { symbol: "USDC", available: true },
      { symbol: "JPYC", available: false },
    ],
    banner: "SolanaネットワークではUSDC決済のみご利用いただけます",
  },
  {
    id: "base",
    label: "Base",
    network: "base",
    routeSuffix: "",
    tokens: [{ symbol: "USDC", available: true }],
    banner: null,
  },
  {
    id: "polygon",
    label: "Polygon",
    network: "polygon",
    routeSuffix: "/polygon",
    tokens: [
      { symbol: "USDC", available: true },
      { symbol: "JPYC", available: true },
    ],
    banner: null,
  },
  {
    id: "bnb",
    label: "BNB Chain",
    network: "eip155:56",
    routeSuffix: "/bnb",
    tokens: [{ symbol: "USDT", available: true }],
    banner: "BNB ChainではUSDT決済のみご利用いただけます",
  },
];

const ENDPOINTS = [
  { name: "スキャン", path: "/api/yield/scan", price: "$0.20" },
  { name: "プール詳細", path: "/api/yield/pool", price: "$0.30" },
  { name: "ポートフォリオ分析", path: "/api/yield/portfolio", price: "$0.50" },
  { name: "週次レポート", path: "/api/yield/weekly", price: "$2.00" },
];

export default function ChainSelector() {
  const [chainId, setChainId] = useState<ChainId>("solana");
  const [token, setToken] = useState("USDC");

  const chain = CHAINS.find((c) => c.id === chainId) ?? CHAINS[0];

  function selectChain(next: ChainDef): void {
    setChainId(next.id);
    const firstAvailable = next.tokens.find((t) => t.available);
    setToken((firstAvailable ?? next.tokens[0]).symbol);
  }

  function endpointPath(basePath: string): string {
    const path = `${basePath}${chain.routeSuffix}`;
    if (chainId === "polygon" && token === "JPYC") return `${path}?token=jpyc`;
    return path;
  }

  return (
    <div className="chain-selector">
      <div className="chain-tabs">
        {CHAINS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`chain-tab${c.id === chainId ? " active" : ""}`}
            onClick={() => selectChain(c)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="token-row">
        <span className="token-label">TOKEN</span>
        <div className="token-tabs">
          {chain.tokens.map((t) => {
            const isActive = t.symbol === token && t.available;
            return (
              <button
                key={t.symbol}
                type="button"
                disabled={!t.available}
                className={`token-tab${isActive ? " active" : ""}${
                  t.available ? "" : " disabled"
                }`}
                onClick={() => t.available && setToken(t.symbol)}
              >
                {t.symbol}
                {!t.available && " ×"}
              </button>
            );
          })}
        </div>
      </div>

      {chain.banner && <div className="chain-banner">{chain.banner}</div>}

      <div className="chain-endpoints">
        {ENDPOINTS.map((e) => (
          <div className="chain-endpoint" key={e.path}>
            <span className="ce-name">{e.name}</span>
            <code className="ce-path">{endpointPath(e.path)}</code>
            <span className="ce-meta">
              {e.price} · {token} · {chain.network}
            </span>
          </div>
        ))}
      </div>

      <div className="chain-connect">
        {chainId === "solana" ? <SolanaConnectButton /> : <ConnectButton />}
      </div>
    </div>
  );
}
