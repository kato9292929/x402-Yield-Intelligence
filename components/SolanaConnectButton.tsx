"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import SolanaWalletProviders from "./SolanaWalletProviders";

/**
 * Self-contained Solana connect button. Wraps its own provider tree so it can
 * be dynamically imported with `ssr: false` without affecting page SSR.
 */
export default function SolanaConnectButton() {
  return (
    <SolanaWalletProviders>
      <WalletMultiButton />
    </SolanaWalletProviders>
  );
}
