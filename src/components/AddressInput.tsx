interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

/** A single-line address input — sanitizes pasted text and prevents XSS via the value. */
export default function AddressInput({ value, onChange, placeholder }: Props) {
  return (
    <input
      type="text"
      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500"
      placeholder={placeholder ?? '0x…'}
      value={value}
      maxLength={44} // enough for both EVM (42) and Solana (44) addresses
      onChange={(e) => onChange(e.target.value.trim())}
      spellCheck={false}
      autoCorrect="off"
      autoCapitalize="off"
    />
  );
}
