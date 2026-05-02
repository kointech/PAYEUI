import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWalletClient, useChainId, useSwitchChain } from 'wagmi';
import { isAddress, zeroAddress, createPublicClient, http, type Address } from 'viem';
import { EVM_CHAINS, PAYE_ABI } from '../config/evm';
import AddressInput from './AddressInput';
import StatusBadge from './StatusBadge';
import TxStatus from './TxStatus';

interface ContractState {
  owner: Address;
  pendingOwner: Address;
  developer: Address;
  developerEnabled: boolean;
  pendingDeveloper: Address;
}

export default function LineaPanel() {
  const [chainIdx, setChainIdx] = useState(0);
  const [newOwnerAddress, setNewOwnerAddress] = useState('');
  const [newDevAddress, setNewDevAddress] = useState('');
  const [contractState, setContractState] = useState<ContractState | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [txState, setTxState] = useState<{
    state: 'idle' | 'pending' | 'success' | 'error';
    msg: string;
  }>({ state: 'idle', msg: '' });

  const { address: account, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const connectedChainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const chainCfg = EVM_CHAINS[chainIdx];
  const contractAddress = chainCfg.contractAddress;
  const rpcUrl = chainCfg.rpcUrl;
  const validAddress = isAddress(contractAddress) ? (contractAddress as Address) : undefined;
  const isWrongChain = isConnected && connectedChainId !== chainCfg.chain.id;

  // ── Read — viem public client, any chain ────────────────────────────────────

  const readState = useCallback(async () => {
    if (!validAddress) return;
    setIsFetching(true);
    try {
      const client = createPublicClient({ transport: http(rpcUrl) });
      const [owner, pendingOwner, developer, developerEnabled, pendingDeveloper] = await Promise.all([
        client.readContract({ address: validAddress, abi: PAYE_ABI, functionName: 'owner' }),
        client.readContract({ address: validAddress, abi: PAYE_ABI, functionName: 'pendingOwner' }),
        client.readContract({ address: validAddress, abi: PAYE_ABI, functionName: 'developer' }),
        client.readContract({ address: validAddress, abi: PAYE_ABI, functionName: 'developerEnabled' }),
        client.readContract({ address: validAddress, abi: PAYE_ABI, functionName: 'pendingDeveloper' }),
      ]);
      setContractState({ owner, pendingOwner, developer, developerEnabled, pendingDeveloper });
    } catch (e) {
      setContractState(null);
      setTxState({ state: 'error', msg: `Read failed: ${(e as Error).message}` });
    } finally {
      setIsFetching(false);
    }
  }, [validAddress, rpcUrl]);

  // Auto-read on chain / token change
  useEffect(() => {
    setContractState(null);
    setTxState({ state: 'idle', msg: '' });
    if (validAddress) void readState();
  }, [validAddress, rpcUrl, readState]);

  // ── Write — wallet client, whatever network it is on ───────────────────────

  async function runWrite(label: string, fn: () => Promise<`0x${string}`>) {
    if (!walletClient || !validAddress) return;
    setIsBusy(true);
    setTxState({ state: 'pending', msg: 'Waiting for wallet signature…' });
    try {
      const hash = await fn();
      setTxState({ state: 'pending', msg: `Confirming… (${hash.slice(0, 10)}…)` });
      const client = createPublicClient({ transport: http(rpcUrl) });
      await client.waitForTransactionReceipt({ hash });
      setTxState({ state: 'success', msg: `${label} confirmed.` });
      await readState();
    } catch (e) {
      const msg = (e as { shortMessage?: string }).shortMessage ?? (e as Error).message;
      setTxState({ state: 'error', msg });
    } finally {
      setIsBusy(false);
    }
  }

  function handleSetDeveloper() {
    if (!isAddress(newDevAddress)) {
      alert('Enter a valid Ethereum address.');
      return;
    }
    void runWrite('Propose Developer', () =>
      walletClient!.writeContract({
        address: validAddress!,
        abi: PAYE_ABI,
        functionName: 'setDeveloper',
        args: [newDevAddress as Address],
      }),
    );
  }

  function handleTransferOwnership() {
    if (!isAddress(newOwnerAddress)) { alert('Enter a valid Ethereum address.'); return; }
    if (newOwnerAddress.toLowerCase() === contractState?.owner.toLowerCase()) {
      setTxState({ state: 'error', msg: 'This address is already the owner.' });
      return;
    }
    void runWrite('Transfer Ownership', () =>
      walletClient!.writeContract({
        address: validAddress!,
        abi: PAYE_ABI,
        functionName: 'transferOwnership',
        args: [newOwnerAddress as Address],
      }),
    );
  }

  function handleRenounceOwnership() {
    if (!window.confirm(
      'Renounce ownership?\n\nThis permanently removes the owner address and CANNOT be undone. The contract will have no owner.',
    )) return;
    void runWrite('Renounce Ownership', () =>
      walletClient!.writeContract({ address: validAddress!, abi: PAYE_ABI, functionName: 'renounceOwnership' }),
    );
  }

  const handleAcceptOwnership = () =>
    void runWrite('Accept Ownership', () =>
      walletClient!.writeContract({ address: validAddress!, abi: PAYE_ABI, functionName: 'acceptOwnership' }),
    );

  const handleAcceptDeveloper = () =>
    void runWrite('Accept Developer', () =>
      walletClient!.writeContract({ address: validAddress!, abi: PAYE_ABI, functionName: 'acceptDeveloper' }),
    );

  const handleEnableDeveloper = () =>
    void runWrite('Enable Developer', () =>
      walletClient!.writeContract({ address: validAddress!, abi: PAYE_ABI, functionName: 'enableDeveloper' }),
    );

  const handleDisableDeveloper = () =>
    void runWrite('Disable Developer', () =>
      walletClient!.writeContract({ address: validAddress!, abi: PAYE_ABI, functionName: 'disableDeveloper' }),
    );

  // ── Role detection ─────────────────────────────────────────────────────────

  const isOwner =
    !!account && !!contractState?.owner &&
    account.toLowerCase() === contractState.owner.toLowerCase();

  const isPendingOwner =
    !!account &&
    !!contractState?.pendingOwner &&
    contractState.pendingOwner !== zeroAddress &&
    account.toLowerCase() === contractState.pendingOwner.toLowerCase();

  const isPendingDev =
    !!account &&
    !!contractState?.pendingDeveloper &&
    contractState.pendingDeveloper !== zeroAddress &&
    account.toLowerCase() === contractState.pendingDeveloper.toLowerCase();

  // ── Helpers ────────────────────────────────────────────────────────────────

  function selectChain(idx: number) {
    setChainIdx(idx);
    setContractState(null);
    setTxState({ state: 'idle', msg: '' });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Network dropdown ───────────────────────────────────────────────── */}
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
          Network
        </label>
        <select
          value={chainIdx}
          onChange={(e) => selectChain(Number(e.target.value))}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-blue-500"
        >
          {EVM_CHAINS.map((c, i) => (
            <option key={c.chain.id} value={i}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* ── Contract address banner ───────────────────────────────────────── */}
      {validAddress ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg">
          <span className="text-xs text-gray-500 shrink-0">Contract</span>
          <span className="text-xs font-mono text-gray-300 break-all">{contractAddress}</span>
        </div>
      ) : (
        <div className="px-3 py-2 bg-yellow-900/30 border border-yellow-700/50 rounded-lg text-xs text-yellow-400">
          No contract configured for <strong>{chainCfg.label}</strong>.{' '}
          Set{' '}
          <code className="bg-yellow-900/50 px-1 rounded">
            VITE_{chainCfg.envPrefix}_CONTRACT
          </code>{' '}
          in your <code className="bg-yellow-900/50 px-1 rounded">.env</code>.
        </div>
      )}

      {/* ── Refresh ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => void readState()}
          disabled={!validAddress || isFetching}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-semibold transition disabled:opacity-50"
        >
          {isFetching ? 'Reading…' : 'Refresh'}
        </button>

        {isConnected && (
            <div className="flex gap-2">
              {isOwner && (
                <span className="px-2 py-0.5 bg-blue-900 text-blue-300 border border-blue-700 rounded text-xs font-semibold">
                  Owner
                </span>
              )}
              {isPendingOwner && (
                <span className="px-2 py-0.5 bg-indigo-900 text-indigo-300 border border-indigo-700 rounded text-xs font-semibold">
                  Pending Owner
                </span>
              )}
              {isPendingDev && (
                <span className="px-2 py-0.5 bg-yellow-900 text-yellow-300 border border-yellow-700 rounded text-xs font-semibold">
                  Pending Developer
                </span>
              )}
            </div>
          )}
      </div>

      {/* ── Current state ─────────────────────────────────────────────────── */}
      {contractState && (
        <div className="bg-gray-800 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
            Current State
          </h3>
          <StateRow label="Owner" value={contractState.owner} />
          {contractState.pendingOwner !== zeroAddress && (
            <StateRow label="Pending Owner" value={contractState.pendingOwner} highlight />
          )}
          <StateRow label="Developer" value={contractState.developer} />
          <div className="flex items-center justify-between py-2 border-b border-gray-700">
            <span className="text-sm text-gray-400">Developer Enabled</span>
            <StatusBadge enabled={contractState.developerEnabled} />
          </div>
          {contractState.pendingDeveloper !== zeroAddress && (
            <StateRow label="Pending Developer" value={contractState.pendingDeveloper} highlight />
          )}
        </div>
      )}

      {/* ── Wrong chain warning ───────────────────────────────────────────── */}
      {isConnected && isWrongChain && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-yellow-900/30 border border-yellow-700/50 rounded-xl">
          <div className="text-sm text-yellow-300">
            Wallet is on a different network. Switch to{' '}
            <strong>{chainCfg.label}</strong> to sign transactions.
          </div>
          <button
            onClick={() => switchChain({ chainId: chainCfg.chain.id })}
            disabled={isSwitching}
            className="shrink-0 px-4 py-2 bg-yellow-600 hover:bg-yellow-500 rounded-lg text-sm font-semibold transition disabled:opacity-50"
          >
            {isSwitching ? 'Switching…' : `Switch to ${chainCfg.label}`}
          </button>
        </div>
      )}

      {/* ── Write actions ─────────────────────────────────────────────────── */}
      {isConnected && validAddress && !isWrongChain && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
            Actions{' '}
            {!isOwner && !isPendingDev && (
              <span className="text-yellow-500 normal-case font-normal">
                (requires Owner or Pending Developer wallet)
              </span>
            )}
          </h3>

          {isOwner && (
            <div className="bg-gray-800 rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-gray-200">Ownership</p>

              <p className="text-xs text-gray-500">
                Propose a new owner (two-step). The address must call{' '}
                <em>Accept Ownership</em> to take effect. The current owner retains control until
                then.
              </p>
              <AddressInput
                placeholder="New owner address (0x…)"
                value={newOwnerAddress}
                onChange={setNewOwnerAddress}
              />
              <ActionButton onClick={handleTransferOwnership} label="Transfer Ownership" busy={isBusy} />

              <hr className="border-gray-700" />

              <p className="text-xs text-gray-500">
                Permanently removes the owner. No further owner-gated actions will be possible.{' '}
                <strong className="text-red-400">This cannot be undone.</strong>
              </p>
              <ActionButton
                onClick={handleRenounceOwnership}
                label="Renounce Ownership"
                busy={isBusy}
                variant="danger"
              />
            </div>
          )}

          {isPendingOwner && (
            <div className="bg-indigo-900/30 border border-indigo-700/50 rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-indigo-200">Accept Ownership</p>
              <p className="text-xs text-indigo-400">
                Your wallet is the pending owner. Sign to complete the ownership transfer.
              </p>
              <ActionButton
                onClick={handleAcceptOwnership}
                label="Accept Ownership"
                busy={isBusy}
                variant="primary"
              />
            </div>
          )}

          {isOwner && (
            <div className="bg-gray-800 rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-gray-200">Propose Developer (two-step)</p>
              <p className="text-xs text-gray-500">
                Proposes a new developer. The address must call <em>Accept Developer</em> to take
                effect. Pass <code className="bg-gray-700 px-1 rounded">0x000…000</code> to clear
                immediately.
              </p>
              <AddressInput
                placeholder="New developer address (0x…)"
                value={newDevAddress}
                onChange={setNewDevAddress}
              />
              <ActionButton onClick={handleSetDeveloper} label="Propose Developer" busy={isBusy} />
            </div>
          )}

          {isPendingDev && (
            <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-yellow-200">Accept Developer Role</p>
              <p className="text-xs text-yellow-400">
                Your wallet is the pending developer. Sign to complete the transfer.
              </p>
              <ActionButton
                onClick={handleAcceptDeveloper}
                label="Accept Developer"
                busy={isBusy}
                variant="warning"
              />
            </div>
          )}

          {isOwner && (
            <div className="bg-gray-800 rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-gray-200">Toggle Developer Role</p>
              <div className="flex gap-3">
                <ActionButton
                  onClick={handleEnableDeveloper}
                  label="Enable Developer"
                  disabled={contractState?.developerEnabled === true}
                  busy={isBusy}
                  variant="success"
                />
                <ActionButton
                  onClick={handleDisableDeveloper}
                  label="Disable Developer"
                  disabled={contractState?.developerEnabled === false}
                  busy={isBusy}
                  variant="danger"
                />
              </div>
            </div>
          )}
        </div>
      )}

      <TxStatus status={txState} />
    </div>
  );
}

// ── Small local components ─────────────────────────────────────────────────────

function StateRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-gray-700 gap-4">
      <span className="text-sm text-gray-400 shrink-0">{label}</span>
      <span
        className={`text-sm font-mono break-all text-right ${
          highlight ? 'text-yellow-300' : 'text-gray-200'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function ActionButton({
  onClick,
  label,
  disabled,
  busy,
  variant = 'primary',
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  busy?: boolean;
  variant?: 'primary' | 'success' | 'danger' | 'warning';
}) {
  const colors = {
    primary: 'bg-blue-600 hover:bg-blue-700',
    success: 'bg-green-600 hover:bg-green-700',
    danger: 'bg-red-600 hover:bg-red-700',
    warning: 'bg-yellow-600 hover:bg-yellow-700',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      className={`px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed ${colors[variant]}`}
    >
      {busy ? 'Processing…' : label}
    </button>
  );
}

