import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { buildScan } from "@/lib/intelligence";
import { BASE_NETWORK, PAY_TO, x402Server } from "@/lib/x402";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const handler = async (_request: NextRequest): Promise<NextResponse> => {
  const scan = await buildScan();
  return NextResponse.json(scan);
};

export const GET = withX402(
  handler,
  {
    accepts: {
      scheme: "exact",
      payTo: PAY_TO,
      price: "$0.20",
      network: BASE_NETWORK,
    },
    description: "Solana DeFi Yield Intelligence Scan",
  },
  x402Server,
);
