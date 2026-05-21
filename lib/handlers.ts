import { analyzePool, analyzePortfolio } from "./intelligence";
import type { RiskTolerance } from "./types";

const RISK_VALUES: RiskTolerance[] = ["LOW", "MEDIUM", "HIGH"];

export type ResolveResult =
  | { ok: true; data: unknown }
  | { ok: false; status: number; error: string };

/** Validates a pool-analysis request body and runs the analysis. */
export async function resolvePool(body: unknown): Promise<ResolveResult> {
  const { protocol, pool } = (body ?? {}) as {
    protocol?: unknown;
    pool?: unknown;
  };
  if (
    typeof protocol !== "string" ||
    typeof pool !== "string" ||
    !protocol.trim() ||
    !pool.trim()
  ) {
    return {
      ok: false,
      status: 400,
      error: "Body must include non-empty 'protocol' and 'pool' strings.",
    };
  }
  return { ok: true, data: await analyzePool(protocol, pool) };
}

/** Validates a portfolio-analysis request body and runs the analysis. */
export async function resolvePortfolio(body: unknown): Promise<ResolveResult> {
  const { walletAddress, riskTolerance } = (body ?? {}) as {
    walletAddress?: unknown;
    riskTolerance?: unknown;
  };
  if (typeof walletAddress !== "string" || walletAddress.trim().length < 8) {
    return {
      ok: false,
      status: 400,
      error: "Body must include a valid 'walletAddress' string.",
    };
  }
  if (
    typeof riskTolerance !== "string" ||
    !RISK_VALUES.includes(riskTolerance as RiskTolerance)
  ) {
    return {
      ok: false,
      status: 400,
      error: "Body must include 'riskTolerance' of LOW, MEDIUM, or HIGH.",
    };
  }
  return {
    ok: true,
    data: await analyzePortfolio(
      walletAddress.trim(),
      riskTolerance as RiskTolerance,
    ),
  };
}
