export type Recommendation = "HIGH_CONVICTION" | "MODERATE" | "MONITOR";
export type MarketRegime = "RISK_ON" | "NEUTRAL" | "RISK_OFF";
export type RiskTolerance = "LOW" | "MEDIUM" | "HIGH";

/**
 * Provenance of a pool's `apy`. "live" means it was overwritten from one of the
 * fetched protocol APIs; "static" means it is the BASE_POOLS constant baseline
 * (API unreachable, response shape unrecognized, or no matching pool). Callers
 * must not treat a "static" apy as a live figure.
 */
export type ApySource = "live" | "static";

/**
 * Provenance of a pool's smart-money figures. "live" means smartMoneyUsd /
 * smartMoneyWallets were resolved from Nansen Smart Money holdings; "static"
 * means they are the BASE_POOLS constant baseline (no key, API/auth failure, or
 * no matching token). Callers must not treat "static" as a live signal.
 */
export type SmartMoneySource = "live" | "static";

export interface Pool {
  protocol: string;
  pool: string;
  apy: number;
  apySource: ApySource;
  // USD value of this pool's constituent tokens currently held by Nansen smart
  // money. Token-level (not pool-level): pools sharing a token share this value.
  smartMoneyUsd: number;
  smartMoneySource: SmartMoneySource;
  smartMoneyWallets: number;
  riskScore: number;
  yieldScore: number;
  recommendation: Recommendation;
  tvl: number;
}

export interface ScanResult {
  scannedAt: string;
  topPools: Pool[];
  analysis: {
    topOpportunity: string;
    marketRegime: MarketRegime;
    confidence: number;
  };
  stats: {
    topApy: number;
    smartMoneyPools: number;
    totalTrackedTvl: number;
    poolsScanned: number;
    // Number of pools whose apy was resolved to a live API value (apySource
    // "live"). The rest are on the BASE_POOLS constant baseline.
    apyResolved: number;
    // Number of pools whose smart-money figures were resolved from live Nansen
    // holdings (smartMoneySource "live"). The rest are on the constant baseline.
    smartMoneyResolved: number;
  };
  liveSources: string[];
}
