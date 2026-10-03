import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  Hash,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  FlaskConical,
} from "lucide-react";
import { getRunDetails, getSuites } from "../api/client";
import DiffViewer from "../components/DiffViewer";
import StatusBadge from "../components/StatusBadge";

function SummaryCard({ icon: Icon, label, value, tone = "default" }) {
  const tones = {
    default: "text-slate-100",
    green: "text-emerald-300",
    red: "text-rose-300",
    amber: "text-amber-300",
    mono: "font-mono text-slate-100",
  };
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className={`text-xl font-semibold tracking-tight ${tones[tone]}`}>{value}</p>
    </div>
  );
}

function AssertionRow({ assertion }) {
  return (
    <div
      className={`flex items-start gap-2.5 rounded-lg px-3 py-2 text-sm ${
        assertion.passed
          ? "bg-emerald-500/5 text-emerald-200 ring-1 ring-emerald-500/20"
          : "bg-rose-500/5 text-rose-200 ring-1 ring-rose-500/20"
      }`}
    >
      {assertion.passed ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
      )}
      <div className="min-w-0">
        <p className="font-medium">{assertion.name}</p>
        {assertion.details && (
          <p className="mt-0.5 text-xs opacity-70">{assertion.details}</p>
        )}
      </div>
    </div>
  );
}

function ResultCard({ result, index }) {
  const [open, setOpen] = useState(true);

  return (
    <div
      className={`overflow-hidden rounded-2xl border ${
        result.passed ? "border-emerald-500/20" : "border-rose-500/25"
      } bg-zinc-900/60`}
    >
      {/* Card header */}
      <div
        className={`flex cursor-pointer items-center gap-3 px-5 py-4 ${
          result.passed ? "bg-emerald-500/5" : "bg-rose-500/5"
        }`}
        onClick={() => setOpen((o) => !o)}
      >
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            result.passed
              ? "bg-emerald-500/20 text-emerald-300"
              : "bg-rose-500/20 text-rose-300"
          }`}
        >
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-slate-100">
              Test Case #{result.test_case_id}
            </p>
            <StatusBadge status={result.passed ? "passed" : "failed"} />
          </div>
          <div className="mt-0.5 flex flex-wrap gap-3 text-xs text-slate-500">
            {result.latency_ms != null && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {result.latency_ms.toFixed(0)} ms
              </span>
            )}
            {result.cost_usd != null && (
              <span className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                ${result.cost_usd.toFixed(6)}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-slate-500">
          {!result.passed && result.failure_reasons?.length > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-xs text-rose-300">
              <AlertTriangle className="h-3 w-3" />
              {result.failure_reasons.length} reason{result.failure_reasons.length !== 1 ? "s" : ""}
            </span>
          )}
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>

      {open && (
        <div className="px-5 pb-5 pt-4 space-y-5">
          {/* Failure reasons */}
          {!result.passed && result.failure_reasons?.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-400">
                Failure Reasons
              </p>
              <ul className="space-y-1.5">
                {result.failure_reasons.map((reason, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-200 ring-1 ring-rose-500/20"
                  >
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Assertions */}
          {result.assertions?.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Assertions ({result.assertions.filter((a) => a.passed).length}/
                {result.assertions.length} passed)
              </p>
              <div className="space-y-2">
                {result.assertions.map((assertion, i) => (
                  <AssertionRow key={i} assertion={assertion} />
                ))}
              </div>
            </div>
          )}

          {/* Diff viewer */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Output Comparison
            </p>
            <DiffViewer
              baseline={result.baseline_output}
              candidate={result.candidate_output}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function RunDetails() {
  const { runId } = useParams();
  const [run, setRun] = useState(null);
  const [suiteName, setSuiteName] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getRunDetails(runId);
        if (!cancelled) {
          setRun(data);
          // Try to fetch suite name
          try {
            const suites = await getSuites();
            const suite = suites.find((s) => s.id === data.suite_id);
            if (suite && !cancelled) setSuiteName(suite.name);
          } catch {
            // Suite name is non-critical
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load run details.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      </div>
    );
  }

  if (!run) return null;

  const passRate =
    run.total_passed + run.total_failed > 0
      ? `${((run.total_passed / (run.total_passed + run.total_failed)) * 100).toFixed(1)}%`
      : "—";

  const sortedResults = [...(run.results || [])].sort((a, b) =>
    a.passed === b.passed ? 0 : a.passed ? 1 : -1
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link
          to={suiteName ? `/suites/${run.suite_id}` : "/"}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {suiteName ? `Back to "${suiteName}"` : "Back to Dashboard"}
        </Link>
        <div className="mt-3 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
              Run #{run.run_id}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {suiteName ? (
                <>
                  Suite:{" "}
                  <Link
                    to={`/suites/${run.suite_id}`}
                    className="text-emerald-400 hover:underline"
                  >
                    {suiteName}
                  </Link>
                </>
              ) : (
                `Suite #${run.suite_id}`
              )}
            </p>
          </div>
          <StatusBadge status={run.status} />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <SummaryCard icon={Hash} label="Run ID" value={`#${run.run_id}`} tone="mono" />
        <SummaryCard
          icon={CheckCircle2}
          label="Passed"
          value={run.total_passed}
          tone="green"
        />
        <SummaryCard
          icon={XCircle}
          label="Failed"
          value={run.total_failed}
          tone={run.total_failed > 0 ? "red" : "default"}
        />
        <SummaryCard
          icon={FlaskConical}
          label="Pass Rate"
          value={passRate}
          tone={run.total_failed === 0 ? "green" : "amber"}
        />
        <SummaryCard
          icon={Clock}
          label="Avg Latency"
          value={
            run.avg_latency_ms != null
              ? `${run.avg_latency_ms.toFixed(0)} ms`
              : "—"
          }
        />
        <SummaryCard
          icon={DollarSign}
          label="Total Cost"
          value={`$${run.total_cost_usd.toFixed(6)}`}
          tone="mono"
        />
      </div>

      {/* Per-case results */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-slate-100">
          Test Results
          <span className="ml-2 text-sm font-normal text-slate-500">
            ({run.results?.length ?? 0} cases)
          </span>
        </h2>

        {run.results?.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-700 py-12 text-center text-slate-500">
            No test results found for this run.
          </div>
        ) : (
          <div className="space-y-4">
            {sortedResults.map((result, i) => (
              <ResultCard key={result.test_case_id} result={result} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
