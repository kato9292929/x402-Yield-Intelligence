import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { buildWeeklyReport } from "@/lib/intelligence";
import { BASE_NETWORK, PAY_TO, x402Server } from "@/lib/x402";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const handler = async (_request: NextRequest): Promise<NextResponse> => {
  const report = await buildWeeklyReport();
  return NextResponse.json(report);
};

export const GET = withX402(
  handler,
  {
    accepts: {
      scheme: "exact",
      payTo: PAY_TO,
      price: "$2.00",
      network: BASE_NETWORK,
    },
    description: "Weekly Solana DeFi Yield Intelligence Report",
  },
  x402Server,
);
