import { parseAbi } from 'viem';
import { linea, baseSepolia, sepolia, type Chain } from 'viem/chains';

// ── ABI ───────────────────────────────────────────────────────────────────────

export const PAYE_ABI = parseAbi([
  // Read
  'function owner() view returns (address)',
  'function pendingOwner() view returns (address)',
  'function developer() view returns (address)',
  'function developerEnabled() view returns (bool)',
  'function pendingDeveloper() view returns (address)',
  // Write (owner only)
  'function transferOwnership(address newOwner) external',
  'function renounceOwnership() external',
  'function setDeveloper(address newDeveloper) external',
  'function enableDeveloper() external',
  'function disableDeveloper() external',
  // Write (pending owner only)
  'function acceptOwnership() external',
  // Write (pending developer only)
  'function acceptDeveloper() external',
]);

// ── Chain config ──────────────────────────────────────────────────────────────

export interface EvmChainConfig {
  chain: Chain;
  label: string;
  /** Env var prefix, e.g. 'LINEA' → VITE_LINEA_CONTRACT */
  envPrefix: string;
  rpcUrl: string;
  contractAddress: string;
}

export const EVM_CHAINS: EvmChainConfig[] = [
  {
    chain: linea,
    label: 'Linea Mainnet',
    envPrefix: 'LINEA',
    rpcUrl: (import.meta.env.VITE_LINEA_RPC_URL as string | undefined) ?? 'https://rpc.linea.build',
    contractAddress: (import.meta.env.VITE_LINEA_CONTRACT as string | undefined) ?? '',
  },
  {
    chain: baseSepolia,
    label: 'Base Sepolia',
    envPrefix: 'BASE_SEPOLIA',
    rpcUrl: (import.meta.env.VITE_BASE_SEPOLIA_RPC_URL as string | undefined) ?? 'https://sepolia.base.org',
    contractAddress: (import.meta.env.VITE_BASE_SEPOLIA_CONTRACT as string | undefined) ?? '',
  },
  {
    chain: sepolia,
    label: 'Eth Sepolia',
    envPrefix: 'ETH_SEPOLIA',
    rpcUrl: (import.meta.env.VITE_ETH_SEPOLIA_RPC_URL as string | undefined) ?? 'https://rpc.sepolia.org',
    contractAddress: (import.meta.env.VITE_ETH_SEPOLIA_CONTRACT as string | undefined) ?? '',
  },
];
