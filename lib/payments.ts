import { NextRequest, NextResponse } from "next/server";
import type { RouteConfig } from "x402/types";

export const SOLANA_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const USDT_BNB = "0x55d398326f99059fF775485246999027B3197955";
export const JPYC_POLYGON = (
  process.env.NEXT_PUBLIC_JPYC_CONTRACT ??
  "0x431D5dfF03120AFA4bDf332c61A6e1766eF37BDB"
).toLowerCase() as `0x${string}`;

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-payment, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function hasPayment(req: NextRequest): boolean {
  return Boolean(req.headers.get("X-PAYMENT"));
}

export function preflight(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function paymentRequired(
  network: string,
  asset: string,
  payTo: string,
  req: NextRequest,
  maxAmountRequired: string,
  description: string,
): NextResponse {
  return new NextResponse(
    JSON.stringify({
      x402Version: 1,
      error: "Payment Required",
      accepts: [
        {
          scheme: "exact",
          network,
          maxAmountRequired,
          resource: req.url,
          description,
          mimeType: "application/json",
          payTo,
          maxTimeoutSeconds: 300,
          asset,
        },
      ],
    }),
    {
      status: 402,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    },
  );
}

/** Manual x402 402 response for Solana USDC (withX402 is not used for Solana). */
export function solanaPaymentRequired(
  req: NextRequest,
  maxAmountRequired: string,
  description: string,
): NextResponse {
  return paymentRequired(
    "solana-mainnet",
    SOLANA_USDC,
    process.env.SOLANA_WALLET_ADDRESS ?? "",
    req,
    maxAmountRequired,
    description,
  );
}

/**
 * Manual x402 402 response for BNB Chain USDT. withX402 cannot be used here
 * because x402-next 1.2.0 has no "bnb"/"bsc" network in its Network type.
 */
export function bnbPaymentRequired(
  req: NextRequest,
  maxAmountRequired: string,
  description: string,
): NextResponse {
  return paymentRequired(
    "eip155:56",
    USDT_BNB,
    process.env.WALLET_ADDRESS ?? "",
    req,
    maxAmountRequired,
    description,
  );
}

function isValidEvmAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

/**
 * Resolves the withX402 route config for Polygon. `?token=jpyc` switches the
 * accepted asset from native USDC to JPYC; any other value uses USDC.
 *
 * If NEXT_PUBLIC_JPYC_CONTRACT is not a valid 20-byte address the JPYC
 * branch falls back to USDC so the route never fails at runtime.
 */
export async function polygonRouteConfig(
  req: NextRequest,
  usdcPrice: string,
  jpycAtomicAmount: string,
  description: string,
): Promise<RouteConfig> {
  const token = new URL(req.url).searchParams.get("token")?.toLowerCase();
  if (token === "jpyc" && isValidEvmAddress(JPYC_POLYGON)) {
    return {
      price: {
        amount: jpycAtomicAmount,
        asset: {
          address: JPYC_POLYGON,
          decimals: 18,
          eip712: { name: "JPYC", version: "1" },
        },
      },
      network: "polygon",
      config: { description: `${description} (JPYC)` },
    };
  }
  return {
    price: usdcPrice,
    network: "polygon",
    config: { description },
  };
}
