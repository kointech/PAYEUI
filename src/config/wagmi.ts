import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { linea, baseSepolia, sepolia } from 'viem/chains';
import { http } from 'wagmi';
import { EVM_CHAINS } from './evm';

// Get a free project ID at https://cloud.walletconnect.com
// Without a real ID, WalletConnect QR-code connections are disabled,
// but injected wallets (MetaMask, Rabby, etc.) still work fine.
const WALLETCONNECT_PROJECT_ID =
  (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined) ?? '';

// Build transports from the same chain registry so they always stay in sync
const transports = Object.fromEntries(
  EVM_CHAINS.map(({ chain, rpcUrl }) => [chain.id, http(rpcUrl)]),
);

export const wagmiConfig = getDefaultConfig({
  appName: 'PAYE Developer Admin',
  projectId: WALLETCONNECT_PROJECT_ID,
  chains: [linea, baseSepolia, sepolia],
  transports,
  // Disable automatic block-number polling — this is an admin tool
  // with a manual Refresh button; continuous polling is unnecessary.
  pollingInterval: 0,
  ssr: false,
});
