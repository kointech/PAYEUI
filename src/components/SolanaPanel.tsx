import { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { Connection, PublicKey, Transaction, SendTransactionError } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import {
  fetchOFTStore,
  buildSetAdminIx,
  buildAcceptAdminIx,
  buildSetPauseIx,
  buildSetPauserIx,
  buildSetUnpauserIx,
  buildSetDeveloperIx,
  buildSetDeveloperEnabledIx,
  buildSetDelegateIx,
  OFTStoreInfo,
} from '../utils/solana';
import { SOLANA_CLUSTERS } from '../config/solana';
import { SolanaEndpointContext } from '../config/SolanaEndpointContext';
import AddressInput from './AddressInput';
import StatusBadge from './StatusBadge';
import TxStatus from './TxStatus';

const NULL_PUBKEY = '11111111111111111111111111111111';

export default function SolanaPanel() {
  const { publicKey, signTransaction, connected } = useWallet();
  const setEndpoint = useContext(SolanaEndpointContext);

  const mainnetIdx = SOLANA_CLUSTERS.findIndex((c) => c.id === 'mainnet');
  const [clusterIdx, setClusterIdx] = useState(mainnetIdx);
  const [storeInfo, setStoreInfo] = useState<OFTStoreInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [newAdminAddress, setNewAdminAddress] = useState('');
  const [newDevAddress, setNewDevAddress] = useState('');
  const [newDelegateAddress, setNewDelegateAddress] = useState('');
  const [newPauserAddress, setNewPauserAddress] = useState('');
  const [newUnpauserAddress, setNewUnpauserAddress] = useState('');
  const [txStatus, setTxStatus] = useState<{
    state: 'idle' | 'pending' | 'success' | 'error';
    msg: string;
    card: 'admin' | 'set' | 'toggle' | 'delegate' | 'pause' | 'pauser' | null;
  }>({ state: 'idle', msg: '', card: null });
  const [stateFlash, setStateFlash] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clusterCfg = SOLANA_CLUSTERS[clusterIdx];
  const { rpcUrl, programId, oftStore } = clusterCfg;
  const isConfigured = !!programId && !!oftStore;

  // ── Helpers ────────────────────────────────────────────────────────────────

  function getConnection() {
    return new Connection(rpcUrl, 'confirmed');
  }

  function getProgramId(): PublicKey {
    return new PublicKey(programId);
  }

  function getOftStore(): PublicKey {
    return new PublicKey(oftStore);
  }

  // ── Read ───────────────────────────────────────────────────────────────────

  const readState = useCallback(async (flash = false) => {
    if (!isConfigured) return;
    setLoading(true);
    try {
      const info = await fetchOFTStore(getConnection(), getOftStore());
      setStoreInfo(info);
      if (flash) {
        setStateFlash(true);
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setStateFlash(false), 1800);
      }
    } catch (e) {
      setStoreInfo(null);
      setTxStatus({ state: 'error', msg: `Read failed: ${(e as Error).message}`, card: null });
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusterIdx]);

  // Auto-read on cluster change
  useEffect(() => {
    setStoreInfo(null);
    setTxStatus({ state: 'idle', msg: '', card: null });
    if (isConfigured) void readState();
  }, [clusterIdx, isConfigured, readState]);

  // ── Write ──────────────────────────────────────────────────────────────────

  async function runWrite(
    label: string,
    card: 'admin' | 'set' | 'toggle' | 'delegate' | 'pause' | 'pauser',
    buildIx: () => Promise<import('@solana/web3.js').TransactionInstruction>,
  ) {
    if (!publicKey || !signTransaction) { alert('Connect your Solana wallet first.'); return; }
    setTxStatus({ state: 'pending', msg: `${label} — waiting for signature…`, card });
    try {
      const connection = getConnection();
      const ix = await buildIx();
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash('confirmed');
      const tx = new Transaction({ feePayer: publicKey, blockhash, lastValidBlockHeight }).add(ix);
      const signed = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false });
      setTxStatus({ state: 'pending', msg: `Confirming… (${sig.slice(0, 16)}…)`, card });
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
      setTxStatus({ state: 'success', msg: `${label} confirmed. Sig: ${sig.slice(0, 16)}…`, card });
      if (card === 'set') setNewDevAddress('');
      if (card === 'admin') setNewAdminAddress('');
      if (card === 'delegate') setNewDelegateAddress('');
      if (card === 'pauser') { setNewPauserAddress(''); setNewUnpauserAddress(''); }
      await readState(true);
    } catch (e) {
      if (e instanceof SendTransactionError) {
        // "already been processed" means the identical tx was confirmed on a prior attempt
        // (Ed25519 is deterministic: same blockhash + instruction + key → same signature).
        // Treat it as a success and refresh state.
        if (e.message.includes('already been processed')) {
          setTxStatus({ state: 'success', msg: `${label} was already confirmed on-chain.`, card });
          if (card === 'set') setNewDevAddress('');
          if (card === 'admin') setNewAdminAddress('');
          await readState(true);
          return;
        }
        const connection = getConnection();
        const logs = await e.getLogs(connection).catch(() => null);
        const logText = logs?.length ? `\nLogs:\n${logs.join('\n')}` : '';
        setTxStatus({ state: 'error', msg: `${label} failed: ${e.message}${logText}`, card });
      } else {
        setTxStatus({ state: 'error', msg: `${label} failed: ${(e as Error).message}`, card });
      }
    }
  }

  async function handleSetAdmin() {
    let newAdmin: PublicKey;
    try { newAdmin = new PublicKey(newAdminAddress); }
    catch { alert('Enter a valid Solana public key.'); return; }
    if (storeInfo && newAdmin.equals(storeInfo.admin)) {
      setTxStatus({ state: 'error', msg: 'This address is already the current admin.', card: 'admin' });
      return;
    }
    await runWrite('Transfer Admin', 'admin', () =>
      buildSetAdminIx(publicKey!, getOftStore(), newAdmin, getProgramId()),
    );
  }

  async function handleAcceptAdmin() {
    await runWrite('Accept Admin', 'admin', () =>
      buildAcceptAdminIx(publicKey!, getOftStore(), getProgramId()),
    );
  }

  async function handleSetDeveloper() {
    let newDev: PublicKey;
    try { newDev = new PublicKey(newDevAddress); }
    catch { alert('Enter a valid Solana public key.'); return; }
    if (storeInfo && newDev.equals(storeInfo.developer)) {
      setTxStatus({ state: 'error', msg: 'This address is already the current developer.', card: 'set' });
      return;
    }
    await runWrite('Set Developer', 'set', () =>
      buildSetDeveloperIx(publicKey!, getOftStore(), newDev, getProgramId()),
    );
  }

  const handleEnableDeveloper = () =>
    runWrite('Enable Developer', 'toggle', () =>
      buildSetDeveloperEnabledIx(publicKey!, getOftStore(), true, getProgramId()),
    );

  const handleDisableDeveloper = () =>
    runWrite('Disable Developer', 'toggle', () =>
      buildSetDeveloperEnabledIx(publicKey!, getOftStore(), false, getProgramId()),
    );

  async function handleSetDelegate() {
    let newDelegate: PublicKey;
    try { newDelegate = new PublicKey(newDelegateAddress); }
    catch { alert('Enter a valid Solana public key.'); return; }
    if (storeInfo?.delegate && newDelegate.equals(storeInfo.delegate)) {
      setTxStatus({ state: 'error', msg: 'This address is already the current delegate.', card: 'delegate' });
      return;
    }
    await runWrite('Set Delegate', 'delegate', () =>
      buildSetDelegateIx(publicKey!, getOftStore(), newDelegate, getProgramId()),
    );
  }

  const handlePause = () =>
    runWrite('Pause', 'pause', () =>
      buildSetPauseIx(publicKey!, getOftStore(), true, getProgramId()),
    );

  const handleUnpause = () =>
    runWrite('Unpause', 'pause', () =>
      buildSetPauseIx(publicKey!, getOftStore(), false, getProgramId()),
    );

  async function handleSetPauser() {
    let pauser: PublicKey | null = null;
    if (newPauserAddress.trim()) {
      try { pauser = new PublicKey(newPauserAddress); }
      catch { alert('Enter a valid Solana public key for pauser.'); return; }
    }
    await runWrite('Set Pauser', 'pauser', () =>
      buildSetPauserIx(publicKey!, getOftStore(), pauser, getProgramId()),
    );
  }

  async function handleSetUnpauser() {
    let unpauser: PublicKey | null = null;
    if (newUnpauserAddress.trim()) {
      try { unpauser = new PublicKey(newUnpauserAddress); }
      catch { alert('Enter a valid Solana public key for unpauser.'); return; }
    }
    await runWrite('Set Unpauser', 'pauser', () =>
      buildSetUnpauserIx(publicKey!, getOftStore(), unpauser, getProgramId()),
    );
  }

  const isAdmin =
    !!publicKey && !!storeInfo && storeInfo.admin.toBase58() === publicKey.toBase58();

  const isPendingAdmin =
    !!publicKey && !!storeInfo?.pendingAdmin &&
    storeInfo.pendingAdmin.toBase58() === publicKey.toBase58();

  const isPauser =
    !!publicKey && !!storeInfo?.pauser &&
    storeInfo.pauser.toBase58() === publicKey.toBase58();

  const isUnpauser =
    !!publicKey && !!storeInfo?.unpauser &&
    storeInfo.unpauser.toBase58() === publicKey.toBase58();

  const canPause   = isAdmin || isPauser;
  const canUnpause = isAdmin || isUnpauser;

  function selectCluster(idx: number) {
    setClusterIdx(idx);
    setEndpoint(SOLANA_CLUSTERS[idx].rpcUrl);
    setStoreInfo(null);
    setTxStatus({ state: 'idle', msg: '', card: null });
  }

  // Detect cluster label for the connected wallet hint
  const expectedClusterLabel = clusterCfg.label; // 'Mainnet' | 'Devnet'

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Cluster dropdown ───────────────────────────────────────────────── */}
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
          Cluster
        </label>
        <select
          value={clusterIdx}
          onChange={(e) => selectCluster(Number(e.target.value))}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-purple-500"
        >
          {SOLANA_CLUSTERS.map((c, i) => (
            <option key={c.id} value={i}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* ── Cluster mismatch warning ───────────────────────────────────────── */}
      {connected && (
        <div className="flex items-start gap-3 px-4 py-3 bg-yellow-900/30 border border-yellow-700/50 rounded-xl">
          <span className="text-yellow-400 text-lg leading-none shrink-0">⚠</span>
          <div className="text-sm text-yellow-300">
            Ensure your Solana wallet is set to{' '}
            <strong>{expectedClusterLabel}</strong>.
            <span className="block text-xs text-yellow-500 mt-0.5">
              Open your wallet (e.g. Phantom → Settings → Change Network) and select{' '}
              <strong>{expectedClusterLabel}</strong> to match this cluster.
            </span>
          </div>
        </div>
      )}

      {/* ── Config banners ─────────────────────────────────────────────────── */}
      {isConfigured ? (
        <div className="space-y-2">
          <ConfigBanner label="Program ID" value={programId} />
          <ConfigBanner label="OFT Store" value={oftStore} />
        </div>
      ) : (
        <div className="px-3 py-2 bg-yellow-900/30 border border-yellow-700/50 rounded-lg text-xs text-yellow-400">
          No addresses configured for <strong>{clusterCfg.label}</strong>. Set{' '}
          <code className="bg-yellow-900/50 px-1 rounded">
            VITE_SOLANA_{clusterCfg.id.toUpperCase()}_PROGRAM_ID
          </code>{' '}
          and{' '}
          <code className="bg-yellow-900/50 px-1 rounded">
            VITE_SOLANA_{clusterCfg.id.toUpperCase()}_OFT_STORE
          </code>{' '}
          in your <code className="bg-yellow-900/50 px-1 rounded">.env</code>.
        </div>
      )}

      {/* ── Wallet + Refresh ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <WalletMultiButton style={{ height: '38px', fontSize: '14px', borderRadius: '8px' }} />

        <button
          onClick={() => void readState()}
          disabled={loading || !isConfigured}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-semibold transition disabled:opacity-50"
        >
          {loading ? 'Reading…' : 'Refresh'}
        </button>

        {connected && isAdmin && (
          <span className="px-2 py-0.5 bg-purple-900 text-purple-300 border border-purple-700 rounded text-xs font-semibold">
            Admin
          </span>
        )}
        {connected && isPendingAdmin && (
          <span className="px-2 py-0.5 bg-indigo-900 text-indigo-300 border border-indigo-700 rounded text-xs font-semibold">
            Pending Admin
          </span>
        )}
        {connected && isPauser && (
          <span className="px-2 py-0.5 bg-orange-900 text-orange-300 border border-orange-700 rounded text-xs font-semibold">
            Pauser
          </span>
        )}
        {connected && isUnpauser && (
          <span className="px-2 py-0.5 bg-teal-900 text-teal-300 border border-teal-700 rounded text-xs font-semibold">
            Unpauser
          </span>
        )}
      </div>

      {/* ── Current state ─────────────────────────────────────────────────── */}
      {storeInfo && (
        <div className={`rounded-xl p-4 space-y-3 transition-colors duration-700 ${stateFlash ? 'bg-green-900/40 border border-green-700/60' : 'bg-gray-800'}`}>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
            Current State
            {stateFlash && <span className="ml-2 text-green-400 font-normal normal-case">✓ updated</span>}
          </h3>
          <SolStateRow label="Admin" value={storeInfo.admin.toBase58()} />
          {storeInfo.pendingAdmin && (
            <SolStateRow label="Pending Admin" value={storeInfo.pendingAdmin.toBase58()} highlight />
          )}
          <div className="flex items-center justify-between py-2 border-b border-gray-700">
            <span className="text-sm text-gray-400">Paused</span>
            {storeInfo.paused ? (
              <span className="px-2 py-0.5 bg-red-900/60 text-red-300 border border-red-700 rounded text-xs font-semibold">Paused</span>
            ) : (
              <span className="px-2 py-0.5 bg-green-900/60 text-green-300 border border-green-700 rounded text-xs font-semibold">Active</span>
            )}
          </div>
          {storeInfo.pauser && (
            <SolStateRow label="Pauser" value={storeInfo.pauser.toBase58()} />
          )}
          {storeInfo.unpauser && (
            <SolStateRow label="Unpauser" value={storeInfo.unpauser.toBase58()} />
          )}
          <SolStateRow
            label="Developer"
            value={storeInfo.developer.toBase58()}
            dim={storeInfo.developer.toBase58() === NULL_PUBKEY}
          />
          <div className="flex items-center justify-between py-2 border-b border-gray-700">
            <span className="text-sm text-gray-400">Developer Enabled</span>
            <StatusBadge enabled={storeInfo.developerEnabled} />
          </div>
          <SolStateRow
            label="LZ Delegate"
            value={storeInfo.delegate?.toBase58() ?? '—'}
            dim={!storeInfo.delegate}
          />
        </div>
      )}

      {/* ── Write actions ─────────────────────────────────────────────────── */}
      {connected && isConfigured && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
            Actions{' '}
            {!isAdmin && !canPause && !canUnpause && (
              <span className="text-yellow-500 normal-case font-normal">
                (requires Admin wallet)
              </span>
            )}
          </h3>

          {/* ── Pause / Unpause ──────────────────────────────────────────── */}
          {(canPause || canUnpause) && (
            <div className={`rounded-xl p-4 space-y-3 border ${
              storeInfo?.paused
                ? 'bg-red-900/20 border-red-700/50'
                : 'bg-gray-800 border-transparent'
            }`}>
              <p className="text-sm font-medium text-gray-200">Emergency Pause</p>
              <p className="text-xs text-gray-500">
                Halts all OFT transfers. Pause requires the <em>pauser</em> key (or admin if no
                pauser is set); unpause requires the <em>unpauser</em> key (or admin).
              </p>
              <div className="flex gap-3">
                <SolActionButton
                  onClick={handlePause}
                  label="Pause"
                  disabled={!canPause || (storeInfo?.paused ?? false)}
                  variant="danger"
                />
                <SolActionButton
                  onClick={handleUnpause}
                  label="Unpause"
                  disabled={!canUnpause || !(storeInfo?.paused ?? false)}
                  variant="success"
                />
              </div>
              {txStatus.card === 'pause' && <TxStatus status={txStatus} />}
            </div>
          )}

          <div className={`bg-gray-800 rounded-xl p-4 space-y-3 ${!isAdmin ? 'opacity-60' : ''}`}>
            <p className="text-sm font-medium text-gray-200">Set Pauser / Unpauser</p>
            <p className="text-xs text-gray-500">
              Designate which keys can pause and unpause. Leave blank to clear (falls back to
              admin). Admin only.
            </p>
            <AddressInput
              placeholder="Pauser public key (base58, blank to clear)"
              value={newPauserAddress}
              onChange={setNewPauserAddress}
            />
            <SolActionButton onClick={handleSetPauser} label="Set Pauser" disabled={!isAdmin} />
            <AddressInput
              placeholder="Unpauser public key (base58, blank to clear)"
              value={newUnpauserAddress}
              onChange={setNewUnpauserAddress}
            />
            <SolActionButton onClick={handleSetUnpauser} label="Set Unpauser" disabled={!isAdmin} />
            {txStatus.card === 'pauser' && <TxStatus status={txStatus} />}
          </div>

          <div className={`bg-gray-800 rounded-xl p-4 space-y-3 ${!isAdmin ? 'opacity-60' : ''}`}>
            <p className="text-sm font-medium text-gray-200">Transfer Admin (two-step)</p>
            <p className="text-xs text-gray-500">
              Proposes a new admin. The address must call <em>Accept Admin</em> to take effect.
              The current admin retains control until then.
            </p>
            <AddressInput
              placeholder="New admin public key (base58)"
              value={newAdminAddress}
              onChange={setNewAdminAddress}
            />
            <SolActionButton onClick={handleSetAdmin} label="Transfer Admin" disabled={!isAdmin} />
            {txStatus.card === 'admin' && <TxStatus status={txStatus} />}
          </div>

          {isPendingAdmin && (
            <div className="bg-indigo-900/30 border border-indigo-700/50 rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-indigo-200">Accept Admin</p>
              <p className="text-xs text-indigo-400">
                Your wallet is the pending admin. Sign to complete the admin transfer.
              </p>
              <SolActionButton
                onClick={handleAcceptAdmin}
                label="Accept Admin"
                variant="primary"
              />
              {txStatus.card === 'admin' && <TxStatus status={txStatus} />}
            </div>
          )}

          <div className={`bg-gray-800 rounded-xl p-4 space-y-3 ${!isAdmin ? 'opacity-60' : ''}`}>
            <p className="text-sm font-medium text-gray-200">Set Developer</p>
            <p className="text-xs text-gray-500">
              Directly sets a new developer address (admin only). Pass the system program address (
              <code className="bg-gray-700 px-1 rounded">111…111</code>) to remove the developer.
            </p>
            <AddressInput
              placeholder="New developer public key (base58)"
              value={newDevAddress}
              onChange={setNewDevAddress}
            />
            <SolActionButton onClick={handleSetDeveloper} label="Set Developer" disabled={!isAdmin} />
            {txStatus.card === 'set' && <TxStatus status={txStatus} />}
          </div>

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
            {txStatus.card === 'toggle' && <TxStatus status={txStatus} />}
          </div>

          <div className={`bg-gray-800 rounded-xl p-4 space-y-3 ${!isAdmin ? 'opacity-60' : ''}`}>
            <p className="text-sm font-medium text-gray-200">Set LZ Delegate</p>
            <p className="text-xs text-gray-500">
              Updates the LayerZero endpoint delegate — the key allowed to call{' '}
              <code className="bg-gray-700 px-1 rounded">initSendLibrary</code>,{' '}
              <code className="bg-gray-700 px-1 rounded">initReceiveLibrary</code>, and{' '}
              <code className="bg-gray-700 px-1 rounded">setOappConfig</code> on the LZ endpoint.
              Set this to the developer key so the developer can configure peers without
              needing the admin key again.
            </p>
            {storeInfo?.delegate && (
              <p className="text-xs text-gray-500">
                Current delegate:{' '}
                <span className="font-mono text-gray-300">{storeInfo.delegate.toBase58()}</span>
              </p>
            )}
            <AddressInput
              placeholder="New delegate public key (base58)"
              value={newDelegateAddress}
              onChange={setNewDelegateAddress}
            />
            <SolActionButton onClick={handleSetDelegate} label="Set Delegate" disabled={!isAdmin} />
            {txStatus.card === 'delegate' && <TxStatus status={txStatus} />}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small local components ─────────────────────────────────────────────────────

function ConfigBanner({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span className="text-xs font-mono text-gray-300 break-all">{value}</span>
    </div>
  );
}

function SolStateRow({ label, value, dim, highlight }: { label: string; value: string; dim?: boolean; highlight?: boolean }) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-gray-700 gap-4">
      <span className="text-sm text-gray-400 shrink-0">{label}</span>
      <span className={`text-sm font-mono break-all text-right ${dim ? 'text-gray-600' : highlight ? 'text-yellow-300' : 'text-gray-200'}`}>
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
    danger:  'bg-red-600 hover:bg-red-700',
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


