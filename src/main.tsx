import { Buffer } from 'buffer';
(window as unknown as Record<string, unknown>).Buffer = Buffer;

import React from 'react';
import ReactDOM from 'react-dom/client';

// ── Wagmi / RainbowKit (EVM) ──────────────────────────────────────────────────
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@rainbow-me/rainbowkit/styles.css';

// ── Solana Wallet Adapter ─────────────────────────────────────────────────────
import {
  ConnectionProvider as _ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
// Cast to fix React 18/19 FunctionComponent return-type mismatch in wallet-adapter types.
const ConnectionProvider = _ConnectionProvider as React.ComponentType<
  React.PropsWithChildren<{ endpoint: string }>
>;
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import '@solana/wallet-adapter-react-ui/styles.css';

import { wagmiConfig } from './config/wagmi';
import App from './App';
import './index.css';

const queryClient = new QueryClient();

// Solana wallets — Phantom + Solflare cover the majority of users.
// Additional adapters can be added here; the WalletMultiButton
// in SolanaPanel will list them automatically.
const solanaWallets = [new PhantomWalletAdapter(), new SolflareWalletAdapter()];

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* EVM providers */}
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()}>
          {/* Solana providers — ConnectionProvider endpoint is mainnet-beta by default;
              SolanaPanel creates its own Connection for devnet reads/writes. */}
          <ConnectionProvider endpoint={clusterApiUrl('mainnet-beta')}>
            <WalletProvider wallets={solanaWallets} autoConnect>
              <WalletModalProvider>
                <App />
              </WalletModalProvider>
            </WalletProvider>
          </ConnectionProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
);

