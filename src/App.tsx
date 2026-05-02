import { useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import LineaPanel from './components/LineaPanel';
import SolanaPanel from './components/SolanaPanel';

type Tab = 'evm' | 'solana';

export default function App() {
  const [tab, setTab] = useState<Tab>('evm');
  const { isConnected } = useAccount();
  const chainId = useChainId();

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          {/* Logo */}
          <span className="text-xl font-bold text-white tracking-tight shrink-0">PAYE</span>
          <span className="text-gray-500 text-sm font-medium shrink-0">Developer Admin</span>

          {/* Spacer */}
          <div className="flex-1" />

          {/* EVM / Solana tab toggle */}
          <div className="flex items-center gap-1 bg-gray-800 rounded-xl p-1">
            <button
              onClick={() => setTab('evm')}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                tab === 'evm' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              EVM
            </button>
            <button
              onClick={() => setTab('solana')}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                tab === 'solana' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Solana
            </button>
          </div>

          {/* Wallet connect — always visible; shows connected network inside */}
          {tab === 'evm' && (
            <ConnectButton
              chainStatus="icon"
              accountStatus="avatar"
              showBalance={false}
            />
          )}

          {/* Connected network badge for EVM (shown when connected) */}
          {tab === 'evm' && isConnected && (
            <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-gray-800 rounded-lg text-xs font-mono text-gray-300 border border-gray-700">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
              {chainId}
            </span>
          )}
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
          {tab === 'evm' ? <LineaPanel /> : <SolanaPanel />}
        </div>

        {/* Help section */}
        <div className="mt-6 p-4 bg-gray-900/50 rounded-xl border border-gray-800 text-xs text-gray-500">
          <p className="font-semibold text-gray-400 mb-2">How it works</p>
          {tab === 'evm' ? (
            <ul className="space-y-1 list-disc list-inside">
              <li><strong className="text-gray-300">Propose</strong> a new developer (owner only). The proposed address must accept.</li>
              <li><strong className="text-gray-300">Accept</strong> the role by connecting the pending developer wallet.</li>
              <li><strong className="text-gray-300">Enable / Disable</strong> the developer role without changing the address (owner only).</li>
              <li>Passing <code className="bg-gray-800 px-1 rounded">0x000…000</code> as the new developer immediately removes the role.</li>
            </ul>
          ) : (
            <ul className="space-y-1 list-disc list-inside">
              <li><strong className="text-gray-300">Set Developer</strong> directly assigns a new developer public key (admin only, no accept step).</li>
              <li><strong className="text-gray-300">Enable / Disable</strong> the developer role without changing the address (admin only).</li>
              <li>Setting the developer to the system program (<code className="bg-gray-800 px-1 rounded">111…111</code>) auto-disables the role.</li>
            </ul>
          )}
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-800 py-4 text-center text-xs text-gray-700">
        Koinon · PAYE Developer Admin UI
      </footer>
    </div>
  );
}
