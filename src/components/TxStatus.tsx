interface Props {
  status: { state: 'idle' | 'pending' | 'success' | 'error'; msg: string };
}

export default function TxStatus({ status }: Props) {
  if (status.state === 'idle' || !status.msg) return null;

  const styles = {
    pending: 'bg-blue-900/40 border-blue-700 text-blue-300',
    success: 'bg-green-900/40 border-green-700 text-green-300',
    error: 'bg-red-900/40 border-red-700 text-red-300',
  };

  const icons = {
    pending: (
      <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
    ),
    success: <span className="shrink-0">✓</span>,
    error: <span className="shrink-0">✗</span>,
  };

  return (
    <div
      className={`flex items-center gap-2 px-4 py-3 border rounded-lg text-sm ${styles[status.state]}`}
    >
      {icons[status.state]}
      <span className="break-all">{status.msg}</span>
    </div>
  );
}
