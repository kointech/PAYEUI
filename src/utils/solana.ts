import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';

// ── LayerZero Endpoint ─────────────────────────────────────────────────────────
// Same program ID on both devnet and mainnet.
const LZ_ENDPOINT = new PublicKey('76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6');

/** Derive the oapp_registry PDA: seeds = ["OAppRegistry", oftStore] */
function deriveOappRegistry(oftStore: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('OAppRegistry'), oftStore.toBytes()],
    LZ_ENDPOINT,
  );
  return pda;
}

/** Derive the event_authority PDA: seeds = ["__event_authority"] */
function deriveEventAuthority(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('__event_authority')],
    LZ_ENDPOINT,
  );
  return pda;
}

// ── Discriminator helpers ──────────────────────────────────────────────────────

/** Compute the first 8 bytes of SHA-256("global:{name}") — Anchor's instruction discriminator. */
async function instructionDiscriminator(name: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(`global:${name}`);
  const hash = await crypto.subtle.digest('SHA-256', data as unknown as ArrayBuffer);
  return new Uint8Array(hash).slice(0, 8);
}

// Cache discriminators after first computation.
const _discCache: Record<string, Uint8Array> = {};
async function disc(name: string): Promise<Uint8Array> {
  if (!_discCache[name]) {
    _discCache[name] = await instructionDiscriminator(name);
  }
  return _discCache[name];
}

// ── SetOFTConfigParams variant indices (Rust enum order) ──────────────────────
// Admin = 0, Delegate = 1, DefaultFee = 2, Paused = 3,
// Pauser = 4, Unpauser = 5, Developer = 6, DeveloperEnabled = 7
const VARIANT_ADMIN = 0;
const VARIANT_DELEGATE = 1;
const VARIANT_PAUSER = 4;
const VARIANT_UNPAUSER = 5;
const VARIANT_DEVELOPER = 6;
const VARIANT_DEVELOPER_ENABLED = 7;

// ── Instruction builders ───────────────────────────────────────────────────────

/**
 * Build a `set_oft_config` instruction that proposes a new admin (two-step).
 * Admin signs — the new admin must then call `accept_admin` to finalise.
 */
export async function buildSetAdminIx(
  admin: PublicKey,
  oftStore: PublicKey,
  newAdmin: PublicKey,
  programId: PublicKey,
): Promise<TransactionInstruction> {
  const discriminator = await disc('set_oft_config');

  // Borsh layout: discriminator(8) + variant_u8(1) + pubkey(32) = 41 bytes
  const data = new Uint8Array(41);
  data.set(discriminator, 0);
  data[8] = VARIANT_ADMIN;
  data.set(newAdmin.toBytes(), 9);

  return new TransactionInstruction({
    keys: [
      { pubkey: admin, isSigner: true, isWritable: false },
      { pubkey: oftStore, isSigner: false, isWritable: true },
    ],
    programId,
    data: Buffer.from(data),
  });
}

/**
 * Build an `accept_admin` instruction.
 * Must be signed by the pending admin to complete the two-step admin transfer.
 */
export async function buildAcceptAdminIx(
  pendingAdmin: PublicKey,
  oftStore: PublicKey,
  programId: PublicKey,
): Promise<TransactionInstruction> {
  const discriminator = await disc('accept_admin');

  // No payload — discriminator only (8 bytes)
  return new TransactionInstruction({
    keys: [
      { pubkey: pendingAdmin, isSigner: true, isWritable: false },
      { pubkey: oftStore, isSigner: false, isWritable: true },
    ],
    programId,
    data: Buffer.from(discriminator),
  });
}

/**
 * Build a `set_pause` instruction (emergency pause / unpause).
 * Signer must be: pauser (to pause) or unpauser (to unpause) if set, otherwise admin for both.
 */
export async function buildSetPauseIx(
  signer: PublicKey,
  oftStore: PublicKey,
  paused: boolean,
  programId: PublicKey,
): Promise<TransactionInstruction> {
  const discriminator = await disc('set_pause');

  // Borsh layout: discriminator(8) + paused_bool(1) = 9 bytes
  const data = new Uint8Array(9);
  data.set(discriminator, 0);
  data[8] = paused ? 1 : 0;

  return new TransactionInstruction({
    keys: [
      { pubkey: signer, isSigner: true, isWritable: false },
      { pubkey: oftStore, isSigner: false, isWritable: true },
    ],
    programId,
    data: Buffer.from(data),
  });
}

/**
 * Build a `set_oft_config` instruction that sets the pauser address (admin only).
 * Pass `null` to clear the pauser (falls back to admin for pause).
 */
export async function buildSetPauserIx(
  admin: PublicKey,
  oftStore: PublicKey,
  pauser: PublicKey | null,
  programId: PublicKey,
): Promise<TransactionInstruction> {
  const discriminator = await disc('set_oft_config');

  // Borsh: discriminator(8) + variant(1) + Option<Pubkey> (1 or 33 bytes)
  const data = new Uint8Array(pauser ? 42 : 10);
  data.set(discriminator, 0);
  data[8] = VARIANT_PAUSER;
  if (pauser) { data[9] = 1; data.set(pauser.toBytes(), 10); } else { data[9] = 0; }

  return new TransactionInstruction({
    keys: [
      { pubkey: admin, isSigner: true, isWritable: false },
      { pubkey: oftStore, isSigner: false, isWritable: true },
    ],
    programId,
    data: Buffer.from(data),
  });
}

