import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "x402-next";
import { buildScan } from "@/lib/intelligence";
import { FACILITATOR, PAY_TO } from "@/lib/x402";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const handler = async (_request: NextRequest): Promise<NextResponse> => {
  const scan = await buildScan();
  return NextResponse.json(scan);
};

export const GET = withX402(
  handler,
  PAY_TO,
  {
    price: "$0.20",
    network: "base",
    config: { description: "Solana DeFi Yield Intelligence Scan" },
  },
  FACILITATOR,
);
