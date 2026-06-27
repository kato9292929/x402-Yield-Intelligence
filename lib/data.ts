import type { ApySource, Pool, Recommendation, SmartMoneySource } from "./types";

interface BasePool {
  protocol: string;
  pool: string;
  apy: number;
  // Baseline smart-money USD holdings (constant fallback). Overwritten with live
  // Nansen holdings when the pool's tokens resolve.
  smartMoneyUsd: number;
  smartMoneyWallets: number;
  riskScore: number;
  tvl: number;
  // Constituent token symbols of the pool, used to look up Nansen holdings
  // (which are token-level, not pool-level).
  tokens: string[];
}

/** A BasePool after the smart-money overlay has tagged where its figures came from. */
type SmartMoneyTagged = BasePool & { smartMoneySource: SmartMoneySource };

/** A pool after both the smart-money and APY overlays have tagged provenance. */
type EnrichedPool = SmartMoneyTagged & { apySource: ApySource };

/**
 * Curated baseline of liquid Solana DeFi pools across the five tracked
 * protocols. Live API responses enrich these numbers when reachable; the
 * baseline guarantees the product stays functional without external keys.
 */
const BASE_POOLS: BasePool[] = [
  { protocol: "Kamino", pool: "USDC-SOL", apy: 0.124, smartMoneyUsd: 2_400_000, smartMoneyWallets: 18, riskScore: 0.3, tvl: 41_200_000, tokens: ["USDC", "SOL"] },
  { protocol: "Kamino", pool: "USDC Lend", apy: 0.091, smartMoneyUsd: 3_100_000, smartMoneyWallets: 22, riskScore: 0.12, tvl: 130_400_000, tokens: ["USDC"] },
  { protocol: "Kamino", pool: "JitoSOL-SOL", apy: 0.078, smartMoneyUsd: 1_350_000, smartMoneyWallets: 12, riskScore: 0.18, tvl: 88_500_000, tokens: ["JitoSOL", "SOL"] },
  { protocol: "Kamino", pool: "PYUSD-USDC", apy: 0.143, smartMoneyUsd: 640_000, smartMoneyWallets: 6, riskScore: 0.34, tvl: 9_800_000, tokens: ["PYUSD", "USDC"] },
  { protocol: "Drift", pool: "JLP Delta-Neutral", apy: 0.187, smartMoneyUsd: 2_750_000, smartMoneyWallets: 16, riskScore: 0.48, tvl: 31_900_000, tokens: ["JLP"] },
  { protocol: "Drift", pool: "SOL-PERP MM Vault", apy: 0.213, smartMoneyUsd: 1_900_000, smartMoneyWallets: 14, riskScore: 0.62, tvl: 22_700_000, tokens: ["SOL"] },
  { protocol: "Drift", pool: "USDC Insurance Fund", apy: 0.066, smartMoneyUsd: 480_000, smartMoneyWallets: 7, riskScore: 0.22, tvl: 54_300_000, tokens: ["USDC"] },
  { protocol: "Jupiter Lend", pool: "USDC", apy: 0.102, smartMoneyUsd: 4_200_000, smartMoneyWallets: 27, riskScore: 0.14, tvl: 96_100_000, tokens: ["USDC"] },
  { protocol: "Jupiter Lend", pool: "USDT", apy: 0.097, smartMoneyUsd: 1_120_000, smartMoneyWallets: 11, riskScore: 0.16, tvl: 38_400_000, tokens: ["USDT"] },
  { protocol: "Jupiter Lend", pool: "SOL", apy: 0.054, smartMoneyUsd: 910_000, smartMoneyWallets: 9, riskScore: 0.2, tvl: 47_600_000, tokens: ["SOL"] },
  { protocol: "Marinade", pool: "mSOL Native Stake", apy: 0.072, smartMoneyUsd: 1_640_000, smartMoneyWallets: 13, riskScore: 0.1, tvl: 1_180_000_000, tokens: ["mSOL"] },
  { protocol: "Marinade", pool: "mSOL-SOL LP", apy: 0.069, smartMoneyUsd: 520_000, smartMoneyWallets: 5, riskScore: 0.15, tvl: 28_900_000, tokens: ["mSOL", "SOL"] },
  { protocol: "Jito", pool: "JitoSOL Stake", apy: 0.081, smartMoneyUsd: 3_480_000, smartMoneyWallets: 24, riskScore: 0.09, tvl: 1_640_000_000, tokens: ["JitoSOL"] },
  { protocol: "Jito", pool: "JitoSOL-USDC LP", apy: 0.116, smartMoneyUsd: 1_280_000, smartMoneyWallets: 10, riskScore: 0.27, tvl: 17_500_000, tokens: ["JitoSOL", "USDC"] },
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
  // TODO: the divisor was tuned for the (smaller) baseline inflow constants;
  // live Nansen holdings value_usd can be far larger and may saturate this.
  // Revisit the scale once live magnitudes are observed.
  const inflowNorm = clamp(b.smartMoneyUsd / 4_500_000, 0, 1);
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
    smartMoneyUsd: b.smartMoneyUsd,
    smartMoneySource: b.smartMoneySource,
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

const NANSEN_HOLDINGS_URL = "https://api.nansen.ai/api/v1/smart-money/holdings";

/** One row of the Nansen Smart Money holdings response (fields we read). */
interface NansenHolding {
  chain?: string;
  token_symbol?: string;
  token_address?: string;
  value_usd?: number;
  holders_count?: number;
  share_of_holdings_percent?: number;
}

/**
 * Fetches Solana Smart Money holdings from Nansen, per the public OpenAPI spec:
 * POST /api/v1/smart-money/holdings with an `apiKey` header and a
 * `chains: ["solana"]` body. Returns the holdings array, or null when the key is
 * absent, the call fails, or a non-200 status comes back. Auth/billing statuses
 * (401/402/403/429) and the Nansen credit headers are logged explicitly so a
 * key/credit problem is never silently mistaken for "no smart money" or a code
 * bug. TODO: confirm the response field names against a live payload (egress to
 * api.nansen.ai is policy-blocked in CI, so this maps the documented schema).
 */
async function fetchNansenHoldings(apiKey: string): Promise<NansenHolding[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS);
  try {
    const res = await fetch(NANSEN_HOLDINGS_URL, {
      method: "POST",
      signal: controller.signal,
      cache: "no-store",
      headers: { apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        chains: ["solana"],
        filters: {
          include_smart_money_labels: ["Fund", "Smart Trader"],
          include_stablecoins: true,
          include_native_tokens: true,
        },
        order_by: [{ field: "value_usd", direction: "DESC" }],
        pagination: { page: 1, per_page: 100 },
      }),
    });

    const creditsUsed = res.headers.get("X-Nansen-Credits-Used");
    const creditsLeft = res.headers.get("X-Nansen-Credits-Remaining");
    if (creditsUsed || creditsLeft) {
      console.info(
        `[nansen] credits used=${creditsUsed ?? "?"} remaining=${creditsLeft ?? "?"}`,
      );
    }

    if (!res.ok) {
      let detail = "";
      try {
        detail = (await res.text()).slice(0, 300);
      } catch {
        /* body unavailable */
      }
      const hint =
        res.status === 401
          ? "invalid API key"
          : res.status === 402
            ? "payment required (x402/MPP)"
            : res.status === 403
              ? "subscription tier or credit limit"
              : res.status === 429
                ? "rate limited"
                : "unexpected status";
      console.warn(`[nansen] holdings HTTP ${res.status} (${hint}) detail=${detail}`);
      return null;
    }

    const json = (await res.json()) as { data?: unknown };
    if (!json || !Array.isArray(json.data)) {
      console.warn("[nansen] holdings 200 but unexpected shape (no data[] array)");
      return null;
    }
    return json.data as NansenHolding[];
  } catch (err) {
    console.warn(
      `[nansen] holdings fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Folds common symbol spelling/wrapping variants so pool tokens match Nansen. */
function normalizeSymbol(s: string): string {
  const t = s.trim().toLowerCase();
  const aliases: Record<string, string> = {
    usdbc: "usdc", // bridged USDC variant
    wsol: "sol", // wrapped SOL
  };
  return aliases[t] ?? t;
}

/** Aggregates Nansen holdings by token symbol (USD held, holder count). */
function indexHoldingsBySymbol(
  holdings: NansenHolding[],
): Map<string, { valueUsd: number; holders: number }> {
  const map = new Map<string, { valueUsd: number; holders: number }>();
  for (const h of holdings) {
    if (!h || typeof h !== "object") continue;
    const sym = typeof h.token_symbol === "string" ? normalizeSymbol(h.token_symbol) : null;
    if (!sym) continue;
    const valueUsd = typeof h.value_usd === "number" ? h.value_usd : 0;
    const holders = typeof h.holders_count === "number" ? h.holders_count : 0;
    const prev = map.get(sym) ?? { valueUsd: 0, holders: 0 };
    map.set(sym, {
      valueUsd: prev.valueUsd + valueUsd,
      holders: Math.max(prev.holders, holders),
    });
  }
  return map;
}

/**
 * Overlays Nansen Smart Money holdings onto the baseline. IMPORTANT: Nansen
 * holdings are token-level (token_symbol / value_usd), not pool- or
 * protocol-level — "which pool smart money sits in" is not available from this
 * endpoint. So each pool's figure is the smart-money USD held in that pool's
 * constituent tokens; pools sharing a token therefore share a value. That is a
 * property of the data, not a fabricated per-pool signal. Pools whose tokens do
 * not appear in the holdings keep their BASE_POOLS constant and are tagged
 * "static" so a fixed sample is never mistaken for a live figure.
 */
function overlaySmartMoney(
  pools: BasePool[],
  holdings: NansenHolding[] | null,
): { pools: SmartMoneyTagged[]; resolved: number } {
  if (!holdings || holdings.length === 0) {
    console.info("[overlaySmartMoney] live=0/" + pools.length + " (no Nansen holdings)");
    return { pools: pools.map((p) => ({ ...p, smartMoneySource: "static" })), resolved: 0 };
  }

  const bySymbol = indexHoldingsBySymbol(holdings);
  const resolvedLabels: string[] = [];
  const tagged = pools.map((p): SmartMoneyTagged => {
    let valueUsd = 0;
    let holders = 0;
    for (const sym of p.tokens) {
      const hit = bySymbol.get(normalizeSymbol(sym));
      if (!hit) continue;
      valueUsd += hit.valueUsd;
      holders = Math.max(holders, hit.holders);
    }
    if (valueUsd <= 0) return { ...p, smartMoneySource: "static" };
    resolvedLabels.push(`${p.protocol} ${p.pool}`);
    return {
      ...p,
      smartMoneyUsd: Math.round(valueUsd),
      smartMoneyWallets: holders > 0 ? holders : p.smartMoneyWallets,
      smartMoneySource: "live",
    };
  });

  console.info(
    `[overlaySmartMoney] live=${resolvedLabels.length}/${pools.length} ` +
      (resolvedLabels.length ? `resolved=[${resolvedLabels.join(", ")}]` : "resolved=none"),
  );
  return { pools: tagged, resolved: resolvedLabels.length };
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
  pools: SmartMoneyTagged[],
  sources: { kamino: unknown; drift: unknown; jupiter: unknown },
): EnrichedPool[] {
  const rows = [
    ...adaptKamino(sources.kamino),
    ...adaptDrift(sources.drift),
    ...adaptJupiter(sources.jupiter),
  ];

  const resolved: string[] = [];
  const enriched = pools.map((p): EnrichedPool => {
    const hit: ApyRow | undefined = rows.find(
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
  // Count of pools whose smart-money figures were resolved from live Nansen
  // holdings this scan.
  smartMoneyResolved: number;
}

/**
 * Fetches all data sources in parallel, enriches the baseline, and returns
 * fully scored pools sorted by yield score (best first).
 */
export async function getScoredPools(): Promise<ScoredData> {
  const nansenKey = process.env.NANSEN_API_KEY;

  const [holdings, kamino, drift, jupiter] = await Promise.all([
    nansenKey ? fetchNansenHoldings(nansenKey) : Promise.resolve(null),
    safeJson("https://api.kamino.finance/strategies?status=LIVE&sortBy=apyAsc"),
    safeJson("https://mainnet-beta.api.drift.trade/stats"),
    safeJson("https://price.jup.ag/v6/price?ids=USDC,SOL,mSOL,JitoSOL"),
  ]);

  const { pools: withSmartMoney, resolved: smartMoneyResolved } = overlaySmartMoney(
    BASE_POOLS,
    holdings,
  );
  const enriched = overlayApy(withSmartMoney, { kamino, drift, jupiter });
  const pools = enriched
    .map(scorePool)
    .sort((a, b) => b.yieldScore - a.yieldScore);

  // "Nansen" is listed only when smart money actually resolved, so liveSources
  // never implies live data that isn't there.
  const liveSources: string[] = [];
  if (smartMoneyResolved > 0) liveSources.push("Nansen");
  if (kamino) liveSources.push("Kamino");
  if (drift) liveSources.push("Drift");
  if (jupiter) liveSources.push("Jupiter");

  const apyResolved = pools.filter((p) => p.apySource === "live").length;
  return { pools, liveSources, apyResolved, smartMoneyResolved };
}

export { round, clamp };
