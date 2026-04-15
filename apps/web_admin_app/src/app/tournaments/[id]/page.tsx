"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Shell } from "@/components/Shell";
import { subscribeTournament, assignCompetitorToArena, updateTournamentName, type Tournament } from "@/lib/tournaments";
import { subscribeCompetitors, EXPERIENCE_LABELS, type Competitor } from "@/lib/competitors";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function arenaLabel(n: number) {
  return `Arena ${n}`;
}

/** All competitor IDs already assigned to any arena in this tournament */
function assignedIds(tournament: Tournament): Set<string> {
  const ids = new Set<string>();
  for (const list of Object.values(tournament.arenaAssignments)) {
    for (const id of list) ids.add(id);
  }
  return ids;
}

// ─── Assign Competitor Modal ──────────────────────────────────────────────────

interface AssignModalProps {
  arenaNumber: number;
  tournament: Tournament;
  competitors: Competitor[];
  onClose: () => void;
}

function AssignModal({ arenaNumber, tournament, competitors, onClose }: AssignModalProps) {
  const currentIds: string[] = tournament.arenaAssignments[String(arenaNumber)] ?? [];
  const taken = assignedIds(tournament);
  // Competitors available for this arena: not assigned to any OTHER arena
  const available = competitors.filter(
    (c) => !taken.has(c.id) || currentIds.includes(c.id)
  );

  const [selected, setSelected] = useState<Set<string>>(new Set(currentIds));
  const [saving, setSaving] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    await assignCompetitorToArena(tournament.id, arenaNumber, Array.from(selected));
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
        <div className="px-6 pt-6 pb-4 border-b border-border flex-shrink-0">
          <h2 className="text-base font-semibold text-primary">
            Assign Competitors — {arenaLabel(arenaNumber)}
          </h2>
          <p className="text-xs text-secondary mt-1">
            Select competitors to compete in this arena.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-3">
          {available.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-secondary">
              <p className="text-3xl mb-3">👤</p>
              <p className="text-sm">No competitors available.</p>
              <p className="text-xs mt-1 text-muted">
                Add competitors via the Competitors section first.
              </p>
            </div>
          ) : (
            <ul className="space-y-1">
              {available.map((c) => {
                const isSelected = selected.has(c.id);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => toggle(c.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                        isSelected
                          ? "bg-accent/10 border border-accent/40"
                          : "hover:bg-elevated border border-transparent"
                      }`}
                    >
                      {/* Checkbox */}
                      <span
                        className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center text-xs ${
                          isSelected
                            ? "bg-accent border-accent text-black font-bold"
                            : "border-border"
                        }`}
                      >
                        {isSelected ? "✓" : ""}
                      </span>

                      {/* Info */}
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-primary truncate">
                          {c.firstName} {c.lastName}
                        </span>
                        <span className="block text-xs text-muted truncate">
                          {c.gender === "male" ? "Male" : "Female"} · {c.weightKg}kg · {c.schoolName || c.country || "—"} · {EXPERIENCE_LABELS[c.experience]}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-secondary hover:text-primary hover:bg-elevated transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-lg bg-accent text-black text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : `Confirm (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Arena Card ───────────────────────────────────────────────────────────────

interface ArenaCardProps {
  arenaNumber: number;
  competitorIds: string[];
  competitors: Competitor[];
  onAssign: (arenaNumber: number) => void;
}

function ArenaCard({ arenaNumber, competitorIds, competitors, onAssign }: ArenaCardProps) {
  const compMap = new Map(competitors.map((c) => [c.id, c]));
  const assigned = competitorIds.map((id) => compMap.get(id)).filter(Boolean) as Competitor[];

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center text-sm font-bold text-accent">
            {arenaNumber}
          </div>
          <div>
            <p className="text-sm font-semibold text-primary">{arenaLabel(arenaNumber)}</p>
            <p className="text-xs text-muted">
              {assigned.length === 0
                ? "No competitors assigned"
                : `${assigned.length} competitor${assigned.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        <button
          onClick={() => onAssign(arenaNumber)}
          className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-secondary hover:text-primary hover:border-accent/50 hover:bg-elevated transition-colors"
        >
          Assign
        </button>
      </div>

      {/* Competitor list */}
      <div className="px-5 py-3 min-h-[72px]">
        {assigned.length === 0 ? (
          <p className="text-xs text-muted py-3 text-center">
            No competitors assigned yet.
          </p>
        ) : (
          <ul className="space-y-2 py-1">
            {assigned.map((c) => (
              <li key={c.id} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-md bg-elevated border border-border flex items-center justify-center text-xs font-semibold text-secondary flex-shrink-0">
                  {c.firstName.slice(0, 1).toUpperCase()}{c.lastName.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-primary truncate">
                    {c.firstName} {c.lastName}
                  </p>
                  <p className="text-xs text-muted truncate">
                    {c.gender === "male" ? "Male" : "Female"} · {c.weightKg}kg · {c.schoolName || c.country || "—"} · {EXPERIENCE_LABELS[c.experience]}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  draft:             "Draft",
  registration_open: "Registration Open",
  in_progress:       "In Progress",
  completed:         "Completed",
  cancelled:         "Cancelled",
};

const STATUS_COLOR: Record<string, string> = {
  draft:             "bg-elevated text-secondary border-border",
  registration_open: "bg-accent/10 text-accent border-accent/30",
  in_progress:       "bg-warn/10 text-warn border-warn/30",
  completed:         "bg-elevated text-muted border-border",
  cancelled:         "bg-danger/10 text-danger border-danger/30",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningArena, setAssigningArena] = useState<number | null>(null);

  // Inline name editing
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [savingName, setSavingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  function startEditName() {
    if (!tournament) return;
    setNameValue(tournament.name);
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.select(), 0);
  }

  async function commitName() {
    if (!tournament || !nameValue.trim() || nameValue.trim() === tournament.name) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    await updateTournamentName(tournament.id, nameValue.trim());
    setSavingName(false);
    setEditingName(false);
  }

  function handleNameKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") commitName();
    if (e.key === "Escape") setEditingName(false);
  }

  useEffect(() => {
    const unsubT = subscribeTournament(id, (t) => {
      setTournament(t);
      setLoading(false);
    });
    const unsubC = subscribeCompetitors(setCompetitors);
    return () => { unsubT(); unsubC(); };
  }, [id]);

  const handleAssign = useCallback((arenaNumber: number) => {
    setAssigningArena(arenaNumber);
  }, []);

  if (loading) {
    return (
      <Shell title="Tournament">
        <p className="text-sm text-secondary">Loading…</p>
      </Shell>
    );
  }

  if (!tournament) {
    return (
      <Shell title="Tournament">
        <p className="text-sm text-danger">Tournament not found.</p>
      </Shell>
    );
  }

  const arenas = Array.from({ length: tournament.arenaCount }, (_, i) => i + 1);

  return (
    <Shell title={tournament.name}>
      {/* Back + meta */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push("/tournaments")}
          className="text-xs text-secondary hover:text-primary transition-colors flex items-center gap-1"
        >
          ← Tournaments
        </button>
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLOR[tournament.status] ?? "bg-elevated text-secondary border-border"}`}
        >
          {STATUS_LABEL[tournament.status] ?? tournament.status}
        </span>
      </div>

      {/* Info strip */}
      <div className="bg-surface border border-border rounded-xl px-5 py-4 mb-6 flex items-center gap-6">
        <div className="min-w-0">
          <p className="text-xs text-muted uppercase tracking-widest font-semibold mb-0.5">Tournament</p>
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                ref={nameInputRef}
                type="text"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={commitName}
                onKeyDown={handleNameKeyDown}
                disabled={savingName}
                className="bg-elevated border border-accent rounded-md px-2 py-0.5 text-sm font-semibold text-primary focus:outline-none w-56"
              />
              <button
                onClick={commitName}
                disabled={savingName}
                className="text-xs text-accent hover:underline disabled:opacity-50"
              >
                {savingName ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => setEditingName(false)}
                className="text-xs text-muted hover:text-secondary"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <p className="text-sm font-semibold text-primary truncate">{tournament.name}</p>
              <button
                onClick={startEditName}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-secondary text-xs px-1"
                title="Edit name"
              >
                ✎
              </button>
            </div>
          )}
        </div>
        <div className="w-px h-8 bg-border" />
        <div>
          <p className="text-xs text-muted uppercase tracking-widest font-semibold mb-0.5">Arenas</p>
          <p className="text-sm font-semibold text-primary">{tournament.arenaCount}</p>
        </div>
        <div className="w-px h-8 bg-border" />
        <div>
          <p className="text-xs text-muted uppercase tracking-widest font-semibold mb-0.5">Competitors</p>
          <p className="text-sm font-semibold text-primary">
            {Object.values(tournament.arenaAssignments).flat().length}
          </p>
        </div>
      </div>

      {/* Section heading */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-primary">Arena Assignments</h2>
        {competitors.length === 0 && (
          <p className="text-xs text-muted">
            No competitors in system yet.{" "}
            <a href="/competitors" className="text-accent hover:underline">
              Add competitors →
            </a>
          </p>
        )}
      </div>

      {/* Arena grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {arenas.map((n) => (
          <ArenaCard
            key={n}
            arenaNumber={n}
            competitorIds={tournament.arenaAssignments[String(n)] ?? []}
            competitors={competitors}
            onAssign={handleAssign}
          />
        ))}
      </div>

      {/* Assign modal */}
      {assigningArena !== null && (
        <AssignModal
          arenaNumber={assigningArena}
          tournament={tournament}
          competitors={competitors}
          onClose={() => setAssigningArena(null)}
        />
      )}
    </Shell>
  );
}
