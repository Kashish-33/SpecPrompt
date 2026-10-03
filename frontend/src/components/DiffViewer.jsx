function tokenize(text) {
  return String(text || "").split(/(\s+)/);
}

function WordDiff({ text, other, tone }) {
  const otherSet = new Set(
    tokenize(other)
      .filter((token) => token.trim())
      .map((token) => token.toLowerCase()),
  );

  return (
    <p className="whitespace-pre-wrap break-words font-mono text-sm leading-6 text-slate-200">
      {tokenize(text).map((token, index) => {
        if (!token.trim()) {
          return <span key={`${token}-${index}`}>{token}</span>;
        }
        const unique = !otherSet.has(token.toLowerCase());
        if (!unique) {
          return <span key={`${token}-${index}`}>{token}</span>;
        }
        const cls =
          tone === "removed"
            ? "rounded bg-rose-500/20 px-0.5 text-rose-200"
            : "rounded bg-emerald-500/20 px-0.5 text-emerald-200";
        return (
          <span key={`${token}-${index}`} className={cls}>
            {token}
          </span>
        );
      })}
    </p>
  );
}

export default function DiffViewer({ baseline, candidate }) {
  const left = baseline || "—";
  const right = candidate || "—";

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/80">
        <header className="border-b border-zinc-800 bg-zinc-900/80 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Baseline Output
        </header>
        <div className="max-h-80 overflow-auto p-3">
          <WordDiff text={left} other={right} tone="removed" />
        </div>
      </section>
      <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/80">
        <header className="border-b border-zinc-800 bg-zinc-900/80 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Candidate Output
        </header>
        <div className="max-h-80 overflow-auto p-3">
          <WordDiff text={right} other={left} tone="added" />
        </div>
      </section>
    </div>
  );
}
