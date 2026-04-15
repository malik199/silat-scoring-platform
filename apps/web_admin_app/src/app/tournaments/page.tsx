"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/context/AuthContext";
import {
  subscribeTournaments,
  createTournament,
  type Tournament,
  type ArenaCount,
} from "@/lib/tournaments";

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

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLOR[status] ?? "bg-elevated text-secondary border-border"}`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

// ─── Arena selector ───────────────────────────────────────────────────────────

function ArenaSelector({
  value,
  onChange,
}: {
  value: ArenaCount;
  onChange: (v: ArenaCount) => void;
}) {
  return (
    <div className="flex gap-2">
      {([1, 2, 3, 4] as ArenaCount[]).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`w-12 h-12 rounded-lg border text-sm font-semibold transition-colors ${
            value === n
              ? "bg-accent text-black border-accent"
              : "bg-elevated text-secondary border-border hover:border-accent/50 hover:text-primary"
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

// ─── New Tournament Modal ─────────────────────────────────────────────────────

interface NewTournamentModalProps {
  onClose: () => void;
  organiserId: string;
}

function NewTournamentModal({ onClose, organiserId }: NewTournamentModalProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [arenaCount, setArenaCount] = useState<ArenaCount>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Tournament name is required."); return; }
    setSaving(true);
    setError("");
    try {
      const id = await createTournament({ name: name.trim(), arenaCount, organiserId });
      router.push(`/tournaments/${id}`);
    } catch {
      setError("Failed to create tournament. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md bg-surface border border-border rounded-2xl p-6 shadow-2xl">
        <h2 className="text-base font-semibold text-primary mb-1">New Tournament</h2>
        <p className="text-xs text-secondary mb-6">
          Set a name and choose how many arenas (gelanggang) will run simultaneously.
        </p>

        <form onSubmit={handleCreate} className="space-y-5">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-secondary uppercase tracking-widest mb-2">
              Tournament Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Kejuaraan Nasional 2026"
              className="w-full bg-elevated border border-border rounded-lg px-4 py-2.5 text-sm text-primary placeholder-muted focus:outline-none focus:border-accent transition-colors"
              autoFocus
            />
          </div>

          {/* Arena count */}
          <div>
            <label className="block text-xs font-semibold text-secondary uppercase tracking-widest mb-3">
              Number of Arenas
            </label>
            <ArenaSelector value={arenaCount} onChange={setArenaCount} />
            <p className="mt-2 text-xs text-muted">
              {arenaCount === 1
                ? "1 arena — matches run one at a time."
                : `${arenaCount} arenas — up to ${arenaCount} matches run simultaneously.`}
            </p>
          </div>

          {error && (
            <p className="text-xs text-danger">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
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
              {saving ? "Creating…" : "Create Tournament"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TournamentsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const unsub = subscribeTournaments((data) => {
      setTournaments(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  return (
    <Shell title="Tournaments">
      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-secondary">
            {loading
              ? "Loading…"
              : tournaments.length === 0
              ? "No tournaments yet."
              : `${tournaments.length} tournament${tournaments.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 rounded-lg bg-accent text-black text-sm font-semibold hover:bg-accent-hover transition-colors"
        >
          + New Tournament
        </button>
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-4 gap-4 px-5 py-3 border-b border-border">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted">Name</span>
          <span className="text-xs font-semibold uppercase tracking-widest text-muted">Arenas</span>
          <span className="text-xs font-semibold uppercase tracking-widest text-muted">Status</span>
          <span className="text-xs font-semibold uppercase tracking-widest text-muted">Created</span>
        </div>

        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-secondary">Loading…</div>
        ) : tournaments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-secondary">
            <p className="text-4xl mb-3">🏆</p>
            <p className="text-sm">No tournaments yet.</p>
            <p className="text-xs mt-1 text-muted">
              Click &ldquo;+ New Tournament&rdquo; to get started.
            </p>
          </div>
        ) : (
          <ul>
            {tournaments.map((t, i) => (
              <li key={t.id}>
                <button
                  onClick={() => router.push(`/tournaments/${t.id}`)}
                  className={`w-full grid grid-cols-4 gap-4 px-5 py-4 text-left hover:bg-elevated transition-colors ${
                    i < tournaments.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <span className="text-sm font-medium text-primary truncate">{t.name}</span>
                  <span className="text-sm text-secondary">
                    {t.arenaCount} arena{t.arenaCount !== 1 ? "s" : ""}
                  </span>
                  <StatusBadge status={t.status} />
                  <span className="text-sm text-muted">
                    {t.createdAt
                      ? new Date((t.createdAt as unknown as { seconds: number }).seconds * 1000).toLocaleDateString()
                      : "—"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showModal && user && (
        <NewTournamentModal
          organiserId={user.uid}
          onClose={() => setShowModal(false)}
        />
      )}
    </Shell>
  );
}
