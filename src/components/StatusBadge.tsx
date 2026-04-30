interface Props {
  enabled: boolean;
}

export default function StatusBadge({ enabled }: Props) {
  return enabled ? (
    <span className="px-2 py-0.5 bg-green-900/60 text-green-300 border border-green-700 rounded text-xs font-semibold">
      Enabled
    </span>
  ) : (
    <span className="px-2 py-0.5 bg-red-900/60 text-red-300 border border-red-700 rounded text-xs font-semibold">
      Disabled
    </span>
  );
}
