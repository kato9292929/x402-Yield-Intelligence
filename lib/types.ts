export type Recommendation = "HIGH_CONVICTION" | "MODERATE" | "MONITOR";
export type MarketRegime = "RISK_ON" | "NEUTRAL" | "RISK_OFF";
export type RiskTolerance = "LOW" | "MEDIUM" | "HIGH";

export interface Pool {
  protocol: string;
  pool: string;
  apy: number;
  smartMoneyInflow7d: number;
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
  };
  liveSources: string[];
}
