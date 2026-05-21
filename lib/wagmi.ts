import { createConfig, http } from "wagmi";
import { base, bsc, polygon } from "wagmi/chains";
import { injected } from "wagmi/connectors";

/**
 * EVM wagmi config for x402 payments across Base, Polygon and BNB Chain.
 * Uses the injected connector only; WalletConnect is omitted because it has
 * no usable project ID here and pulls indexedDB into server rendering.
 */
export const wagmiConfig = createConfig({
  chains: [base, polygon, bsc],
  connectors: [injected()],
  transports: {
    [base.id]: http(),
    [polygon.id]: http(),
    [bsc.id]: http(),
  },
  ssr: true,
});
