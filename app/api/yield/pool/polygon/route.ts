import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { resolvePool } from "@/lib/handlers";
import { polygonRouteConfig } from "@/lib/payments";
import { PAY_TO, x402Server } from "@/lib/x402";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const handler = async (req: NextRequest): Promise<NextResponse> => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const result = await resolvePool(body);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data);
};

export const POST = withX402(
  handler,
  polygonRouteConfig(
    "$0.30",
    "45000000000000000000",
    "Solana DeFi Pool Deep Analysis",
    PAY_TO,
  ),
  x402Server,
);
