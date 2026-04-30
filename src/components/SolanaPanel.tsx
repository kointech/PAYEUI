import { useState, useCallback } from 'react';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import {
  fetchOFTStore,
  buildSetDeveloperIx,
  buildSetDeveloperEnabledIx,
  OFTStoreInfo,
  SOLANA_MAINNET_RPC,
  SOLANA_DEVNET_RPC,
} from '../utils/solana';
import AddressInput from './AddressInput';
import StatusBadge from './StatusBadge';
import TxStatus from './TxStatus';

type Cluster = 'mainnet' | 'devnet';

const NULL_PUBKEY = '11111111111111111111111111111111';

export default function SolanaPanel() {
  // ── Wallet adapter ─────────────────────────────────────────────────────────
  const { publicKey, sendTransaction, connected } = useWallet();

  // ── Local state ───────────────────────────────────────────────────────────
  const [cluster, setCluster] = useState<Cluster>('mainnet');
  const [programId, setProgramId] = useState('');
  const [oftStoreAddress, setOftStoreAddress] = useState('');
  const [storeInfo, setStoreInfo] = useState<OFTStoreInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [newDevAddress, setNewDevAddress] = useState('');
  const [txStatus, setTxStatus] = useState<{
    state: 'idle' | 'pending' | 'success' | 'error';
    msg: string;
  }>({ state: 'idle', msg: '' });

  // ── Helpers ────────────────────────────────────────────────────────────────

  function getConnection() {
    return new Connection(
      cluster === 'mainnet' ? SOLANA_MAINNET_RPC : SOLANA_DEVNET_RPC,
      'confirmed',
    );
  }

  function parseProgramId(): PublicKey {
    try {
      return new PublicKey(programId);
    } catch {
      throw new Error('Invalid Program ID.');
    }
  }

  function parseOftStore(): PublicKey {
    try {
      return new PublicKey(oftStoreAddress);
    } catch {
      throw new Error('Invalid OFT Store address.');
    }
  }

  // ── Read state ─────────────────────────────────────────────────────────────

  const readState = useCallback(async () => {
    setLoading(true);
    try {
      const connection = getConnection();
      const oft = parseOftStore();
      const info = await fetchOFTStore(connection, oft);
      setStoreInfo(info);
    } catch (e) {
      alert(`Read failed: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cluster, oftStoreAddress]);

  // ── Write helpers ──────────────────────────────────────────────────────────

  async function runWrite(
    label: string,
    buildIx: () => Promise<import('@solana/web3.js').TransactionInstruction>,
  ) {
    if (!publicKey) {
      alert('Connect your Solana wallet first.');
      return;
    }
    setTxStatus({ state: 'pending', msg: `${label} — waiting for signature…` });
    try {
      const connection = getConnection();
      const ix = await buildIx();
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash('confirmed');
      const tx = new Transaction({ feePayer: publicKey, blockhash, lastValidBlockHeight }).add(
        ix,
      );
      const sig = await sendTransaction(tx, connection);
      setTxStatus({ state: 'pending', msg: `Confirming… (${sig.slice(0, 16)}…)` });
      await connection.confirmTransaction(
        { signature: sig, blockhash, lastValidBlockHeight },
        'confirmed',
      );
      setTxStatus({ state: 'success', msg: `${label} confirmed. Sig: ${sig.slice(0, 16)}…` });
      await readState();
    } catch (e) {
      setTxStatus({ state: 'error', msg: `${label} failed: ${(e as Error).message}` });
    }
  }

  // ── Action handlers ────────────────────────────────────────────────────────

  async function handleSetDeveloper() {
    let newDev: PublicKey;
    try {
      newDev = new PublicKey(newDevAddress);
    } catch {
      alert('Enter a valid Solana public key for the new developer.');
      return;
    }
    await runWrite('Set Developer', async () =>
      buildSetDeveloperIx(publicKey!, parseOftStore(), newDev, parseProgramId()),
    );
  }

  async function handleEnableDeveloper() {
    await runWrite('Enable Developer', async () =>
      buildSetDeveloperEnabledIx(publicKey!, parseOftStore(), true, parseProgramId()),
    );
  }

  async function handleDisableDeveloper() {
    await runWrite('Disable Developer', async () =>
      buildSetDeveloperEnabledIx(publicKey!, parseOftStore(), false, parseProgramId()),
    );
  }

  // ── Role detection ─────────────────────────────────────────────────────────

  const isAdmin =
    !!publicKey && !!storeInfo && storeInfo.admin.toBase58() === publicKey.toBase58();

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Cluster selector */}
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">Cluster</label>
        <div className="flex gap-2">
          {(['mainnet', 'devnet'] as Cluster[]).map((c) => (
            <button
              key={c}
              onClick={() => {
                setCluster(c);
                setStoreInfo(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                cluster === c
                  ? 'bg-purple-700 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {c === 'mainnet' ? 'Mainnet' : 'Devnet'}
            </button>
          ))}
        </div>
      </div>

      {/* Program ID */}
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">
          PAYE OFT Program ID
        </label>
        <input
          type="text"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-purple-500"
          placeholder="Program public key (base58)"
          value={programId}
          maxLength={44}
          onChange={(e) => setProgramId(e.target.value.trim())}
          spellCheck={false}
        />
      </div>

      {/* OFT Store address */}
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">
          OFT Store Address (PDA)
        </label>
        <input
          type="text"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-purple-500"
          placeholder="OFT Store PDA (base58) — from deployments/solana-*.json"
          value={oftStoreAddress}
          maxLength={44}
          onChange={(e) => setOftStoreAddress(e.target.value.trim())}
          spellCheck={false}
        />
        <p className="text-xs text-gray-600 mt-1">
          Found in{' '}
          <code className="bg-gray-800 px-1 rounded">
            deployments/solana-{cluster}.json
          </code>{' '}
          → <code className="bg-gray-800 px-1 rounded">oftStore</code>
        </p>
      </div>

      {/* Wallet — wallet-adapter WalletMultiButton + role badge + read button */}
      <div className="flex items-center gap-3 flex-wrap">
        <WalletMultiButton style={{ height: '38px', fontSize: '14px', borderRadius: '8px' }} />

        <button
          onClick={readState}
          disabled={loading || !oftStoreAddress}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-semibold transition disabled:opacity-50"
        >
          {loading ? 'Reading…' : 'Read State'}
        </button>

        {connected && isAdmin && (
          <span className="px-2 py-0.5 bg-purple-900 text-purple-300 border border-purple-700 rounded text-xs font-semibold">
            Admin
          </span>
        )}
      </div>

      {/* ── Current state ────────────────────────────────────────────────── */}
      {storeInfo && (
        <div className="bg-gray-800 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
            Current State
          </h3>
          <SolStateRow label="Admin" value={storeInfo.admin.toBase58()} />
          <SolStateRow
            label="Developer"
            value={storeInfo.developer.toBase58()}
            dim={storeInfo.developer.toBase58() === NULL_PUBKEY}
          />
          <div className="flex items-center justify-between py-2 border-b border-gray-700">
            <span className="text-sm text-gray-400">Developer Enabled</span>
            <StatusBadge enabled={storeInfo.developerEnabled} />
          </div>
        </div>
      )}

      {/* ── Write actions ─────────────────────────────────────────────────── */}
      {connected && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
            Actions{' '}
            {!isAdmin && (
              <span className="text-yellow-500 normal-case font-normal">
                (requires Admin wallet)
              </span>
            )}
          </h3>

          {/* Set Developer */}
          <div className={`bg-gray-800 rounded-xl p-4 space-y-3 ${!isAdmin ? 'opacity-60' : ''}`}>
            <p className="text-sm font-medium text-gray-200">Set Developer</p>
            <p className="text-xs text-gray-500">
              Directly sets a new developer address. Only the admin can call this. Pass the system
              program address (<code className="bg-gray-700 px-1 rounded">111…111</code>) to
              remove the developer.
            </p>
            <AddressInput
              placeholder="New developer public key (base58)"
              value={newDevAddress}
              onChange={setNewDevAddress}
            />
            <SolActionButton
              onClick={handleSetDeveloper}
              label="Set Developer"
              disabled={!isAdmin}
            />
          </div>

          {/* Enable / Disable */}
          <div className={`bg-gray-800 rounded-xl p-4 space-y-3 ${!isAdmin ? 'opacity-60' : ''}`}>
            <p className="text-sm font-medium text-gray-200">Toggle Developer Role</p>
            <div className="flex gap-3">
              <SolActionButton
                onClick={handleEnableDeveloper}
                label="Enable Developer"
                disabled={!isAdmin || (storeInfo?.developerEnabled ?? false)}
                variant="success"
              />
              <SolActionButton
                onClick={handleDisableDeveloper}
                label="Disable Developer"
                disabled={!isAdmin || !(storeInfo?.developerEnabled ?? true)}
                variant="danger"
              />
            </div>
          </div>
        </div>
      )}

      <TxStatus status={txStatus} />
    </div>
  );
}

// ── Small local components ─────────────────────────────────────────────────────

function SolStateRow({
  label,
  value,
  dim,
}: {
  label: string;
  value: string;
  dim?: boolean;
}) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-gray-700 gap-4">
      <span className="text-sm text-gray-400 shrink-0">{label}</span>
      <span
        className={`text-sm font-mono break-all text-right ${
          dim ? 'text-gray-600' : 'text-gray-200'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function SolActionButton({
  onClick,
  label,
  disabled,
  variant = 'primary',
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  variant?: 'primary' | 'success' | 'danger';
}) {
  const colors = {
    primary: 'bg-purple-600 hover:bg-purple-700',
    success: 'bg-green-600 hover:bg-green-700',
    danger: 'bg-red-600 hover:bg-red-700',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed ${colors[variant]}`}
    >
      {label}
    </button>
  );
}
