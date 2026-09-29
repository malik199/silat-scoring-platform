"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/context/AuthContext";
import {
  subscribeTournaments,
  createTournament,
  isActiveTournament,
  type Tournament,
  type ArenaCount,
} from "@/lib/tournaments";
import { PRICING_TIERS, formatTierPrice, type PricingTier } from "@/lib/pricing";

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  draft:             "Active",
  registration_open: "Active",
  in_progress:       "Active",
  completed:         "Completed",
  cancelled:         "Cancelled",
};

const STATUS_COLOR: Record<string, string> = {
  draft:             "bg-green-500/10 text-green-400 border-green-500/30",
  registration_open: "bg-green-500/10 text-green-400 border-green-500/30",
  in_progress:       "bg-green-500/10 text-green-400 border-green-500/30",
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

// ─── Tier selector card ───────────────────────────────────────────────────────

function TierCard({
  tier,
  selected,
  onSelect,
}: {
  tier: PricingTier;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative w-full text-left rounded-xl border px-4 py-3.5 transition-all ${
        selected
          ? "border-accent bg-accent/8"
          : "border-border bg-elevated hover:border-accent/40"
      }`}
    >
      {tier.popular && (
        <span className="absolute -top-2 right-3 bg-accent text-black text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
          Popular
        </span>
      )}
      <div className="flex items-center justify-between mb-0.5">
        <p className={`text-sm font-bold ${selected ? "text-accent" : "text-primary"}`}>
          {tier.name}
        </p>
        <p className={`text-sm font-black ${selected ? "text-accent" : "text-primary"}`}>
          {formatTierPrice(tier.priceUsd)}
        </p>
      </div>
      <p className="text-xs text-muted">Up to {tier.maxCompetitors} competitors · {tier.description}</p>
    </button>
  );
}

// ─── New Tournament Modal ─────────────────────────────────────────────────────

interface NewTournamentModalProps {
  onClose: () => void;
  organiserId: string;
}

function NewTournamentModal({ onClose, organiserId }: NewTournamentModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [arenaCount, setArenaCount] = useState<ArenaCount>(1);
  const [capacityTierId, setCapacityTierId] = useState<string>("free");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleNextStep(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Tournament name is required."); return; }
    setError("");
    setStep(2);
  }

  async function handleCreate() {
    setSaving(true);
    setError("");
    try {
      const id = await createTournament({ name: name.trim(), arenaCount, organiserId, capacityTierId });
      router.push(`/tournaments/${id}`);
    } catch {
      setError("Failed to create tournament. Please try again.");
      setSaving(false);
    }
  }

  const selectedTier = PRICING_TIERS.find((t) => t.id === capacityTierId)!;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Step indicator */}
        <div className="flex border-b border-border">
          {(["Details", "Capacity"] as const).map((label, i) => (
            <div
              key={label}
              className={`flex-1 px-5 py-3 text-xs font-semibold uppercase tracking-widest text-center transition-colors ${
                step === i + 1 ? "text-accent border-b-2 border-accent" : "text-muted"
              }`}
            >
              {i + 1}. {label}
            </div>
          ))}
        </div>

        <div className="p-6">
          {step === 1 && (
            <form onSubmit={handleNextStep} className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-primary mb-1">New Tournament</h2>
                <p className="text-xs text-secondary">Set a name and choose how many arenas will run simultaneously.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-widest mb-2">
                  Tournament Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError(""); }}
                  placeholder="e.g. Kejuaraan Nasional 2026"
                  className="w-full bg-elevated border border-border rounded-lg px-4 py-2.5 text-sm text-primary placeholder-muted focus:outline-none focus:border-accent transition-colors"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-widest mb-3">
                  Number of Arenas
                </label>
                <ArenaSelector value={arenaCount} onChange={setArenaCount} />
                <p className="mt-2 text-xs text-muted">
                  {arenaCount === 1
                    ? "1 arena — matches run one at a time."
                    : `${arenaCount} arenas — up to ${arenaCount} matches simultaneously.`}
                </p>
              </div>

              {error && <p className="text-xs text-danger">{error}</p>}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={onClose}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-secondary hover:bg-elevated transition-colors">
                  Cancel
                </button>
                <button type="submit"
                  className="flex-1 px-4 py-2.5 rounded-lg bg-accent text-black text-sm font-semibold hover:bg-accent-hover transition-colors">
                  Next →
                </button>
              </div>
            </form>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-primary mb-1">Competitor Capacity</h2>
                <p className="text-xs text-secondary">
                  Choose how many competitors this tournament will accommodate. Capacity is per-tournament.
                </p>
              </div>

              <div className="space-y-2">
                {PRICING_TIERS.map((tier) => (
                  <TierCard
                    key={tier.id}
                    tier={tier}
                    selected={capacityTierId === tier.id}
                    onSelect={() => setCapacityTierId(tier.id)}
                  />
                ))}
              </div>

              <p className="text-xs text-muted pt-1">
                Paid tiers are coming soon — all tiers are currently free during the launch period.
              </p>

              {error && <p className="text-xs text-danger">{error}</p>}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setStep(1)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-secondary hover:bg-elevated transition-colors">
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-accent text-black text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50"
                >
                  {saving
                    ? "Creating…"
                    : selectedTier.priceUsd === 0
                    ? "Create Tournament"
                    : `Create — ${formatTierPrice(selectedTier.priceUsd)}`}
                </button>
              </div>
            </div>
          )}
        </div>
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
    if (!user) return;
    const unsub = subscribeTournaments(user.uid, (data) => {
      setTournaments(data);
      setLoading(false);
    });
    return unsub;
  }, [user?.uid]);

  const activeTournament = tournaments.find(isActiveTournament) ?? null;
  const canCreate = !loading && !activeTournament;

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
        <div className="flex items-center gap-3">
          {activeTournament && (
            <p className="text-xs text-muted hidden sm:block">
              Archive &ldquo;{activeTournament.name}&rdquo; to create a new one
            </p>
          )}
          <button
            onClick={() => canCreate && setShowModal(true)}
            disabled={!canCreate}
            title={activeTournament ? `Archive "${activeTournament.name}" first` : undefined}
            className="px-4 py-2 rounded-lg bg-accent text-black text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            + New Tournament
          </button>
        </div>
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
