"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import {
  subscribeJudges,
  addJudge,
  updateJudge,
  bulkAddJudges,
  parseJudgeCsv,
  JUDGE_EXPERIENCE_LABELS,
  type Judge,
  type JudgeInput,
  type JudgeExperience,
  type JudgeCsvParseResult,
} from "@/lib/judges";

// ─── Constants ────────────────────────────────────────────────────────────────

const EXPERIENCE_LEVELS: JudgeExperience[] = ["beginner", "intermediate", "advanced"];

const EXPERIENCE_COLOR: Record<JudgeExperience, string> = {
  beginner:     "bg-elevated text-secondary border-border",
  intermediate: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  advanced:     "bg-accent/10 text-accent border-accent/30",
};

// ─── Experience badge ─────────────────────────────────────────────────────────

function ExperienceBadge({ level }: { level: JudgeExperience }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${EXPERIENCE_COLOR[level]}`}>
      {JUDGE_EXPERIENCE_LABELS[level]}
    </span>
  );
}

// ─── Judge Modal (add + edit) ─────────────────────────────────────────────────

const EMPTY_FORM: JudgeInput = {
  firstName:  "",
  lastName:   "",
  experience: "beginner",
};

interface JudgeModalProps {
  existing?: Judge;
  onClose: () => void;
}

function JudgeModal({ existing, onClose }: JudgeModalProps) {
  const isEdit = Boolean(existing);
  const [form, setForm] = useState<JudgeInput>(
    existing
      ? { firstName: existing.firstName, lastName: existing.lastName, experience: existing.experience }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  function set<K extends keyof JudgeInput>(key: K, value: JudgeInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("First and last name are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload: JudgeInput = {
        ...form,
        firstName: form.firstName.trim(),
        lastName:  form.lastName.trim(),
      };
      if (isEdit && existing) {
        await updateJudge(existing.id, payload);
      } else {
        await addJudge(payload);
      }
      onClose();
    } catch {
      setError("Failed to save. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <h2 className="text-base font-semibold text-primary">
            {isEdit ? "Edit Judge" : "Add Judge"}
          </h2>
          <p className="text-xs text-secondary mt-1">
            {isEdit ? "Update the judge's details." : "Enter judge details."}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-4">
            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-widest mb-1.5">
                  First Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={form.firstName}
                  onChange={(e) => set("firstName", e.target.value.replace(/[0-9]/g, ""))}
                  placeholder="Ali"
                  autoFocus
                  className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-primary placeholder-muted focus:outline-none focus:border-accent transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-widest mb-1.5">
                  Last Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(e) => set("lastName", e.target.value.replace(/[0-9]/g, ""))}
                  placeholder="Hassan"
                  className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-primary placeholder-muted focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            </div>

            {/* Experience */}
            <div>
              <label className="block text-xs font-semibold text-secondary uppercase tracking-widest mb-2">
                Experience Level
              </label>
              <div className="flex gap-2">
                {EXPERIENCE_LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => set("experience", level)}
                    className={`flex-1 py-2.5 rounded-lg border text-xs font-semibold transition-colors ${
                      form.experience === level
                        ? "bg-accent text-black border-accent"
                        : "bg-elevated text-secondary border-border hover:border-accent/50 hover:text-primary"
                    }`}
                  >
                    {JUDGE_EXPERIENCE_LABELS[level]}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-xs text-danger">{error}</p>}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-secondary hover:text-primary hover:bg-elevated transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-lg bg-accent text-black text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Judge"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── CSV Modal ────────────────────────────────────────────────────────────────

interface CsvModalProps {
  onClose: () => void;
}

function CsvModal({ onClose }: CsvModalProps) {
  const [result,    setResult]    = useState<JudgeCsvParseResult | null>(null);
  const [fileName,  setFileName]  = useState("");
  const [importing, setImporting] = useState(false);
  const [done,      setDone]      = useState(false);
  const [importErr, setImportErr] = useState("");

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setDone(false);
    setImportErr("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setResult(parseJudgeCsv(text));
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!result || result.valid.length === 0) return;
    setImporting(true);
    setImportErr("");
    try {
      await bulkAddJudges(result.valid);
      setDone(true);
    } catch {
      setImportErr("Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border flex-shrink-0">
          <h2 className="text-base font-semibold text-primary">Upload Judges CSV</h2>
          <p className="text-xs text-secondary mt-1">
            Required columns: <code className="bg-elevated px-1 rounded text-accent">first_name</code>,{" "}
            <code className="bg-elevated px-1 rounded text-accent">last_name</code>.{" "}
            Optional: <code className="bg-elevated px-1 rounded text-accent">experience</code>{" "}
            (beginner / intermediate / advanced — defaults to Beginner if blank).
          </p>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          {/* File picker */}
          <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-accent/50 transition-colors bg-elevated/50">
            <span className="text-2xl mb-1">📄</span>
            <span className="text-sm text-secondary">
              {fileName ? fileName : "Click to choose a .csv file"}
            </span>
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
          </label>

          {/* Parse result */}
          {result && !done && (
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-1 bg-accent/10 border border-accent/30 rounded-lg px-4 py-3 text-center">
                  <p className="text-xl font-bold text-accent">{result.valid.length}</p>
                  <p className="text-xs text-secondary mt-0.5">Valid rows</p>
                </div>
                <div className={`flex-1 rounded-lg px-4 py-3 text-center border ${
                  result.errors.length > 0
                    ? "bg-danger/10 border-danger/30"
                    : "bg-elevated border-border"
                }`}>
                  <p className={`text-xl font-bold ${result.errors.length > 0 ? "text-danger" : "text-muted"}`}>
                    {result.errors.length}
                  </p>
                  <p className="text-xs text-secondary mt-0.5">Errors</p>
                </div>
              </div>

              {/* Error list */}
              {result.errors.length > 0 && (
                <div className="bg-danger/5 border border-danger/20 rounded-lg px-4 py-3 space-y-1 max-h-32 overflow-y-auto">
                  {result.errors.map((err, i) => (
                    <p key={i} className="text-xs text-danger">
                      Row {err.row}: {err.message}
                    </p>
                  ))}
                </div>
              )}

              {/* Preview */}
              {result.valid.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-2">
                    Preview (first 5 rows)
                  </p>
                  <div className="bg-elevated rounded-lg overflow-hidden border border-border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left px-3 py-2 text-muted font-semibold">Name</th>
                          <th className="text-left px-3 py-2 text-muted font-semibold">Experience</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.valid.slice(0, 5).map((j, i) => (
                          <tr key={i} className={i < Math.min(result.valid.length, 5) - 1 ? "border-b border-border" : ""}>
                            <td className="px-3 py-2 text-primary">{j.firstName} {j.lastName}</td>
                            <td className="px-3 py-2 text-secondary capitalize">{j.experience}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {result.valid.length > 5 && (
                      <p className="text-xs text-muted text-center py-2 border-t border-border">
                        +{result.valid.length - 5} more
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Success */}
          {done && (
            <div className="flex flex-col items-center py-6 text-center">
              <p className="text-3xl mb-2">✓</p>
              <p className="text-sm font-semibold text-accent">
                {result?.valid.length} judge{result?.valid.length !== 1 ? "s" : ""} imported successfully.
              </p>
            </div>
          )}

          {importErr && <p className="text-xs text-danger">{importErr}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-secondary hover:text-primary hover:bg-elevated transition-colors"
          >
            {done ? "Close" : "Cancel"}
          </button>
          {!done && (
            <button
              type="button"
              onClick={handleImport}
              disabled={!result || result.valid.length === 0 || importing}
              className="flex-1 px-4 py-2.5 rounded-lg bg-accent text-black text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-40"
            >
              {importing ? "Importing…" : `Import ${result?.valid.length ?? 0} Judge${(result?.valid.length ?? 0) !== 1 ? "s" : ""}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function JudgesPage() {
  const [judges, setJudges]               = useState<Judge[]>([]);
  const [loading, setLoading]             = useState(true);
  const [showAdd, setShowAdd]             = useState(false);
  const [editingJudge, setEditingJudge]   = useState<Judge | null>(null);
  const [showCsv, setShowCsv]             = useState(false);

  useEffect(() => {
    return subscribeJudges((data) => { setJudges(data); setLoading(false); });
  }, []);

  return (
    <Shell title="Judges">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-secondary">
          {loading ? "" : `${judges.length} judge${judges.length !== 1 ? "s" : ""}`}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCsv(true)}
            className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-secondary hover:text-primary hover:bg-elevated transition-colors"
          >
            Upload CSV
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2 rounded-lg bg-accent text-black text-sm font-semibold hover:bg-accent-hover transition-colors"
          >
            + Add Judge
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_1fr_40px] gap-4 px-5 py-3 border-b border-border">
          {["Name", "Experience", "Added", ""].map((h, i) => (
            <span key={i} className="text-xs font-semibold uppercase tracking-widest text-muted">{h}</span>
          ))}
        </div>

        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-secondary">Loading…</div>
        ) : judges.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-secondary">
            <p className="text-4xl mb-3">⚖</p>
            <p className="text-sm">No judges added yet.</p>
            <p className="text-xs mt-1 text-muted">Click &ldquo;+ Add Judge&rdquo; to get started.</p>
          </div>
        ) : (
          <ul>
            {judges.map((j, i) => (
              <li
                key={j.id}
                className={`grid grid-cols-[1fr_1fr_1fr_40px] gap-4 px-5 py-3.5 items-center group ${
                  i < judges.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <span className="text-sm font-medium text-primary">
                  {j.firstName} {j.lastName}
                </span>
                <ExperienceBadge level={j.experience} />
                <span className="text-sm text-muted">
                  {j.createdAt
                    ? new Date((j.createdAt as unknown as { seconds: number }).seconds * 1000).toLocaleDateString()
                    : "—"}
                </span>
                <button
                  onClick={() => setEditingJudge(j)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-primary text-xs px-1 py-1 rounded hover:bg-elevated"
                  title="Edit"
                >
                  ✎
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showAdd      && <JudgeModal onClose={() => setShowAdd(false)} />}
      {editingJudge && <JudgeModal existing={editingJudge} onClose={() => setEditingJudge(null)} />}
      {showCsv      && <CsvModal onClose={() => setShowCsv(false)} />}
    </Shell>
  );
}
