import type { ApySource, Pool, Recommendation } from "./types";

interface BasePool {
  protocol: string;
  pool: string;
  apy: number;
  smartMoneyInflow7d: number;
  smartMoneyWallets: number;
  riskScore: number;
  tvl: number;
}

/** A BasePool after the APY overlay has tagged where its apy came from. */
type EnrichedPool = BasePool & { apySource: ApySource };

/**
 * Curated baseline of liquid Solana DeFi pools across the five tracked
 * protocols. Live API responses enrich these numbers when reachable; the
 * baseline guarantees the product stays functional without external keys.
 */
const BASE_POOLS: BasePool[] = [
  { protocol: "Kamino", pool: "USDC-SOL", apy: 0.124, smartMoneyInflow7d: 2_400_000, smartMoneyWallets: 18, riskScore: 0.3, tvl: 41_200_000 },
  { protocol: "Kamino", pool: "USDC Lend", apy: 0.091, smartMoneyInflow7d: 3_100_000, smartMoneyWallets: 22, riskScore: 0.12, tvl: 130_400_000 },
  { protocol: "Kamino", pool: "JitoSOL-SOL", apy: 0.078, smartMoneyInflow7d: 1_350_000, smartMoneyWallets: 12, riskScore: 0.18, tvl: 88_500_000 },
  { protocol: "Kamino", pool: "PYUSD-USDC", apy: 0.143, smartMoneyInflow7d: 640_000, smartMoneyWallets: 6, riskScore: 0.34, tvl: 9_800_000 },
  { protocol: "Drift", pool: "JLP Delta-Neutral", apy: 0.187, smartMoneyInflow7d: 2_750_000, smartMoneyWallets: 16, riskScore: 0.48, tvl: 31_900_000 },
  { protocol: "Drift", pool: "SOL-PERP MM Vault", apy: 0.213, smartMoneyInflow7d: 1_900_000, smartMoneyWallets: 14, riskScore: 0.62, tvl: 22_700_000 },
  { protocol: "Drift", pool: "USDC Insurance Fund", apy: 0.066, smartMoneyInflow7d: 480_000, smartMoneyWallets: 7, riskScore: 0.22, tvl: 54_300_000 },
  { protocol: "Jupiter Lend", pool: "USDC", apy: 0.102, smartMoneyInflow7d: 4_200_000, smartMoneyWallets: 27, riskScore: 0.14, tvl: 96_100_000 },
  { protocol: "Jupiter Lend", pool: "USDT", apy: 0.097, smartMoneyInflow7d: 1_120_000, smartMoneyWallets: 11, riskScore: 0.16, tvl: 38_400_000 },
  { protocol: "Jupiter Lend", pool: "SOL", apy: 0.054, smartMoneyInflow7d: 910_000, smartMoneyWallets: 9, riskScore: 0.2, tvl: 47_600_000 },
  { protocol: "Marinade", pool: "mSOL Native Stake", apy: 0.072, smartMoneyInflow7d: 1_640_000, smartMoneyWallets: 13, riskScore: 0.1, tvl: 1_180_000_000 },
  { protocol: "Marinade", pool: "mSOL-SOL LP", apy: 0.069, smartMoneyInflow7d: 520_000, smartMoneyWallets: 5, riskScore: 0.15, tvl: 28_900_000 },
  { protocol: "Jito", pool: "JitoSOL Stake", apy: 0.081, smartMoneyInflow7d: 3_480_000, smartMoneyWallets: 24, riskScore: 0.09, tvl: 1_640_000_000 },
  { protocol: "Jito", pool: "JitoSOL-USDC LP", apy: 0.116, smartMoneyInflow7d: 1_280_000, smartMoneyWallets: 10, riskScore: 0.27, tvl: 17_500_000 },
];

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function round(n: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

function scorePool(b: EnrichedPool): Pool {
  const apyNorm = clamp(b.apy / 0.22, 0, 1);
  const inflowNorm = clamp(b.smartMoneyInflow7d / 4_500_000, 0, 1);
  const walletNorm = clamp(b.smartMoneyWallets / 28, 0, 1);
  const raw = 0.38 * inflowNorm + 0.24 * walletNorm + 0.38 * apyNorm;
  const yieldScore = round(clamp(raw - b.riskScore * 0.12, 0, 1));

  let recommendation: Recommendation = "MONITOR";
  if (yieldScore >= 0.62 && b.smartMoneyWallets >= 14) {
    recommendation = "HIGH_CONVICTION";
  } else if (yieldScore >= 0.34) {
    recommendation = "MODERATE";
  }

  return {
    protocol: b.protocol,
    pool: b.pool,
    apy: b.apy,
    apySource: b.apySource,
    smartMoneyInflow7d: b.smartMoneyInflow7d,
    smartMoneyWallets: b.smartMoneyWallets,
    riskScore: b.riskScore,
    yieldScore,
    recommendation,
    tvl: b.tvl,
  };
}

const SOURCE_TIMEOUT_MS = 6000;

async function safeJson(url: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Best-effort overlay of Nansen smart-money positions onto the baseline.
 * Any unexpected payload shape is ignored so the scan never fails.
 */
function overlaySmartMoney(pools: BasePool[], nansen: unknown): BasePool[] {
  if (!nansen || typeof nansen !== "object") return pools;
  const rows = Array.isArray(nansen)
    ? nansen
    : Array.isArray((nansen as { positions?: unknown }).positions)
      ? ((nansen as { positions: unknown[] }).positions)
      : null;
  if (!rows) return pools;

  const byProtocol = new Map<string, { inflow: number; wallets: number }>();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const protocol = typeof r.protocol === "string" ? r.protocol : null;
    if (!protocol) continue;
    const inflow = typeof r.netInflowUsd === "number" ? r.netInflowUsd : 0;
    const wallets = typeof r.walletCount === "number" ? r.walletCount : 0;
    const prev = byProtocol.get(protocol.toLowerCase()) ?? { inflow: 0, wallets: 0 };
    byProtocol.set(protocol.toLowerCase(), {
      inflow: prev.inflow + inflow,
      wallets: Math.max(prev.wallets, wallets),
    });
  }
  if (byProtocol.size === 0) return pools;

  return pools.map((p) => {
    const hit = byProtocol.get(p.protocol.toLowerCase());
    if (!hit) return p;
    return {
      ...p,
      smartMoneyInflow7d: hit.inflow > 0 ? Math.round(hit.inflow) : p.smartMoneyInflow7d,
      smartMoneyWallets: hit.wallets > 0 ? hit.wallets : p.smartMoneyWallets,
    };
  });
}

/** Normalized APY contribution from one protocol API, ready to overlay. */
interface ApyRow {
  protocol: string;
  pool: string;
  apy: number; // decimal fraction, e.g. 0.124 == 12.4%
}

/**
 * Normalizes an APY-like number into a decimal fraction (0.124 == 12.4%).
 * Kamino/Drift may express APY as a percentage or a fraction; this environment
 * cannot confirm which, because egress to those hosts is policy-blocked, so the
 * unit is inferred: values above 1.5 are treated as percentages. Anything
 * outside a sane band is rejected, so a wrong-unit value can never masquerade as
 * a live apy. TODO: confirm the unit against a real response and drop the
 * heuristic.
 */
function normalizeApy(n: unknown): number | null {
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return null;
  const frac = n > 1.5 ? n / 100 : n;
  if (frac <= 0 || frac > 3) return null;
  return frac;
}

function firstApy(o: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const apy = normalizeApy(o[k]);
    if (apy !== null) return apy;
  }
  return null;
}

