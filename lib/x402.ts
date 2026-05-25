import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import type { FacilitatorConfig } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";
import { createFacilitatorConfig } from "@coinbase/x402";

const DEFAULT_PAY_TO = "0xC67d94504696960bA0f2e7C3FeE703950734c00A";

export const PAY_TO = (process.env.WALLET_ADDRESS ?? DEFAULT_PAY_TO) as `0x${string}`;

export const BASE_NETWORK = "eip155:8453" as const;
export const POLYGON_NETWORK = "eip155:137" as const;

function buildFacilitatorConfig(): FacilitatorConfig {
  const apiKeyId = process.env.CDP_API_KEY_ID;
  const apiKeySecret = process.env.CDP_API_KEY_SECRET;
  if (apiKeyId && apiKeySecret) {
    return createFacilitatorConfig(apiKeyId, apiKeySecret);
  }
  const url = process.env.FACILITATOR_URL;
  if (url && /^https?:\/\//.test(url)) {
    return { url };
  }
  return {};
}

const facilitatorClient = new HTTPFacilitatorClient(buildFacilitatorConfig());

export const x402Server = new x402ResourceServer(facilitatorClient);
registerExactEvmScheme(x402Server);
