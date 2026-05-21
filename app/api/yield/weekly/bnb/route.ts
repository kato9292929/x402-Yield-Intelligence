import { NextRequest, NextResponse } from "next/server";
import { buildWeeklyReport } from "@/lib/intelligence";
import {
  bnbPaymentRequired,
  CORS_HEADERS,
  hasPayment,
  preflight,
} from "@/lib/payments";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const AMOUNT = "2000000";
const DESCRIPTION = "Weekly Solana DeFi Yield Intelligence Report";

export function OPTIONS(_req: NextRequest): NextResponse {
  return preflight();
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!hasPayment(req)) {
    return bnbPaymentRequired(req, AMOUNT, DESCRIPTION);
  }
  const report = await buildWeeklyReport();
  return NextResponse.json(report, { headers: CORS_HEADERS });
}
