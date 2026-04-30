import { parseAbi } from 'viem';

// PAYEToken developer-related ABI (viem parseAbi format)
export const PAYE_ABI = parseAbi([
  // ── Read ─────────────────────────────────────────────────────────────────
  'function owner() view returns (address)',
  'function developer() view returns (address)',
  'function developerEnabled() view returns (bool)',
  'function pendingDeveloper() view returns (address)',

  // ── Write (owner only) ────────────────────────────────────────────────────
  'function setDeveloper(address newDeveloper) external',
  'function enableDeveloper() external',
  'function disableDeveloper() external',

  // ── Write (pending developer only) ────────────────────────────────────────
  'function acceptDeveloper() external',
]);

// Linea Mainnet contract address for PAYEToken.
// Override by entering a custom address in the UI, or set VITE_LINEA_CONTRACT_ADDRESS in .env.
export const LINEA_CONTRACT_ADDRESS_DEFAULT =
  import.meta.env.VITE_LINEA_CONTRACT_ADDRESS ?? '';

// Public Linea Mainnet RPC (read-only, no wallet required).
// Override via VITE_LINEA_RPC_URL in .env.
export const LINEA_PUBLIC_RPC =
  import.meta.env.VITE_LINEA_RPC_URL ?? 'https://rpc.linea.build';

// Linea Mainnet chain ID
export const LINEA_CHAIN_ID = 59144;
