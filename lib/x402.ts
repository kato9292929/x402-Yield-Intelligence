import type { FacilitatorConfig } from "x402/types";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export const PAY_TO = (process.env.WALLET_ADDRESS ?? ZERO_ADDRESS) as `0x${string}`;

const facilitatorUrl = process.env.FACILITATOR_URL;

export const FACILITATOR: FacilitatorConfig | undefined =
  facilitatorUrl && /^https?:\/\//.test(facilitatorUrl)
    ? { url: facilitatorUrl as `${string}://${string}` }
    : undefined;
