import { NextRequest, NextResponse } from "next/server";
import { resolvePool } from "@/lib/handlers";
import {
  CORS_HEADERS,
  hasPayment,
  preflight,
  solanaPaymentRequired,
} from "@/lib/payments";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const AMOUNT = "300000";
const DESCRIPTION = "Solana DeFi Pool Deep Analysis";

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

  const result = await resolvePool(body);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status, headers: CORS_HEADERS },
    );
  }
  return NextResponse.json(result.data, { headers: CORS_HEADERS });
}
