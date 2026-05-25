import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { buildWeeklyReport } from "@/lib/intelligence";
import { polygonRouteConfig } from "@/lib/payments";
import { PAY_TO, x402Server } from "@/lib/x402";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const handler = async (_req: NextRequest): Promise<NextResponse> => {
  return NextResponse.json(await buildWeeklyReport());
};

export const GET = withX402(
  handler,
  polygonRouteConfig(
    "$2.00",
    "300000000000000000000",
    "Weekly Solana DeFi Yield Intelligence Report",
    PAY_TO,
  ),
  x402Server,
);