function poolTokens(label: string): string[] {
  return label.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/** True when every token of the baseline pool label appears in the API label. */
function poolLabelMatches(baseLabel: string, apiLabel: string): boolean {
  const base = poolTokens(baseLabel);
  if (base.length === 0) return false;
  const api = new Set(poolTokens(apiLabel));
  return base.every((t) => api.has(t));
}

/**
 * Adapts the Kamino /strategies response into normalized APY rows.
 *
 * ASSUMED CONTRACT — UNVERIFIED. api.kamino.finance is blocked by this session's
 * egress policy (CONNECT 403), so the field names below could not be checked
 * against a live response. The reader is fully type-guarded: if the assumed
 * fields are absent, it yields no rows and every pool stays apySource "static",
 * so a wrong guess can never produce a false "live".
 * TODO: verify against a real Kamino response, then tighten the field list.
 *   - APY field candidates: apy, totalApy, apr, kaminoApy, apy7d, apy24h
 *   - token labels: tokenASymbol/tokenBSymbol, tokenA/tokenB, or a name string
 */
function adaptKamino(raw: unknown): ApyRow[] {
  const list = Array.isArray(raw)
    ? raw
    : raw &&
        typeof raw === "object" &&
        Array.isArray((raw as { strategies?: unknown }).strategies)
      ? (raw as { strategies: unknown[] }).strategies
      : null;
  if (!list) return [];

  const rows: ApyRow[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const apy = firstApy(o, ["apy", "totalApy", "apr", "kaminoApy", "apy7d", "apy24h"]);
    if (apy === null) continue;
    const label = kaminoLabel(o);
    if (!label) continue;
    rows.push({ protocol: "Kamino", pool: label, apy });
  }
  return rows;
}

function kaminoLabel(o: Record<string, unknown>): string | null {
  const str = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : "");
  const pair = [str("tokenASymbol") || str("tokenA"), str("tokenBSymbol") || str("tokenB")]
    .filter(Boolean)
    .join("-");
  if (pair) return pair;
  return str("name") || str("pool") || str("strategy") || null;
}

