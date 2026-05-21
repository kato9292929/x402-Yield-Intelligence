import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "x402-next";
import { analyzePortfolio } from "@/lib/intelligence";
import type { RiskTolerance } from "@/lib/types";
import { FACILITATOR, PAY_TO } from "@/lib/x402";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RISK_VALUES: RiskTolerance[] = ["LOW", "MEDIUM", "HIGH"];

const handler = async (request: NextRequest): Promise<NextResponse> => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { walletAddress, riskTolerance } = (body ?? {}) as {
    walletAddress?: unknown;
    riskTolerance?: unknown;
  };

  if (typeof walletAddress !== "string" || walletAddress.trim().length < 8) {
    return NextResponse.json(
      { error: "Body must include a valid 'walletAddress' string." },
      { status: 400 },
    );
  }

  if (
    typeof riskTolerance !== "string" ||
    !RISK_VALUES.includes(riskTolerance as RiskTolerance)
  ) {
    return NextResponse.json(
      { error: "Body must include 'riskTolerance' of LOW, MEDIUM, or HIGH." },
      { status: 400 },
    );
  }

  const result = await analyzePortfolio(
    walletAddress.trim(),
    riskTolerance as RiskTolerance,
  );
  return NextResponse.json(result);
};

export const POST = withX402(
  handler,
  PAY_TO,
  {
    price: "$0.50",
    network: "base",
    config: { description: "Solana DeFi Portfolio Rebalancing Analysis" },
  },
  FACILITATOR,
);
