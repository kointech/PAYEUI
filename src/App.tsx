import { useState } from 'react';
import LineaPanel from './components/LineaPanel';
import SolanaPanel from './components/SolanaPanel';

type Chain = 'linea' | 'solana';

const CHAINS: { id: Chain; label: string; icon: string; color: string }[] = [
  {
    id: 'linea',
    label: 'EVM',
    icon: '⬡',
    color: 'from-blue-600 to-blue-800',
  },
  {
    id: 'solana',
    label: 'Solana',
    icon: '◎',
    color: 'from-purple-600 to-purple-800',
  },
];

export default function App() {
  const [chain, setChain] = useState<Chain>('linea');

  const selected = CHAINS.find((c) => c.id === chain)!;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-white tracking-tight">PAYE</span>
            <span className="text-gray-500 text-sm font-medium">Developer Admin</span>
          </div>

          {/* Chain selector */}
          <div className="flex items-center gap-1 bg-gray-800 rounded-xl p-1">
            {CHAINS.map((c) => (
              <button
                key={c.id}
                onClick={() => setChain(c.id)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  chain === c.id
                    ? `bg-gradient-to-r ${c.color} text-white shadow`
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <span>{c.icon}</span>
                <span>{c.label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        {/* Panel header */}
        <div className={`mb-6 p-4 rounded-2xl bg-gradient-to-r ${selected.color} text-white`}>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{selected.icon}</span>
            <div>
              <h1 className="text-xl font-bold">{selected.label}</h1>
              <p className="text-sm opacity-80">
                {chain === 'linea'
                  ? 'PAYEToken — Linea / Base / Eth Sepolia (Ownable2Step + Developer role)'
                  : 'PAYE OFT — Solana (Admin + Developer role)'}
              </p>
            </div>
          </div>
        </div>

        {/* Chain panel */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
          {chain === 'linea' ? <LineaPanel /> : <SolanaPanel />}
        </div>

        {/* Help section */}
        <div className="mt-6 p-4 bg-gray-900/50 rounded-xl border border-gray-800 text-xs text-gray-500">
          <p className="font-semibold text-gray-400 mb-2">How it works</p>
          {chain === 'linea' ? (
            <ul className="space-y-1 list-disc list-inside">
              <li><strong className="text-gray-300">Propose</strong> a new developer with "Set Developer" (owner only). The proposed address must accept.</li>
              <li><strong className="text-gray-300">Accept</strong> the role by connecting the pending developer wallet and clicking "Accept Developer".</li>
              <li><strong className="text-gray-300">Enable / Disable</strong> the developer role without changing the address (owner only).</li>
              <li>Passing <code className="bg-gray-800 px-1 rounded">0x000…000</code> as the new developer immediately removes the role.</li>
            </ul>
          ) : (
            <ul className="space-y-1 list-disc list-inside">
              <li><strong className="text-gray-300">Set Developer</strong> directly assigns a new developer public key (admin only, no accept step on Solana).</li>
              <li><strong className="text-gray-300">Enable / Disable</strong> the developer role without changing the address (admin only).</li>
              <li>Setting the developer to the system program (<code className="bg-gray-800 px-1 rounded">111…111</code>) auto-disables the role.</li>
              <li>Enter the OFT Store address from <code className="bg-gray-800 px-1 rounded">deployments/solana-*.json → oftStore</code>.</li>
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
