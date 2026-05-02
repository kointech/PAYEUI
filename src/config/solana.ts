// ── Solana cluster config ─────────────────────────────────────────────────────
// All values are read from .env at build time.
// See .env.example for the full list of variables.

export type SolanaCluster = 'mainnet' | 'devnet';

export interface SolanaClusterConfig {
  id: SolanaCluster;
  label: string;
  rpcUrl: string;
  /** PAYE OFT Anchor program ID (base58) */
  programId: string;
  /** OFT Store PDA (base58) */
  oftStore: string;
}

export const SOLANA_CLUSTERS: SolanaClusterConfig[] = [
  {
    id: 'mainnet',
    label: 'Mainnet',
    rpcUrl:
      (import.meta.env.VITE_SOLANA_MAINNET_RPC as string | undefined) ??
      'https://api.mainnet-beta.solana.com',
    programId: (import.meta.env.VITE_SOLANA_MAINNET_PROGRAM_ID as string | undefined) ?? '',
    oftStore:  (import.meta.env.VITE_SOLANA_MAINNET_OFT_STORE  as string | undefined) ?? '',
  },
  {
    id: 'devnet',
    label: 'Devnet',
    rpcUrl:
      (import.meta.env.VITE_SOLANA_DEVNET_RPC as string | undefined) ??
      'https://api.devnet.solana.com',
    programId: (import.meta.env.VITE_SOLANA_DEVNET_PROGRAM_ID as string | undefined) ?? '',
    oftStore:  (import.meta.env.VITE_SOLANA_DEVNET_OFT_STORE  as string | undefined) ?? '',
  },
];
