import ChainSelector from "@/components/ChainSelector";
import { getScoredPools } from "@/lib/data";
import type { Pool } from "@/lib/types";

export const dynamic = "force-dynamic";

const PRICING = [
  { name: "スキャン", amount: "$0.20", endpoint: "GET /api/yield/scan" },
  { name: "プール詳細", amount: "$0.30", endpoint: "POST /api/yield/pool" },
  { name: "ポートフォリオ分析", amount: "$0.50", endpoint: "POST /api/yield/portfolio" },
  { name: "週次レポート", amount: "$2.00", endpoint: "GET /api/yield/weekly" },
];

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function usd(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function badgeClass(rec: Pool["recommendation"]): string {
  if (rec === "HIGH_CONVICTION") return "high";
  if (rec === "MODERATE") return "moderate";
  return "monitor";
}

function badgeLabel(rec: Pool["recommendation"]): string {
  if (rec === "HIGH_CONVICTION") return "HIGH CONVICTION";
  if (rec === "MODERATE") return "MODERATE";
  return "MONITOR";
}

export default async function Home() {
  const { pools, liveSources } = await getScoredPools();
  const scannedAt = new Date();

  const topApy = pools.reduce((m, p) => Math.max(m, p.apy), 0);
  const smartMoneyPools = pools.filter((p) => p.smartMoneyWallets >= 5).length;
  const totalTvl = pools.reduce((s, p) => s + p.tvl, 0);
  const isLive = liveSources.length > 0;
  const cards = pools.slice(0, 9);

  return (
    <main className="page">
      <header className="header">
        <span className={`live-badge${isLive ? "" : " offline"}`}>
          <span className="live-dot" />
          {isLive ? "LIVE DATA" : "BASELINE MODE"}
        </span>
        <h1 className="title">
          YIELD <span className="accent">INTELLIGENCE</span>
        </h1>
        <p className="subtitle">
          Solana DeFiのスマートマネーが向かうプールを追跡する
        </p>
        <p className="sources">
          DATA SOURCES — Nansen Smart Money · Kamino · Drift · Jupiter ·
          Marinade · Jito
          {isLive ? ` · LIVE: ${liveSources.join(", ")}` : ""}
        </p>
      </header>

      <section className="stats">
        <div className="stat">
          <div className="stat-label">Top APY</div>
          <div className="stat-value green">{pct(topApy)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Smart Money Pools</div>
          <div className="stat-value gold">{smartMoneyPools}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Total Tracked TVL</div>
          <div className="stat-value">{usd(totalTvl)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Last Scan</div>
          <div className="stat-value">
            {scannedAt.toISOString().slice(11, 16)} UTC
          </div>
        </div>
      </section>

      <div className="section-head">
        <span className="section-title">Tracked Pools</span>
        <span className="section-note">
          利回りスコア順 · {pools.length} pools scanned
        </span>
      </div>
      <section className="pools">
        {cards.map((p) => (
          <article className="pool-card" key={`${p.protocol}-${p.pool}`}>
            <div className="pool-top">
              <div>
                <div className="pool-protocol">{p.protocol}</div>
                <div className="pool-name">{p.pool}</div>
              </div>
              <div className="pool-apy">
                <div className="pool-apy-value">{pct(p.apy)}</div>
                <div className="pool-apy-label">APY</div>
              </div>
            </div>
            <div className="pool-metrics">
              <div>
                <div className="metric-label">スマートマネー流入 (7d)</div>
                <div className="metric-value flow">
                  {usd(p.smartMoneyInflow7d)}
                </div>
              </div>
              <div>
                <div className="metric-label">対象ウォレット</div>
                <div className="metric-value">{p.smartMoneyWallets}</div>
              </div>
              <div>
                <div className="metric-label">リスクスコア</div>
                <div className="metric-value">{p.riskScore.toFixed(2)}</div>
              </div>
              <div>
                <div className="metric-label">利回りスコア</div>
                <div className="metric-value">{p.yieldScore.toFixed(2)}</div>
              </div>
            </div>
            <div className="pool-foot">
              <span className={`badge ${badgeClass(p.recommendation)}`}>
                {badgeLabel(p.recommendation)}
              </span>
              <span className="detail-link">
                詳細分析 <span className="price">→ $0.30</span>
              </span>
            </div>
          </article>
        ))}
      </section>

      <div className="section-head">
        <span className="section-title">
          Payment Networks — 決済ネットワーク
        </span>
        <span className="section-note">対応チェーンとトークンを選択</span>
      </div>
      <section className="chain-section">
        <ChainSelector />
      </section>

      <div className="section-head">
        <span className="section-title">Pricing — x402 マルチチェーン対応</span>
        <span className="section-note">支払いは1リクエスト単位</span>
      </div>
      <section className="pricing">
        {PRICING.map((item) => (
          <div className="price-card" key={item.endpoint}>
            <div className="price-name">{item.name}</div>
            <div className="price-amount">{item.amount}</div>
            <div className="price-endpoint">{item.endpoint}</div>
          </div>
        ))}
      </section>

      <footer className="footer">
        <p className="disclaimer">
          免責事項:
          本ツールは情報提供のみを目的としています。DeFiへの投資にはリスクが伴います。投資判断はご自身でお願いします。
        </p>
        <p className="footer-meta">
          x402 Yield Intelligence · Powered by Claude · Base USDC payments ·
          Last scan {scannedAt.toISOString()}
        </p>
      </footer>
    </main>
  );
}
