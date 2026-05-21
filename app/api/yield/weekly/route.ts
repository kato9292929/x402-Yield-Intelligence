import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "x402-next";
import { buildWeeklyReport } from "@/lib/intelligence";
import { FACILITATOR, PAY_TO } from "@/lib/x402";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const handler = async (_request: NextRequest): Promise<NextResponse> => {
  const report = await buildWeeklyReport();
  return NextResponse.json(report);
};

export const GET = withX402(
  handler,
  PAY_TO,
  {
    price: "$2.00",
    network: "base",
    config: { description: "Weekly Solana DeFi Yield Intelligence Report" },
  },
  FACILITATOR,
);
