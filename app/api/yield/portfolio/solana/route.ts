import { NextRequest, NextResponse } from "next/server";
import { resolvePortfolio } from "@/lib/handlers";
import {
  CORS_HEADERS,
  hasPayment,
  preflight,
  solanaPaymentRequired,
} from "@/lib/payments";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const AMOUNT = "500000";
const DESCRIPTION = "Solana DeFi Portfolio Rebalancing Analysis";

export function OPTIONS(_req: NextRequest): NextResponse {
  return preflight();
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!hasPayment(req)) {
    return solanaPaymentRequired(req, AMOUNT, DESCRIPTION);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const result = await resolvePortfolio(body);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status, headers: CORS_HEADERS },
    );
  }
  return NextResponse.json(result.data, { headers: CORS_HEADERS });
}
