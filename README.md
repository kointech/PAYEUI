# PAYE Developer Admin UI

A developer-facing admin interface for managing the **PAYE token developer role** across multiple chains. Supports Linea (EVM) and Solana.

## Features

| Action | Linea (EVM) | Solana |
|---|---|---|
| Read current developer | ✅ | ✅ |
| Read developer enabled | ✅ | ✅ |
| Propose new developer | ✅ (owner) | ✅ (admin) |
| Accept developer role | ✅ (pending dev) | — |
| Enable developer | ✅ (owner) | ✅ (admin) |
| Disable developer | ✅ (owner) | ✅ (admin) |

## Stack

| Layer | Technology |
|---|---|
| UI | React 18 + Vite 5 + TypeScript |
| Styling | Tailwind CSS v3 (dark theme) |
| EVM wallet | RainbowKit v2 + Wagmi v2 + viem |
| Solana wallet | `@solana/wallet-adapter-react` (Phantom, Solflare) |
| Queries | TanStack Query v5 |

## Prerequisites

- Node.js ≥ 18
- npm ≥ 9

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in the required values — see the table below.

### 3. Start the dev server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) (or the port shown in the terminal).

### 4. Build for production

```bash
npm run build
```

Output is written to `dist/`. Serve with any static file host (nginx, Vercel, Cloudflare Pages, etc.).

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_WALLETCONNECT_PROJECT_ID` | Recommended | WalletConnect project ID for QR-code connections. Get one free at [cloud.walletconnect.com](https://cloud.walletconnect.com). Injected wallets (MetaMask, Rabby, Phantom) work without it. |
| `VITE_LINEA_CONTRACT_ADDRESS` | Optional | Default PAYEToken address on Linea Mainnet. Can also be entered at runtime in the UI. |
| `VITE_LINEA_RPC_URL` | Optional | Override the Linea Mainnet RPC. Default: `https://rpc.linea.build` |
| `VITE_SOLANA_MAINNET_RPC` | Optional | Override the Solana Mainnet RPC. Default: `https://api.mainnet-beta.solana.com`. Use a dedicated RPC (Helius, QuickNode) in production. |
| `VITE_SOLANA_DEVNET_RPC` | Optional | Override the Solana Devnet RPC. Default: `https://api.devnet.solana.com` |

See [`.env.example`](.env.example) for a ready-to-copy template.

---

## Usage

### Linea panel

1. Select **Linea** in the chain dropdown.
2. Connect your EVM wallet via the **Connect Wallet** button (MetaMask, Rabby, WalletConnect, etc.).
3. Enter the PAYEToken contract address (or set `VITE_LINEA_CONTRACT_ADDRESS` to pre-fill it).
4. The panel reads `owner`, `developer`, `developerEnabled`, and `pendingDeveloper` automatically.
5. Actions are gated by role:
   - **Owner** — Propose Developer, Enable Developer, Disable Developer.
   - **Pending Developer** — Accept Developer (claim the role).

### Solana panel

1. Select **Solana** in the chain dropdown.
2. Choose **Mainnet** or **Devnet**.
3. Enter the **PAYE OFT Program ID** and the **OFT Store PDA** address (found in `deployments/solana-<cluster>.json → oftStore`).
4. Connect your Solana wallet via the **Select Wallet** button (Phantom or Solflare).
5. Click **Read State** to fetch on-chain data.
6. Admin-only actions become available when the connected wallet matches the on-chain admin.

---

## Project Structure

```
src/
├── App.tsx                  # Chain selector + panel router
├── main.tsx                 # Provider tree (Wagmi, RainbowKit, Solana wallet adapter)
├── index.css                # Tailwind base styles
├── vite-env.d.ts            # Vite env type reference
├── components/
│   ├── LineaPanel.tsx       # Linea EVM developer admin UI
│   ├── SolanaPanel.tsx      # Solana OFT developer admin UI
│   ├── AddressInput.tsx     # Reusable address input field
│   ├── StatusBadge.tsx      # Enabled / Disabled badge
│   └── TxStatus.tsx         # Transaction status display
├── config/
│   ├── wagmi.ts             # Wagmi + RainbowKit config
│   └── linea.ts             # PAYEToken ABI + Linea chain constants
└── utils/
    └── solana.ts            # Solana instruction builders + account parser
```
