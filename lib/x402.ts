import type { FacilitatorConfig } from "x402/types";

const DEFAULT_PAY_TO = "0xC67d94504696960bA0f2e7C3FeE703950734c00A";

export const PAY_TO = (process.env.WALLET_ADDRESS ?? DEFAULT_PAY_TO) as `0x${string}`;

const facilitatorUrl = process.env.FACILITATOR_URL;

export const FACILITATOR: FacilitatorConfig | undefined =
  facilitatorUrl && /^https?:\/\//.test(facilitatorUrl)
    ? { url: facilitatorUrl as `${string}://${string}` }
    : undefined;
