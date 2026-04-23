"use client";

import { useEffect, useRef, useState } from "react";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/context/AuthContext";
import { COUNTRIES } from "@/lib/countries";
import {
  subscribeCompetitors,
  addCompetitor,
  updateCompetitor,
  deleteCompetitor,
  bulkAddCompetitors,
  parseCsv,
  EXPERIENCE_LABELS,
  EXPERIENCE_DESCRIPTIONS,
  type Competitor,
  type CompetitorInput,
  type ExperienceLevel,
  type CsvParseResult,
} from "@/lib/competitors";

// ─── Constants ────────────────────────────────────────────────────────────────

const EXPERIENCE_LEVELS: ExperienceLevel[] = ["beginner", "intermediate", "advanced", "pro"];

const EXPERIENCE_COLOR: Record<ExperienceLevel, string> = {
  beginner:     "bg-elevated text-secondary border-border",
  intermediate: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  advanced:     "bg-warn/10 text-warn border-warn/30",
  pro:          "bg-accent/10 text-accent border-accent/30",
};

// ─── Experience badge ─────────────────────────────────────────────────────────

function ExperienceBadge({ level }: { level: ExperienceLevel }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${EXPERIENCE_COLOR[level]}`}>
      {EXPERIENCE_LABELS[level]}
    </span>
  );
}

// ─── Manual Entry Modal ───────────────────────────────────────────────────────

type FormData = Omit<CompetitorInput, "organiserId">;

const EMPTY_FORM: FormData = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  weightKg: 0,
  gender: "male",
  country: "",
  schoolName: "",
  experience: "beginner",
};

interface ManualModalProps {
  /** Pass an existing competitor to edit, or undefined to add new. */
  existing?: Competitor;
  organiserId: string;
  onClose: () => void;
}

function ManualModal({ existing, organiserId, onClose }: ManualModalProps) {
  const isEdit = Boolean(existing);
  const [form, setForm] = useState<FormData>(
    existing
      ? {
          firstName:   existing.firstName,
          lastName:    existing.lastName,
          dateOfBirth: existing.dateOfBirth,
          weightKg:    existing.weightKg,
          gender:      existing.gender,
          country:     existing.country,
          schoolName:  existing.schoolName,
          experience:  existing.experience,
        }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [weightUnit, setWeightUnit] = useState<"kg" | "lbs">("kg");

  const displayWeight = weightUnit === "lbs" && form.weightKg
    ? parseFloat((form.weightKg * 2.20462).toFixed(1))
    : form.weightKg;

  function handleWeightChange(raw: string) {
    const val = parseFloat(raw) || 0;
    const kg = weightUnit === "lbs" ? parseFloat((val / 2.20462).toFixed(2)) : val;
    set("weightKg", kg);
  }

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("First and last name are required.");
      return;
    }
    if (!form.weightKg || form.weightKg <= 0) {
      setError("A valid weight is required.");
      return;
    }
    if (form.schoolName.trim() && !/[a-zA-Z]/.test(form.schoolName)) {
      setError("School name must contain at least one letter.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload: CompetitorInput = {
        ...form,
        organiserId,
        firstName:  form.firstName.trim(),
        lastName:   form.lastName.trim(),
        schoolName: form.schoolName.trim(),
      };
      if (isEdit && existing) {
        await updateCompetitor(existing.id, payload);
      } else {
        await addCompetitor(payload);
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
      <div className="relative z-10 w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border flex-shrink-0">
          <h2 className="text-base font-semibold text-primary">
            {isEdit ? "Edit Competitor" : "Add Competitor"}
          </h2>
          <p className="text-xs text-secondary mt-1">
            {isEdit ? "Update the competitor's details." : "Enter competitor details manually."}
          </p>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
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
                  placeholder="Ahmad"
                  className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-primary placeholder-muted focus:outline-none focus:border-accent transition-colors"
                  autoFocus
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
                  placeholder="Razali"
                  className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-primary placeholder-muted focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            </div>

            {/* Gender */}
            <div>
              <label className="block text-xs font-semibold text-secondary uppercase tracking-widest mb-2">
                Gender <span className="text-danger">*</span>
              </label>
              <div className="flex gap-2">
                {(["male", "female"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => set("gender", g)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-semibold transition-colors capitalize ${
                      form.gender === g
                        ? "bg-accent text-black border-accent"
                        : "bg-elevated text-secondary border-border hover:border-accent/50 hover:text-primary"
                    }`}
                  >
                    {g === "male" ? "Male" : "Female"}
                  </button>
                ))}
              </div>
            </div>

            {/* DOB + Weight */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-widest mb-1.5">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => set("dateOfBirth", e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:border-accent transition-colors [color-scheme:dark]"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-secondary uppercase tracking-widest">
                    Weight <span className="text-danger">*</span>
                  </label>
                  <div className="flex rounded-md overflow-hidden border border-border text-xs font-semibold">
                    {(["kg", "lbs"] as const).map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setWeightUnit(u)}
                        className={`px-2 py-0.5 transition-colors ${
                          weightUnit === u
                            ? "bg-accent text-black"
                            : "bg-elevated text-secondary hover:text-primary"
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="number"
                  min={1}
                  max={weightUnit === "lbs" ? 440 : 200}
                  step={0.1}
                  value={displayWeight || ""}
                  onChange={(e) => handleWeightChange(e.target.value)}
                  placeholder={weightUnit === "lbs" ? "143" : "65"}
                  className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-primary placeholder-muted focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            </div>

            {/* Country + School */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-widest mb-1.5">
                  Country
                </label>
                <select
                  value={form.country}
                  onChange={(e) => set("country", e.target.value)}
                  className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:border-accent transition-colors appearance-none [color-scheme:dark]"
                >
                  <option value="">Select country…</option>
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-widest mb-1.5">
                  School Name
                </label>
                <input
                  type="text"
                  value={form.schoolName}
                  onChange={(e) => {
                    const v = e.target.value;
                    // Allow empty (optional field) or any value that contains a letter
                    if (v === "" || /[a-zA-Z]/.test(v)) set("schoolName", v);
                  }}
                  placeholder="Pertubuhan Silat..."
                  className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-primary placeholder-muted focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            </div>

            {/* Experience */}
            <div>
              <label className="block text-xs font-semibold text-secondary uppercase tracking-widest mb-2">
                Experience Level
              </label>
              <div className="grid grid-cols-2 gap-2">
                {EXPERIENCE_LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => set("experience", level)}
                    className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                      form.experience === level
                        ? "border-accent bg-accent/10"
                        : "border-border bg-elevated hover:border-border hover:bg-elevated"
                    }`}
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 mt-0.5 ${
                        form.experience === level
                          ? "border-accent bg-accent"
                          : "border-border"
                      }`}
                    />
                    <span>
                      <span className={`block text-xs font-semibold ${form.experience === level ? "text-accent" : "text-primary"}`}>
                        {EXPERIENCE_LABELS[level]}
                      </span>
                      <span className="block text-xs text-muted mt-0.5">
                        {EXPERIENCE_DESCRIPTIONS[level]}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-xs text-danger">{error}</p>}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border flex gap-3 flex-shrink-0">
            {isEdit && !confirmDelete && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="px-4 py-2.5 rounded-lg border border-danger/40 text-sm font-medium text-danger hover:bg-danger/10 transition-colors"
              >
                Delete
              </button>
            )}
            {isEdit && confirmDelete && (
              <button
                type="button"
                onClick={async () => {
                  setSaving(true);
                  await deleteCompetitor(existing!.id);
                  onClose();
                }}
                className="px-4 py-2.5 rounded-lg bg-danger text-white text-sm font-semibold hover:bg-danger/80 transition-colors"
              >
                Confirm Delete
              </button>
            )}
            <button
              type="button"
              onClick={confirmDelete ? () => setConfirmDelete(false) : onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-secondary hover:text-primary hover:bg-elevated transition-colors"
            >
              {confirmDelete ? "No, keep" : "Cancel"}
            </button>
            {!confirmDelete && (
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-4 py-2.5 rounded-lg bg-accent text-black text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Competitor"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── CSV Upload Modal ─────────────────────────────────────────────────────────

interface CsvModalProps {
  organiserId: string;
  onClose: () => void;
}

function CsvModal({ organiserId, onClose }: CsvModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<CsvParseResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setResult(parseCsv(text));
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!result || result.valid.length === 0) return;
    setSaving(true);
    try {
      await bulkAddCompetitors(result.valid.map((c) => ({ ...c, organiserId })));
      setDone(true);
    } catch {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl bg-surface border border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border flex-shrink-0">
          <h2 className="text-base font-semibold text-primary">Upload CSV</h2>
          <p className="text-xs text-secondary mt-1">
            Import multiple competitors from a spreadsheet export.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {done ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center text-2xl mb-3">
                ✓
              </div>
              <p className="text-sm font-semibold text-primary">
                {result?.valid.length} competitor{result?.valid.length !== 1 ? "s" : ""} imported
              </p>
              <p className="text-xs text-muted mt-1">They now appear in the competitors list.</p>
            </div>
          ) : (
            <>
              {/* Template hint */}
              <div className="bg-elevated border border-border rounded-lg px-4 py-3">
                <p className="text-xs font-semibold text-secondary mb-1">Expected CSV columns</p>
                <code className="text-xs text-accent font-mono break-all">
                  first_name, last_name, date_of_birth, weight_kg, gender, country, school_name, experience
                </code>
                <p className="text-xs text-muted mt-1.5">
                  Use <span className="text-secondary">weight_kg</span> or <span className="text-secondary">weight_lbs</span> (or both — kg takes priority). Values are always stored as kg.
                </p>
                <p className="text-xs text-muted mt-1">
                  Gender: <span className="text-secondary">male · female</span>
                </p>
                <p className="text-xs text-muted mt-1">
                  Experience: <span className="text-secondary">beginner · intermediate · advanced · pro</span>
                </p>
              </div>

              {/* File picker */}
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFile}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className={`w-full flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed transition-colors ${
                    fileName
                      ? "border-accent/50 bg-accent/5"
                      : "border-border hover:border-accent/30 hover:bg-elevated"
                  }`}
                >
                  <span className="text-2xl">{fileName ? "📄" : "📂"}</span>
                  <span className="text-sm font-medium text-primary">
                    {fileName || "Choose a CSV file"}
                  </span>
                  <span className="text-xs text-muted">
                    {fileName ? "Click to change" : "Click to browse"}
                  </span>
                </button>
              </div>

              {/* Parse result */}
              {result && (
                <div className="space-y-3">
                  {/* Summary */}
                  <div className="flex gap-3">
                    <div className="flex-1 bg-accent/5 border border-accent/20 rounded-lg px-4 py-3 text-center">
                      <p className="text-lg font-bold text-accent">{result.valid.length}</p>
                      <p className="text-xs text-secondary">ready to import</p>
                    </div>
                    {result.errors.length > 0 && (
                      <div className="flex-1 bg-danger/5 border border-danger/20 rounded-lg px-4 py-3 text-center">
                        <p className="text-lg font-bold text-danger">{result.errors.length}</p>
                        <p className="text-xs text-secondary">rows skipped</p>
                      </div>
                    )}
                  </div>

                  {/* Errors */}
                  {result.errors.length > 0 && (
                    <div className="bg-elevated border border-border rounded-lg divide-y divide-border max-h-32 overflow-y-auto">
                      {result.errors.map((err, i) => (
                        <div key={i} className="px-3 py-2 flex gap-3">
                          <span className="text-xs text-muted flex-shrink-0">Row {err.row}</span>
                          <span className="text-xs text-danger">{err.message}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Preview */}
                  {result.valid.length > 0 && (
                    <div className="bg-elevated border border-border rounded-lg overflow-hidden">
                      <p className="px-3 py-2 text-xs font-semibold text-muted border-b border-border">
                        Preview ({Math.min(result.valid.length, 5)} of {result.valid.length})
                      </p>
                      <ul className="divide-y divide-border">
                        {result.valid.slice(0, 5).map((c, i) => (
                          <li key={i} className="px-3 py-2 flex items-center gap-3">
                            <span className="text-sm text-primary font-medium">
                              {c.firstName} {c.lastName}
                            </span>
                            <span className="text-xs text-muted">{c.weightKg}kg</span>
                            <span className="text-xs text-muted">{c.country}</span>
                            <ExperienceBadge level={c.experience} />
                          </li>
                        ))}
                        {result.valid.length > 5 && (
                          <li className="px-3 py-2 text-xs text-muted">
                            +{result.valid.length - 5} more…
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
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
              disabled={!result || result.valid.length === 0 || saving}
              className="flex-1 px-4 py-2.5 rounded-lg bg-accent text-black text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-40"
            >
              {saving
                ? "Importing…"
                : result
                ? `Import ${result.valid.length} Competitor${result.valid.length !== 1 ? "s" : ""}`
                : "Import"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CompetitorsPage() {
  const { user } = useAuth();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"manual" | "csv" | null>(null);
  const [editingCompetitor, setEditingCompetitor] = useState<Competitor | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeCompetitors(user.uid, (data) => {
      setCompetitors(data);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const filtered = competitors.filter((c) => {
    const q = search.toLowerCase();
    return (
      !q ||
      c.firstName.toLowerCase().includes(q) ||
      c.lastName.toLowerCase().includes(q) ||
      c.country.toLowerCase().includes(q) ||
      c.schoolName.toLowerCase().includes(q)
    );
  });

  return (
    <Shell title="Competitors">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 w-full sm:max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">⌕</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, country, school…"
            className="w-full bg-surface border border-border rounded-lg pl-8 pr-3 py-2 text-sm text-primary placeholder-muted focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        {/* Count */}
        <p className="text-xs text-muted flex-1 hidden sm:block">
          {loading ? "" : `${competitors.length} competitor${competitors.length !== 1 ? "s" : ""}`}
        </p>

        {/* Actions */}
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => setModal("csv")}
            className="px-4 py-2 rounded-lg border border-border text-sm font-semibold text-secondary hover:text-primary hover:bg-elevated transition-colors"
          >
            Upload CSV
          </button>
          <button
            onClick={() => setModal("manual")}
            className="px-4 py-2 rounded-lg bg-accent text-black text-sm font-semibold hover:bg-accent-hover transition-colors"
          >
            + Add Manually
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_1fr_80px_80px_80px_1fr_1fr_1fr_40px] gap-4 px-5 py-3 border-b border-border">
          {["Name", "Date of Birth", "kg", "lbs", "Gender", "Country", "School", "Experience", ""].map((h, i) => (
            <span key={i} className="text-xs font-semibold uppercase tracking-widest text-muted">
              {h}
            </span>
          ))}
        </div>

        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-secondary">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-secondary">
            <p className="text-4xl mb-3">👤</p>
            {search ? (
              <>
                <p className="text-sm">No results for &ldquo;{search}&rdquo;</p>
                <button
                  onClick={() => setSearch("")}
                  className="mt-2 text-xs text-accent hover:underline"
                >
                  Clear search
                </button>
              </>
            ) : (
              <>
                <p className="text-sm">No competitors yet.</p>
                <p className="text-xs mt-1 text-muted">
                  Add competitors manually or upload a CSV.
                </p>
              </>
            )}
          </div>
        ) : (
          <ul>
            {filtered.map((c, i) => (
              <li
                key={c.id}
                className={`grid grid-cols-[1fr_1fr_80px_80px_80px_1fr_1fr_1fr_40px] gap-4 px-5 py-3.5 items-center group ${
                  i < filtered.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <span className="text-sm font-medium text-primary truncate">
                  {c.firstName} {c.lastName}
                </span>
                <span className="text-sm text-secondary">
                  {c.dateOfBirth
                    ? new Date(c.dateOfBirth + "T00:00:00").toLocaleDateString(undefined, {
                        year: "numeric", month: "short", day: "numeric",
                      })
                    : "—"}
                </span>
                <span className="text-sm text-secondary">{c.weightKg}</span>
                <span className="text-sm text-secondary">{(c.weightKg * 2.20462).toFixed(1)}</span>
                <span className="text-sm text-secondary capitalize">{c.gender}</span>
                <span className="text-sm text-secondary truncate">{c.country || "—"}</span>
                <span className="text-sm text-secondary truncate">{c.schoolName || "—"}</span>
                <ExperienceBadge level={c.experience} />
                <button
                  onClick={() => setEditingCompetitor(c)}
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

      {modal === "manual" && user && (
        <ManualModal organiserId={user.uid} onClose={() => setModal(null)} />
      )}
      {modal === "csv" && user && (
        <CsvModal organiserId={user.uid} onClose={() => setModal(null)} />
      )}
      {editingCompetitor && user && (
        <ManualModal
          existing={editingCompetitor}
          organiserId={user.uid}
          onClose={() => setEditingCompetitor(null)}
        />
      )}
    </Shell>
  );
}