/**
 * Build a `set_oft_config` instruction that sets the unpauser address (admin only).
 * Pass `null` to clear the unpauser (falls back to admin for unpause).
 */
export async function buildSetUnpauserIx(
  admin: PublicKey,
  oftStore: PublicKey,
  unpauser: PublicKey | null,
  programId: PublicKey,
): Promise<TransactionInstruction> {
  const discriminator = await disc('set_oft_config');

  // Borsh: discriminator(8) + variant(1) + Option<Pubkey> (1 or 33 bytes)
  const data = new Uint8Array(unpauser ? 42 : 10);
  data.set(discriminator, 0);
  data[8] = VARIANT_UNPAUSER;
  if (unpauser) { data[9] = 1; data.set(unpauser.toBytes(), 10); } else { data[9] = 0; }

  return new TransactionInstruction({
    keys: [
      { pubkey: admin, isSigner: true, isWritable: false },
      { pubkey: oftStore, isSigner: false, isWritable: true },
    ],
    programId,
    data: Buffer.from(data),
  });
}

/**
 * Build a `set_oft_config` instruction that updates the LZ endpoint delegate.
 * Admin signs. Requires 5 remaining accounts for the endpoint CPI.
 * After this tx the delegate key can call initSendLibrary / setOappConfig etc.
 */
export async function buildSetDelegateIx(
  admin: PublicKey,
  oftStore: PublicKey,
  newDelegate: PublicKey,
  programId: PublicKey,
): Promise<TransactionInstruction> {
  const discriminator = await disc('set_oft_config');

  // Borsh layout: discriminator(8) + variant_u8(1) + pubkey(32) = 41 bytes
  const data = new Uint8Array(41);
  data.set(discriminator, 0);
  data[8] = VARIANT_DELEGATE;
  data.set(newDelegate.toBytes(), 9);

  const oappRegistry  = deriveOappRegistry(oftStore);
  const eventAuthority = deriveEventAuthority();

  return new TransactionInstruction({
    keys: [
      // Core accounts (set_oft_config)
      { pubkey: admin,    isSigner: true,  isWritable: false },
      { pubkey: oftStore, isSigner: false, isWritable: true  },
      // Remaining accounts for endpoint CPI (set_delegate)
      { pubkey: LZ_ENDPOINT,    isSigner: false, isWritable: false }, // [0] endpoint program
      { pubkey: oftStore,       isSigner: false, isWritable: false }, // [1] oapp (PDA signer)
      { pubkey: oappRegistry,   isSigner: false, isWritable: true  }, // [2] oapp_registry
      { pubkey: eventAuthority, isSigner: false, isWritable: false }, // [3] event_authority
      { pubkey: LZ_ENDPOINT,    isSigner: false, isWritable: false }, // [4] program (event_cpi)
    ],
    programId,
    data: Buffer.from(data),
  });
}

/**
 * Build a `set_oft_config` instruction that sets the developer address.
 * Admin signs — mirrors EVM `setDeveloper(address)`.
 */
export async function buildSetDeveloperIx(
  admin: PublicKey,
  oftStore: PublicKey,
  newDeveloper: PublicKey,
  programId: PublicKey,
): Promise<TransactionInstruction> {
  const discriminator = await disc('set_oft_config');

  // Borsh layout: discriminator(8) + variant_u8(1) + pubkey(32) = 41 bytes
  const data = new Uint8Array(41);
  data.set(discriminator, 0);
  data[8] = VARIANT_DEVELOPER;
  data.set(newDeveloper.toBytes(), 9);

  return new TransactionInstruction({
    keys: [
      { pubkey: admin, isSigner: true, isWritable: false },
      { pubkey: oftStore, isSigner: false, isWritable: true },
    ],
    programId,
    data: Buffer.from(data),
  });
}

/**
 * Build a `set_oft_config` instruction that enables or disables the developer role.
 * Admin signs — mirrors EVM `enableDeveloper()` / `disableDeveloper()`.
 */
export async function buildSetDeveloperEnabledIx(
  admin: PublicKey,
  oftStore: PublicKey,
  enabled: boolean,
  programId: PublicKey,
): Promise<TransactionInstruction> {
  const discriminator = await disc('set_oft_config');

  // Borsh layout: discriminator(8) + variant_u8(1) + bool(1) = 10 bytes
  const data = new Uint8Array(10);
  data.set(discriminator, 0);
  data[8] = VARIANT_DEVELOPER_ENABLED;
  data[9] = enabled ? 1 : 0;

  return new TransactionInstruction({
    keys: [
      { pubkey: admin, isSigner: true, isWritable: false },
      { pubkey: oftStore, isSigner: false, isWritable: true },
    ],
    programId,
    data: Buffer.from(data),
  });
}

