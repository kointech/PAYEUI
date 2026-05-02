import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';

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
  developer: PublicKey;
  developerEnabled: boolean;
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
  o += 1; // paused

  // pauser: Option<Pubkey>
  const hasPauser = rawData[o] === 1;
  o += 1;
  if (hasPauser) o += 32;

  // unpauser: Option<Pubkey>
  const hasUnpauser = rawData[o] === 1;
  o += 1;
  if (hasUnpauser) o += 32;

  // pending_admin: Option<Pubkey>
  const hasPendingAdmin = rawData[o] === 1;
  o += 1;
  const pendingAdmin = hasPendingAdmin ? new PublicKey(rawData.slice(o, o + 32)) : null;
  if (hasPendingAdmin) o += 32;

  const developer = new PublicKey(rawData.slice(o, o + 32));
  o += 32;

  const developerEnabled = rawData[o] === 1;

  return { admin, pendingAdmin, developer, developerEnabled };
}

// ── Read helpers ───────────────────────────────────────────────────────────────

/** Fetch and parse the OFTStore for the given program + store address. */
export async function fetchOFTStore(
  connection: Connection,
  oftStore: PublicKey,
): Promise<OFTStoreInfo> {
  const accountInfo = await connection.getAccountInfo(oftStore, 'confirmed');
  if (!accountInfo) throw new Error('OFT Store account not found.');
  return parseOFTStore(new Uint8Array(accountInfo.data));
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
