import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FlaskConical,
  Play,
  Pencil,
  Trash2,
  Plus,
  BarChart3,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import {
  getMetrics,
  getSuites,
  deleteSuite,
  executeRun,
  getSuiteRuns,
} from "../api/client";

function ConfirmModal({ suiteName, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-slate-50">Delete Suite?</h2>
        <p className="mt-2 text-sm text-slate-400">
          <span className="font-medium text-slate-200">"{suiteName}"</span> and all its test
          cases and run history will be permanently removed. This cannot be undone.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-zinc-600 hover:text-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 active:bg-rose-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();

  const [metrics, setMetrics] = useState(null);
  const [suites, setSuites] = useState([]);
  const [recentRuns, setRecentRuns] = useState([]);
  const [runningIds, setRunningIds] = useState(new Set());
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, s] = await Promise.all([getMetrics(), getSuites()]);
      setMetrics(m);
      setSuites(s);

      const runBatches = await Promise.allSettled(
        s.slice(0, 5).map((suite) => getSuiteRuns(suite.id))
      );
      const runs = [];
      runBatches.forEach((result, i) => {
        if (result.status === "fulfilled" && result.value.length > 0) {
          runs.push({ ...result.value[0], suiteName: s[i].name });
        }
      });
      runs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setRecentRuns(runs.slice(0, 8));
    } catch (err) {
      setError(err.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRun(suite) {
    if (runningIds.has(suite.id)) return;
    setRunningIds((prev) => new Set([...prev, suite.id]));
    try {
      const run = await executeRun(suite.id, { provider: "openai", model: "openai/gpt-oss-20b" });
      navigate(`/runs/${run.run_id}`);
    } catch (err) {
      alert(`Run failed: ${err.message}`);
    } finally {
      setRunningIds((prev) => {
        const next = new Set(prev);
        next.delete(suite.id);
        return next;
      });
    }
  }

  async function handleDelete(suite) {
    try {
      await deleteSuite(suite.id);
      setDeleteTarget(null);
      load();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  }

  const passRate = metrics ? `${(metrics.overall_pass_rate).toFixed(1)}%` : "—";
  const avgLatency = metrics ? `${metrics.avg_latency_ms.toFixed(0)} ms` : "—";
  const totalCost = metrics ? `$${metrics.total_cost_usd.toFixed(4)}` : "—";

  return (
    <>
      {deleteTarget && (
        <ConfirmModal
          suiteName={deleteTarget.name}
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <div className="space-y-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Prompt regression testing at a glance
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm font-medium text-slate-300 transition hover:border-zinc-600 hover:text-slate-100 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <Link
              to="/suites/new"
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-900/40 transition hover:bg-emerald-500 active:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              New Suite
            </Link>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {error}
          </div>
        )}

        <section>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Suites"
              value={loading ? "—" : String(metrics?.total_suites ?? 0)}
              icon={FlaskConical}
              hint="Prompt suites configured"
            />
            <StatCard
              title="Total Runs"
              value={loading ? "—" : String(metrics?.total_runs ?? 0)}
              icon={BarChart3}
              hint="Executions completed"
            />
            <StatCard
              title="Pass Rate"
              value={loading ? "—" : passRate}
              icon={CheckCircle2}
              badge={
                metrics && metrics.overall_pass_rate >= 0.8
                  ? "Healthy"
                  : metrics
                    ? "Needs Review"
                    : undefined
              }
              hint={`${metrics?.total_tests_executed ?? 0} assertions evaluated`}
            />
            <StatCard
              title="Avg Latency"
              value={loading ? "—" : avgLatency}
              icon={Clock}
              badge={totalCost !== "—" ? totalCost : undefined}
              hint="Mean response latency"
            />
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">Test Suites</h2>
            <Link
              to="/suites/new"
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-emerald-600/60 hover:text-emerald-300"
            >
              <Plus className="h-3.5 w-3.5" />
              New Suite
            </Link>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-emerald-400" />
            </div>
          ) : suites.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-zinc-700 py-16 text-center">
              <FlaskConical className="h-10 w-10 text-zinc-600" />
              <div>
                <p className="font-medium text-slate-300">No suites yet</p>
                <p className="mt-1 text-sm text-slate-500">
                  Create your first prompt test suite to get started.
                </p>
              </div>
              <Link
                to="/suites/new"
                className="mt-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/40 transition hover:bg-emerald-500"
              >
                Create Suite
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-glow">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-left">
                      <th className="px-5 py-3.5 font-medium text-slate-400">Suite</th>
                      <th className="hidden px-5 py-3.5 font-medium text-slate-400 sm:table-cell">
                        Description
                      </th>
                      <th className="px-5 py-3.5 font-medium text-slate-400">Created</th>
                      <th className="px-5 py-3.5 text-right font-medium text-slate-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/70">
                    {suites.map((suite) => (
                      <tr key={suite.id} className="group transition hover:bg-zinc-800/40">
                        <td className="px-5 py-4">
                          <Link
                            to={`/suites/${suite.id}`}
                            className="font-medium text-slate-100 transition group-hover:text-emerald-300"
                          >
                            {suite.name}
                          </Link>
                        </td>
                        <td className="hidden max-w-xs truncate px-5 py-4 text-slate-400 sm:table-cell">
                          {suite.description || (
                            <span className="italic text-slate-600">No description</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-400">
                          {new Date(suite.created_at).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleRun(suite)}
                              disabled={runningIds.has(suite.id)}
                              className="flex items-center gap-1.5 rounded-lg bg-emerald-600/20 px-3 py-1.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30 transition hover:bg-emerald-600/40 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {runningIds.has(suite.id) ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  Running
                                </>
                              ) : (
                                <>
                                  <Play className="h-3.5 w-3.5" />
                                  Run
                                </>
                              )}
                            </button>
                            <Link
                              to={`/suites/${suite.id}`}
                              className="rounded-lg p-1.5 text-slate-500 transition hover:bg-zinc-700 hover:text-slate-200"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Link>
                            <button
                              onClick={() => setDeleteTarget(suite)}
                              className="rounded-lg p-1.5 text-slate-500 transition hover:bg-rose-500/15 hover:text-rose-300"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {recentRuns.length > 0 && (
          <section>
            <h2 className="mb-4 text-lg font-semibold text-slate-100">Recent Runs</h2>
            <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-glow">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-left">
                      <th className="px-5 py-3.5 font-medium text-slate-400">Run ID</th>
                      <th className="px-5 py-3.5 font-medium text-slate-400">Suite</th>
                      <th className="px-5 py-3.5 font-medium text-slate-400">Status</th>
                      <th className="px-5 py-3.5 font-medium text-slate-400">Passed</th>
                      <th className="px-5 py-3.5 font-medium text-slate-400">Failed</th>
                      <th className="px-5 py-3.5 font-medium text-slate-400">Latency</th>
                      <th className="px-5 py-3.5 font-medium text-slate-400">Cost</th>
                      <th className="px-5 py-3.5 font-medium text-slate-400">Date</th>
                      <th className="px-5 py-3.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/70">
                    {recentRuns.map((run) => (
                      <tr key={run.run_id} className="group transition hover:bg-zinc-800/40">
                        <td className="px-5 py-4 font-mono text-xs text-slate-400">
                          #{run.run_id}
                        </td>
                        <td className="max-w-[140px] truncate px-5 py-4 font-medium text-slate-200">
                          {run.suiteName}
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={run.status} />
                        </td>
                        <td className="px-5 py-4">
                          <span className="flex items-center gap-1 text-emerald-300">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {run.total_passed}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {run.total_failed > 0 ? (
                            <span className="flex items-center gap-1 text-rose-300">
                              <XCircle className="h-3.5 w-3.5" />
                              {run.total_failed}
                            </span>
                          ) : (
                            <span className="text-slate-500">0</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-slate-400">
                          {run.avg_latency_ms != null
                            ? `${run.avg_latency_ms.toFixed(0)} ms`
                            : "—"}
                        </td>
                        <td className="px-5 py-4 font-mono text-xs text-slate-400">
                          ${run.total_cost_usd.toFixed(4)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-400">
                          {new Date(run.created_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="px-5 py-4">
                          <Link
                            to={`/runs/${run.run_id}`}
                            className="flex items-center gap-1 text-xs text-slate-500 transition hover:text-emerald-300"
                          >
                            Details
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