// ── OFTStore account parser ────────────────────────────────────────────────────

/** Fields relevant to the Developer Admin UI. */
export interface OFTStoreInfo {
  admin: PublicKey;
  pendingAdmin: PublicKey | null;
  paused: boolean;
  pauser: PublicKey | null;
  unpauser: PublicKey | null;
  developer: PublicKey;
  developerEnabled: boolean;
  /** Current LZ endpoint delegate (from oapp_registry PDA). Null if not yet registered. */
  delegate: PublicKey | null;
}

/**
 * Parse the raw account data of an OFTStore PDA.
 *
 * OFTStore Borsh layout (Anchor discriminator = first 8 bytes):
 *   [8]  discriminator
 *   [1]  oft_type (enum u8)
 *   [8]  ld2sd_rate (u64 LE)
 *   [32] token_mint (Pubkey)
 *   [32] token_escrow (Pubkey)
 *   [32] endpoint_program (Pubkey)
 *   [1]  bump (u8)
 *   [8]  tvl_ld (u64 LE)
 *   [32] admin (Pubkey)
 *   [2]  default_fee_bps (u16 LE)
 *   [1]  paused (bool)
 *   [1+?] pauser (Option<Pubkey>): 0 = None | 1 + 32 = Some
 *   [1+?] unpauser (Option<Pubkey>)
 *   [1+?] pending_admin (Option<Pubkey>)
 *   [32] developer (Pubkey)
 *   [1]  developer_enabled (bool)
 */
export function parseOFTStore(rawData: Uint8Array): OFTStoreInfo {
  let o = 8; // skip Anchor discriminator

  o += 1;  // oft_type
  o += 8;  // ld2sd_rate
  o += 32; // token_mint
  o += 32; // token_escrow
  o += 32; // endpoint_program
  o += 1;  // bump
  o += 8;  // tvl_ld

  const admin = new PublicKey(rawData.slice(o, o + 32));
  o += 32; // admin

  o += 2; // default_fee_bps

  const paused = rawData[o] === 1;
  o += 1; // paused

  // pauser: Option<Pubkey>
  const hasPauser = rawData[o] === 1;
  o += 1;
  const pauser = hasPauser ? new PublicKey(rawData.slice(o, o + 32)) : null;
  if (hasPauser) o += 32;

  // unpauser: Option<Pubkey>
  const hasUnpauser = rawData[o] === 1;
  o += 1;
  const unpauser = hasUnpauser ? new PublicKey(rawData.slice(o, o + 32)) : null;
  if (hasUnpauser) o += 32;

  // pending_admin: Option<Pubkey>
  const hasPendingAdmin = rawData[o] === 1;
  o += 1;
  const pendingAdmin = hasPendingAdmin ? new PublicKey(rawData.slice(o, o + 32)) : null;
  if (hasPendingAdmin) o += 32;

  const developer = new PublicKey(rawData.slice(o, o + 32));
  o += 32;

  const developerEnabled = rawData[o] === 1;

  return { admin, pendingAdmin, paused, pauser, unpauser, developer, developerEnabled, delegate: null };
}

// ── Read helpers ───────────────────────────────────────────────────────────────

/** Fetch and parse the OFTStore, and also read the LZ endpoint delegate. */
export async function fetchOFTStore(
  connection: Connection,
  oftStore: PublicKey,
): Promise<OFTStoreInfo> {
  const oappRegistry = deriveOappRegistry(oftStore);

  const [storeAccount, registryAccount] = await connection.getMultipleAccountsInfo(
    [oftStore, oappRegistry],
    'confirmed',
  );
  if (!storeAccount) throw new Error('OFT Store account not found.');

  const info = parseOFTStore(new Uint8Array(storeAccount.data));

  // oapp_registry layout (Anchor): [8 discriminator][32 delegate][...]
  if (registryAccount && registryAccount.data.length >= 40) {
    info.delegate = new PublicKey(registryAccount.data.slice(8, 40));
  }

  return info;
}

// ── Transaction sender ─────────────────────────────────────────────────────────

/** Sign and send a single-instruction transaction via the Phantom wallet. */
export async function signAndSend(
  connection: Connection,
  ix: TransactionInstruction,
  feePayer: PublicKey,
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const phantom = (window as any).phantom?.solana ?? (window as any).solana;
  if (!phantom?.isPhantom && !phantom?.isConnected) {
    throw new Error('Phantom wallet not found or not connected.');
  }

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash('confirmed');

  const tx = new Transaction({
    feePayer,
    blockhash,
    lastValidBlockHeight,
  }).add(ix);

  const signed = await phantom.signTransaction(tx);
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
  });

  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    'confirmed',
  );

  return signature;
}

// ── RPC defaults ───────────────────────────────────────────────────────────────

export const SOLANA_MAINNET_RPC =
  import.meta.env.VITE_SOLANA_MAINNET_RPC ?? 'https://api.mainnet-beta.solana.com';
export const SOLANA_DEVNET_RPC =
  import.meta.env.VITE_SOLANA_DEVNET_RPC ?? 'https://api.devnet.solana.com';
