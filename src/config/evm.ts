import { parseAbi } from 'viem';
import { linea, baseSepolia, sepolia, type Chain } from 'viem/chains';

// ── ABI ───────────────────────────────────────────────────────────────────────

export const PAYE_ABI = parseAbi([
  // Read
  'function owner() view returns (address)',
  'function developer() view returns (address)',
  'function developerEnabled() view returns (bool)',
  'function pendingDeveloper() view returns (address)',
  // Write (owner only)
  'function setDeveloper(address newDeveloper) external',
  'function enableDeveloper() external',
  'function disableDeveloper() external',
  // Write (pending developer only)
  'function acceptDeveloper() external',
]);

// ── Chain config ──────────────────────────────────────────────────────────────

export type TokenEnv = 'main' | 'dev';

export interface EvmChainConfig {
  chain: Chain;
  label: string;
  /** Prefix used in env var names, e.g. 'LINEA' → VITE_LINEA_CONTRACT_MAIN */
  envPrefix: string;
  rpcUrl: string;
  contracts: Record<TokenEnv, string>;
}

export const EVM_CHAINS: EvmChainConfig[] = [
  {
    chain: linea,
    label: 'Linea Mainnet',
    envPrefix: 'LINEA',
    rpcUrl: (import.meta.env.VITE_LINEA_RPC_URL as string | undefined) ?? 'https://rpc.linea.build',
    contracts: {
      main: (import.meta.env.VITE_LINEA_CONTRACT_MAIN as string | undefined) ?? '',
      dev:  (import.meta.env.VITE_LINEA_CONTRACT_DEV  as string | undefined) ?? '',
    },
  },
  {
    chain: baseSepolia,
    label: 'Base Sepolia',
    envPrefix: 'BASE_SEPOLIA',
    rpcUrl: (import.meta.env.VITE_BASE_SEPOLIA_RPC_URL as string | undefined) ?? 'https://sepolia.base.org',
    contracts: {
      main: (import.meta.env.VITE_BASE_SEPOLIA_CONTRACT_MAIN as string | undefined) ?? '',
      dev:  (import.meta.env.VITE_BASE_SEPOLIA_CONTRACT_DEV  as string | undefined) ?? '',
    },
  },
  {
    chain: sepolia,
    label: 'Eth Sepolia',
    envPrefix: 'ETH_SEPOLIA',
    rpcUrl: (import.meta.env.VITE_ETH_SEPOLIA_RPC_URL as string | undefined) ?? 'https://rpc.sepolia.org',
    contracts: {
      main: (import.meta.env.VITE_ETH_SEPOLIA_CONTRACT_MAIN as string | undefined) ?? '',
      dev:  (import.meta.env.VITE_ETH_SEPOLIA_CONTRACT_DEV  as string | undefined) ?? '',
    },
  },
];
