import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  Play,
  Plus,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Info,
  FlaskConical,
} from "lucide-react";
import {
  getSuite,
  createSuite,
  updateSuite,
  addTestCase,
  deleteTestCase,
  executeRun,
} from "../api/client";

function LabeledField({ label, hint, children }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <label className="text-sm font-medium text-slate-300">{label}</label>
        {hint && (
          <span className="group relative">
            <Info className="h-3.5 w-3.5 cursor-help text-slate-600" />
            <span className="pointer-events-none absolute left-5 top-0 z-10 w-56 rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-slate-300 opacity-0 shadow-lg transition group-hover:opacity-100">
              {hint}
            </span>
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, className = "" }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 transition focus:border-emerald-500/50 focus:bg-zinc-800 focus:ring-1 focus:ring-emerald-500/30 ${className}`}
    />
  );
}

function PromptArea({ value, onChange, placeholder, rows = 6 }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 font-mono text-sm text-slate-100 placeholder-slate-500 leading-6 transition focus:border-emerald-500/50 focus:bg-zinc-800 focus:ring-1 focus:ring-emerald-500/30"
    />
  );
}

function TagsInput({ tags, onChange, placeholder }) {
  const [draft, setDraft] = useState("");

  function commit() {
    const val = draft.trim();
    if (val && !tags.includes(val)) {
      onChange([...tags, val]);
    }
    setDraft("");
  }

  function onKey(e) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && draft === "" && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/60 p-2 transition focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/30">
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 rounded-full bg-zinc-700 px-2.5 py-0.5 text-xs font-medium text-slate-200"
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(tags.filter((t) => t !== tag))}
            className="text-slate-400 hover:text-rose-300"
          >
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
        onBlur={commit}
        placeholder={tags.length === 0 ? placeholder : "Add…"}
        className="min-w-[120px] flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
      />
    </div>
  );
}

function TestCaseRow({ caseData, suiteId, onDeleted, index }) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm("Delete this test case?")) return;
    setDeleting(true);
    try {
      await deleteTestCase(suiteId, caseData.id);
      onDeleted(caseData.id);
    } catch (err) {
      alert(`Failed to delete: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  }

  const vars = Object.entries(caseData.input_variables || {});

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 transition hover:border-zinc-700">
      <div
        className="flex cursor-pointer items-center gap-3 px-4 py-3"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-slate-400">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium text-slate-200">
            {vars.length > 0
              ? vars.map(([k, v]) => `${k}=${v}`).join(", ")
              : "No input variables"}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {caseData.expected_keywords?.length > 0
              ? `Expects: ${caseData.expected_keywords.join(", ")}`
              : "No keyword assertions"}
            {caseData.max_latency_ms
              ? ` · Max latency: ${caseData.max_latency_ms}ms`
              : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            disabled={deleting}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-rose-500/15 hover:text-rose-300 disabled:opacity-50"
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
          {open ? (
            <ChevronUp className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          )}
        </div>
      </div>

      {open && (
        <div className="border-t border-zinc-800 px-4 pb-4 pt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-medium text-slate-400">Input Variables</p>
              {vars.length === 0 ? (
                <p className="text-xs text-slate-600">None</p>
              ) : (
                <div className="space-y-1">
                  {vars.map(([k, v]) => (
                    <p key={k} className="font-mono text-xs text-slate-300">
                      <span className="text-emerald-400">{k}</span>:{" "}
                      <span className="text-slate-300">{String(v)}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              {caseData.expected_keywords?.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-400">Expected Keywords</p>
                  <div className="flex flex-wrap gap-1">
                    {caseData.expected_keywords.map((kw) => (
                      <span
                        key={kw}
                        className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300 ring-1 ring-emerald-500/20"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {caseData.forbidden_keywords?.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-400">Forbidden Keywords</p>
                  <div className="flex flex-wrap gap-1">
                    {caseData.forbidden_keywords.map((kw) => (
                      <span
                        key={kw}
                        className="rounded-full bg-rose-500/10 px-2 py-0.5 text-xs text-rose-300 ring-1 ring-rose-500/20"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {caseData.max_latency_ms && (
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-400">Max Latency</p>
                  <p className="font-mono text-xs text-slate-300">{caseData.max_latency_ms} ms</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const EMPTY_CASE = {
  inputKey: "",
  inputValue: "",
  expectedKeywords: [],
  forbiddenKeywords: [],
  maxLatency: "",
};

export default function SuiteEditor() {
  const { suiteId } = useParams();
  const navigate = useNavigate();
  const isNew = suiteId === undefined || suiteId === "new";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [baselinePrompt, setBaselinePrompt] = useState("");
  const [candidatePrompt, setCandidatePrompt] = useState("");
  const [testCases, setTestCases] = useState([]);

  const [newCase, setNewCase] = useState(EMPTY_CASE);
  const [addingCase, setAddingCase] = useState(false);
  const [addCaseOpen, setAddCaseOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const load = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    setError(null);
    try {
      const suite = await getSuite(suiteId);
      setName(suite.name);
      setDescription(suite.description || "");
      setBaselinePrompt(suite.baseline_prompt);
      setCandidatePrompt(suite.candidate_prompt);
      setTestCases(suite.test_cases || []);
    } catch (err) {
      setError(err.message || "Failed to load suite.");
    } finally {
      setLoading(false);
    }
  }, [isNew, suiteId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    if (!name.trim()) {
      setError("Suite name is required.");
      return;
    }
    if (!baselinePrompt.trim() || !candidatePrompt.trim()) {
      setError("Both baseline and candidate prompts are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        const suite = await createSuite({
          name: name.trim(),
          description: description.trim() || null,
          baseline_prompt: baselinePrompt.trim(),
          candidate_prompt: candidatePrompt.trim(),
          test_cases: [],
        });
        navigate(`/suites/${suite.id}`, { replace: true });
      } else {
        await updateSuite(suiteId, {
          name: name.trim(),
          description: description.trim() || null,
          baseline_prompt: baselinePrompt.trim(),
          candidate_prompt: candidatePrompt.trim(),
        });
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch (err) {
      setError(err.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddCase() {
    if (!suiteId || isNew) {
      setError("Save the suite first before adding test cases.");
      return;
    }
    setAddingCase(true);
    try {
      const input_variables =
        newCase.inputKey.trim()
          ? { [newCase.inputKey.trim()]: newCase.inputValue }
          : {};
      const caseData = {
        input_variables,
        expected_keywords: newCase.expectedKeywords,
        forbidden_keywords: newCase.forbiddenKeywords,
        max_latency_ms: newCase.maxLatency ? parseInt(newCase.maxLatency, 10) : null,
      };
      const created = await addTestCase(suiteId, caseData);
      setTestCases((prev) => [...prev, created]);
      setNewCase(EMPTY_CASE);
      setAddCaseOpen(false);
    } catch (err) {
      setError(err.message || "Failed to add test case.");
    } finally {
      setAddingCase(false);
    }
  }

  async function handleRun() {
    if (isNew) {
      setError("Save the suite first before running.");
      return;
    }
    setRunning(true);
    setError(null);
    try {
      const run = await executeRun(suiteId, { provider: "openai", model: "openai/gpt-oss-20b" });
      navigate(`/runs/${run.run_id}`);
    } catch (err) {
      setError(err.message || "Run failed.");
      setRunning(false);
    }
  }

  function handleCaseDeleted(caseId) {
    setTestCases((prev) => prev.filter((c) => c.id !== caseId));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link
            to="/"
            className="mt-1 rounded-lg p-1.5 text-slate-500 transition hover:bg-zinc-800 hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-50">
              {isNew ? "New Suite" : name || "Suite Editor"}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {isNew
                ? "Define prompts and test cases to evaluate"
                : `Suite #${suiteId}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {!isNew && (
            <button
              onClick={handleRun}
              disabled={running}
              className="flex items-center gap-2 rounded-lg bg-zinc-700/80 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-zinc-600 disabled:opacity-60"
            >
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running…
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run Suite Now
                </>
              )}
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-900/40 transition hover:bg-emerald-500 disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : saveSuccess ? (
              "Saved ✓"
            ) : (
              <>
                <Save className="h-4 w-4" />
                {isNew ? "Create Suite" : "Save Changes"}
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      {/* Suite details form */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-glow">
        <h2 className="mb-5 flex items-center gap-2 text-base font-semibold text-slate-100">
          <FlaskConical className="h-4 w-4 text-emerald-400" />
          Suite Details
        </h2>
        <div className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <LabeledField label="Suite Name *">
              <TextInput
                value={name}
                onChange={setName}
                placeholder="e.g. Customer Support v2"
              />
            </LabeledField>
            <LabeledField label="Description">
              <TextInput
                value={description}
                onChange={setDescription}
                placeholder="Brief description of this suite's purpose"
              />
            </LabeledField>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <LabeledField
              label="Baseline Prompt *"
              hint="The reference prompt to compare against. Use {{variable}} placeholders."
            >
              <PromptArea
                value={baselinePrompt}
                onChange={setBaselinePrompt}
                placeholder="You are a helpful assistant. Answer the user's question: {{question}}"
              />
            </LabeledField>
            <LabeledField
              label="Candidate Prompt *"
              hint="The new prompt under evaluation. Same variables as baseline."
            >
              <PromptArea
                value={candidatePrompt}
                onChange={setCandidatePrompt}
                placeholder="You are a concise, expert assistant. {{question}}"
              />
            </LabeledField>
          </div>
        </div>
      </div>

      {/* Test cases section */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-glow">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-100">
            Test Cases
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-medium text-slate-400">
              {testCases.length}
            </span>
          </h2>
          {!isNew && (
            <button
              onClick={() => setAddCaseOpen((o) => !o)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-emerald-600/60 hover:text-emerald-300"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Case
            </button>
          )}
        </div>

        {isNew && (
          <p className="mb-4 rounded-lg border border-zinc-700/50 bg-zinc-800/40 px-4 py-3 text-sm text-slate-400">
            Save the suite first, then add test cases.
          </p>
        )}

        {/* Add case form */}
        {addCaseOpen && !isNew && (
          <div className="mb-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <p className="mb-4 text-sm font-medium text-emerald-300">New Test Case</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <LabeledField
                label="Input Variable Key"
                hint="The placeholder name in your prompt (without curly braces)"
              >
                <TextInput
                  value={newCase.inputKey}
                  onChange={(v) => setNewCase((c) => ({ ...c, inputKey: v }))}
                  placeholder="e.g. question"
                />
              </LabeledField>
              <LabeledField label="Input Variable Value">
                <TextInput
                  value={newCase.inputValue}
                  onChange={(v) => setNewCase((c) => ({ ...c, inputValue: v }))}
                  placeholder="e.g. What is the capital of France?"
                />
              </LabeledField>
              <LabeledField
                label="Expected Keywords"
                hint="Press Enter or comma to add. Output must contain all of these."
              >
                <TagsInput
                  tags={newCase.expectedKeywords}
                  onChange={(v) => setNewCase((c) => ({ ...c, expectedKeywords: v }))}
                  placeholder="e.g. Paris, France"
                />
              </LabeledField>
              <LabeledField
                label="Forbidden Keywords"
                hint="Output must NOT contain any of these words."
              >
                <TagsInput
                  tags={newCase.forbiddenKeywords}
                  onChange={(v) => setNewCase((c) => ({ ...c, forbiddenKeywords: v }))}
                  placeholder="e.g. error, sorry"
                />
              </LabeledField>
              <LabeledField
                label="Max Latency (ms)"
                hint="Fail the case if response exceeds this latency."
              >
                <TextInput
                  value={newCase.maxLatency}
                  onChange={(v) => setNewCase((c) => ({ ...c, maxLatency: v }))}
                  placeholder="e.g. 3000"
                />
              </LabeledField>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleAddCase}
                disabled={addingCase}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
              >
                {addingCase ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Adding…
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Add Test Case
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setAddCaseOpen(false);
                  setNewCase(EMPTY_CASE);
                }}
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-slate-300 transition hover:text-slate-100"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {testCases.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-slate-500">
              {isNew
                ? "Save the suite to start adding test cases."
                : "No test cases yet. Click \"Add Case\" to create one."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {testCases.map((tc, i) => (
              <TestCaseRow
                key={tc.id}
                caseData={tc}
                suiteId={suiteId}
                onDeleted={handleCaseDeleted}
                index={i}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
