import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "x402-next";
import { buildWeeklyReport } from "@/lib/intelligence";
import { polygonRouteConfig } from "@/lib/payments";
import { PAY_TO } from "@/lib/x402";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const handler = async (_req: NextRequest): Promise<NextResponse> => {
  return NextResponse.json(await buildWeeklyReport());
};

export const GET = withX402(handler, PAY_TO, (req) =>
  polygonRouteConfig(
    req,
    "$2.00",
    "300000000000000000000",
    "Weekly Solana DeFi Yield Intelligence Report",
  ),
);
