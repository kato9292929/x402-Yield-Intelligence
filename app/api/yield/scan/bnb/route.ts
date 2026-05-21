import { NextRequest, NextResponse } from "next/server";
import { buildScan } from "@/lib/intelligence";
import {
  bnbPaymentRequired,
  CORS_HEADERS,
  hasPayment,
  preflight,
} from "@/lib/payments";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const AMOUNT = "200000";
const DESCRIPTION = "Solana DeFi Yield Intelligence Scan";

export function OPTIONS(_req: NextRequest): NextResponse {
  return preflight();
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!hasPayment(req)) {
    return bnbPaymentRequired(req, AMOUNT, DESCRIPTION);
  }
  const scan = await buildScan();
  return NextResponse.json(scan, { headers: CORS_HEADERS });
}
