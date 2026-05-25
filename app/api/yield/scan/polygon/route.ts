import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { buildScan } from "@/lib/intelligence";
import { polygonRouteConfig } from "@/lib/payments";
import { PAY_TO, x402Server } from "@/lib/x402";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const handler = async (_req: NextRequest): Promise<NextResponse> => {
  return NextResponse.json(await buildScan());
};

export const GET = withX402(
  handler,
  polygonRouteConfig(
    "$0.20",
    "30000000000000000000",
    "Solana DeFi Yield Intelligence Scan",
    PAY_TO,
  ),
  x402Server,
);
