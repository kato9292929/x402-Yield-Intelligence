import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { analyzePool } from "@/lib/intelligence";
import { BASE_NETWORK, PAY_TO, x402Server } from "@/lib/x402";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const handler = async (request: NextRequest): Promise<NextResponse> => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { protocol, pool } = (body ?? {}) as {
    protocol?: unknown;
    pool?: unknown;
  };

  if (
    typeof protocol !== "string" ||
    typeof pool !== "string" ||
    !protocol.trim() ||
    !pool.trim()
  ) {
    return NextResponse.json(
      { error: "Body must include non-empty 'protocol' and 'pool' strings." },
      { status: 400 },
    );
  }

  const result = await analyzePool(protocol, pool);
  return NextResponse.json(result);
};

export const POST = withX402(
  handler,
  {
    accepts: {
      scheme: "exact",
      payTo: PAY_TO,
      price: "$0.30",
      network: BASE_NETWORK,
    },
    description: "Solana DeFi Pool Deep Analysis",
  },
  x402Server,
);
