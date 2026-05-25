import { NextRequest, NextResponse } from "next/server";
import type { RouteConfig } from "@x402/next";
import type { PaymentOption } from "@x402/core/http";
import { POLYGON_NETWORK } from "@/lib/x402";

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

/**
 * Manual x402 402 response for Solana USDC. The v2 @x402/svm package would
 * support this natively, but it is not installed; clients still receive a
 * v1-shaped 402 with payment instructions.
 */
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
 * Manual x402 402 response for BNB Chain USDT. Neither the community
 * (x402.org) nor the CDP facilitator settles BNB, so payment verification
 * remains manual.
 */
export function bnbPaymentRequired(
  req: NextRequest,
  maxAmountRequired: string,
  description: string,
): NextResponse {
  return paymentRequired(
    "eip155:56",
    USDT_BNB,
    process.env.WALLET_ADDRESS ?? "0xC67d94504696960bA0f2e7C3FeE703950734c00A",
    req,
    maxAmountRequired,
    description,
  );
}

function isValidEvmAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

/**
 * Build a v2 RouteConfig that accepts either native USDC (preferred) or JPYC
 * on Polygon. Clients pick the option they want to settle in. If
 * NEXT_PUBLIC_JPYC_CONTRACT is not a 20-byte address the JPYC option is
 * omitted so the route still serves USDC.
 */
export function polygonRouteConfig(
  usdcPrice: string,
  jpycAtomicAmount: string,
  description: string,
  payTo: `0x${string}`,
): RouteConfig {
  const accepts: PaymentOption[] = [
    {
      scheme: "exact",
      payTo,
      price: usdcPrice,
      network: POLYGON_NETWORK,
    },
  ];
  if (isValidEvmAddress(JPYC_POLYGON)) {
    accepts.push({
      scheme: "exact",
      payTo,
      price: {
        asset: JPYC_POLYGON,
        amount: jpycAtomicAmount,
        extra: { name: "JPYC", version: "1" },
      },
      network: POLYGON_NETWORK,
    });
  }
  return { accepts, description };
}