/**
 * Drift /stats is a protocol-wide stats endpoint; whether it exposes per-pool
 * APY for the vault pools tracked here (JLP Delta-Neutral, SOL-PERP MM Vault,
 * USDC Insurance Fund) could not be confirmed — the host is egress-blocked.
 * Deferred: returns no rows. TODO: inspect a live /stats response and map it.
 */
function adaptDrift(_raw: unknown): ApyRow[] {
  return [];
}

/**
 * The Jupiter endpoint currently fetched (price.jup.ag/v6/price) returns spot
 * token prices, not pool APY, so it cannot supply yield data. Jupiter Lend APY
 * would require a different endpoint, which is out of scope for this task (no
 * new data sources). Deferred: returns no rows.
 */
function adaptJupiter(_raw: unknown): ApyRow[] {
  return [];
}

/**
 * Overlays real APY from the already-fetched protocol APIs onto the baseline,
 * mirroring overlaySmartMoney. A pool that resolves to a live APY is tagged
 * apySource "live"; every other pool keeps its BASE_POOLS constant and is tagged
 * "static", so a fixed sample can never be mistaken for a live figure. Matching
 * uses protocol AND pool label (not protocol alone) to avoid collapsing distinct
 * pools onto a single value.
 */
function overlayApy(
  pools: BasePool[],
  sources: { kamino: unknown; drift: unknown; jupiter: unknown },
): EnrichedPool[] {
  const rows = [
    ...adaptKamino(sources.kamino),
    ...adaptDrift(sources.drift),
    ...adaptJupiter(sources.jupiter),
  ];

  const resolved: string[] = [];
  const enriched = pools.map((p): EnrichedPool => {
    const hit = rows.find(
      (r) =>
        r.protocol.toLowerCase() === p.protocol.toLowerCase() &&
        poolLabelMatches(p.pool, r.pool),
    );
    if (!hit) return { ...p, apySource: "static" };
    resolved.push(`${p.protocol} ${p.pool}`);
    return { ...p, apy: hit.apy, apySource: "live" };
  });

  // Make a silent all-static fallback visible: log which pools resolved live.
  console.info(
    `[overlayApy] live=${resolved.length}/${pools.length} ` +
      (resolved.length ? `resolved=[${resolved.join(", ")}]` : "resolved=none"),
  );
  return enriched;
}

export interface ScoredData {
  pools: Pool[];
  liveSources: string[];
  // Count of pools whose apy was resolved to a live API value this scan.
  apyResolved: number;
}

/**
 * Fetches all data sources in parallel, enriches the baseline, and returns
 * fully scored pools sorted by yield score (best first).
 */
export async function getScoredPools(): Promise<ScoredData> {
  const nansenKey = process.env.NANSEN_API_KEY;

  const [nansen, kamino, drift, jupiter] = await Promise.all([
    nansenKey
      ? safeJson("https://api.nansen.ai/defi/smart-money/positions?chain=solana", {
          headers: { "x-api-key": nansenKey },
        })
      : Promise.resolve(null),
    safeJson("https://api.kamino.finance/strategies?status=LIVE&sortBy=apyAsc"),
    safeJson("https://mainnet-beta.api.drift.trade/stats"),
    safeJson("https://price.jup.ag/v6/price?ids=USDC,SOL,mSOL,JitoSOL"),
  ]);

  const liveSources: string[] = [];
  if (nansen) liveSources.push("Nansen");
  if (kamino) liveSources.push("Kamino");
  if (drift) liveSources.push("Drift");
  if (jupiter) liveSources.push("Jupiter");

  const withSmartMoney = overlaySmartMoney(BASE_POOLS, nansen);
  const enriched = overlayApy(withSmartMoney, { kamino, drift, jupiter });
  const pools = enriched
    .map(scorePool)
    .sort((a, b) => b.yieldScore - a.yieldScore);

  const apyResolved = pools.filter((p) => p.apySource === "live").length;
  return { pools, liveSources, apyResolved };
}

export { round, clamp };
