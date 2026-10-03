const styles = {
  passed: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  failed: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  running: "bg-amber-500/15 text-amber-200 ring-amber-500/30",
  pending: "bg-zinc-700/50 text-slate-300 ring-zinc-500/30",
  completed: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
};

const labels = {
  passed: "PASSED",
  failed: "FAILED",
  running: "RUNNING",
  pending: "PENDING",
  completed: "PASSED",
};

export default function StatusBadge({ status }) {
  const key = String(status || "pending").toLowerCase();
  const normalized = key === "pass" || key === "true" || key === "ok" ? "passed" : key;
  const tone = styles[normalized] || styles.pending;
  const label = labels[normalized] || String(status || "PENDING").toUpperCase();

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${tone}`}>
      {label}
    </span>
  );
}
