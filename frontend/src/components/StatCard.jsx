export default function StatCard({ title, value, icon: Icon, badge, hint }) {
  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 shadow-glow">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-400">{title}</p>
        {Icon ? (
          <span className="rounded-lg bg-zinc-800 p-2 text-emerald-300">
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex items-end gap-2">
        <p className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">{value}</p>
        {badge ? (
          <span className="mb-0.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
            {badge}
          </span>
        ) : null}
      </div>
      {hint ? <p className="mt-2 text-xs text-slate-500">{hint}</p> : null}
    </article>
  );
}
