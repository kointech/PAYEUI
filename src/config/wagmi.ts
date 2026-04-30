import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { linea, lineaSepolia, sepolia } from 'viem/chains';
import { http } from 'wagmi';

// Get a free project ID at https://cloud.walletconnect.com
// Without a real ID, WalletConnect QR-code connections are disabled,
// but injected wallets (MetaMask, Rabby, etc.) still work fine.
const WALLETCONNECT_PROJECT_ID =
  (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined) ?? '';

const LINEA_RPC =
  (import.meta.env.VITE_LINEA_RPC_URL as string | undefined) ?? 'https://rpc.linea.build';

export const wagmiConfig = getDefaultConfig({
  appName: 'PAYE Developer Admin',
  projectId: WALLETCONNECT_PROJECT_ID,
  chains: [linea, lineaSepolia, sepolia],
  transports: {
    [linea.id]: http(LINEA_RPC),
    [lineaSepolia.id]: http(),
    [sepolia.id]: http(),
  },
  ssr: false,
});
