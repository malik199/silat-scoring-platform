"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/context/AuthContext";
import { subscribeActiveTournament, type Tournament } from "@/lib/tournaments";
import {
  subscribeBrackets,
  deleteBracket,
  type Bracket,
} from "@/lib/brackets";
import {
  subscribeCompetitors,
  type Competitor,
} from "@/lib/competitors";
import {
  subscribeMatches,
  createMatch,
  type Match,
} from "@/lib/matches";

function formatDate(ts: unknown): string {
  if (!ts) return "—";
  const secs = (ts as { seconds?: number })?.seconds;
  if (!secs) return "—";
  return new Date(secs * 1000).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchPair {
  redId: string;
  blueId: string;
  redName: string;
  blueName: string;
}

// ─── Create Matches Modal (2-step) ────────────────────────────────────────────

interface CreateMatchesModalProps {
  bracket: Bracket;
  tournament: Tournament;
  competitors: Competitor[];
  existingMatchCount: number;
  onClose: () => void;
}

function CreateMatchesModal({
  bracket,
  tournament,
  competitors,
  existingMatchCount,
  onClose,
}: CreateMatchesModalProps) {
  const arenas = Object.keys(tournament.arenaPins ?? {})
    .map(Number)
    .sort((a, b) => a - b);

  const [step,     setStep]     = useState<"config" | "confirm">("config");
  const [arena,    setArena]    = useState<number>(arenas[0] ?? 1);
  const [duration, setDuration] = useState<60 | 90 | 120>(120);
  const [dirty,    setDirty]    = useState(false);
  const [saving,   setSaving]   = useState(false);

  // Build pairs from seededIds: every 2 consecutive filled slots = 1 match
  const pairs: MatchPair[] = [];
  const ids = bracket.seededIds;
  for (let i = 0; i + 1 < ids.length; i += 2) {
    const redId  = ids[i];
    const blueId = ids[i + 1];
    if (!redId || !blueId) continue;
    const red  = competitors.find((c) => c.id === redId);
    const blue = competitors.find((c) => c.id === blueId);
    pairs.push({
      redId,
      blueId,
      redName:  red  ? `${red.firstName} ${red.lastName}`  : redId,
      blueName: blue ? `${blue.firstName} ${blue.lastName}` : blueId,
    });
  }

  async function handleCreate() {
    setSaving(true);
    for (let i = 0; i < pairs.length; i++) {
      const p = pairs[i];
      await createMatch({
        tournamentId:          tournament.id,
        tournamentName:        tournament.name,
        arenaNumber:           arena,
        redCornerCompetitorId: p.redId,
        blueCornerCompetitorId: p.blueId,
        roundDurationSeconds:  duration,
        dirtyTime:             dirty,
        currentCount:          existingMatchCount + i,
      });
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !saving && onClose()} />
      <div className="relative z-10 w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border flex-shrink-0">
          <h2 className="text-base font-semibold text-primary">
            {step === "config" ? "Create Matches" : "Confirm Matches"}
          </h2>
          <p className="text-xs text-secondary mt-1">
            {step === "config"
              ? `${pairs.length} match${pairs.length !== 1 ? "es" : ""} will be created from "${bracket.name}"`
              : `Review the matches below, then click Create.`}
          </p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === "config" ? (
            <div className="space-y-5">
              {/* Arena */}
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-widest mb-2">
                  Arena
                </label>
                <div className="flex flex-wrap gap-2">
                  {arenas.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setArena(a)}
                      className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                        arena === a
                          ? "bg-accent text-black border-accent"
                          : "bg-elevated text-secondary border-border hover:border-accent/50 hover:text-primary"
                      }`}
                    >
                      Arena {a}
                    </button>
                  ))}
                  {arenas.length === 0 && (
                    <p className="text-xs text-muted">No arenas configured on this tournament.</p>
                  )}
                </div>
              </div>

              {/* Round duration */}
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-widest mb-2">
                  Round Duration
                </label>
                <div className="flex gap-2">
                  {([60, 90, 120] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDuration(d)}
                      className={`flex-1 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                        duration === d
                          ? "bg-accent text-black border-accent"
                          : "bg-elevated text-secondary border-border hover:border-accent/50 hover:text-primary"
                      }`}
                    >
                      {d === 60 ? "1:00" : d === 90 ? "1:30" : "2:00"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dirty time */}
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-widest mb-2">
                  Timer Type
                </label>
                <div className="flex gap-2">
                  {([false, true] as const).map((d) => (
                    <button
                      key={String(d)}
                      type="button"
                      onClick={() => setDirty(d)}
                      className={`flex-1 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                        dirty === d
                          ? "bg-accent text-black border-accent"
                          : "bg-elevated text-secondary border-border hover:border-accent/50 hover:text-primary"
                      }`}
                    >
                      {d ? "Dirty Time" : "Clean Time"}
                    </button>
                  ))}
                </div>
              </div>

              {pairs.length === 0 && (
                <div className="bg-warn/5 border border-warn/30 rounded-lg px-4 py-3">
                  <p className="text-xs text-warn">
                    No complete pairs found. Make sure competitors are assigned in pairs in this bracket.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {pairs.map((p, i) => (
                <div key={i} className="flex items-center gap-3 bg-elevated border border-border rounded-lg px-4 py-3">
                  <span className="text-xs text-muted font-semibold w-5 text-right flex-shrink-0">{i + 1}</span>
                  <span className="flex-1 text-sm font-semibold text-red-400 truncate">{p.redName}</span>
                  <span className="text-xs text-muted flex-shrink-0">vs</span>
                  <span className="flex-1 text-sm font-semibold text-blue-400 truncate text-right">{p.blueName}</span>
                </div>
              ))}
              <div className="mt-3 bg-surface border border-border rounded-lg px-4 py-3 text-xs text-secondary space-y-0.5">
                <p>Arena <span className="text-primary font-semibold">{arena}</span></p>
                <p>Duration <span className="text-primary font-semibold">{duration === 60 ? "1:00" : duration === 90 ? "1:30" : "2:00"} per round</span></p>
                <p>Timer <span className="text-primary font-semibold">{dirty ? "Dirty time" : "Clean time"}</span></p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex gap-3 flex-shrink-0">
          <button
            type="button"
            disabled={saving}
            onClick={step === "confirm" ? () => setStep("config") : onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-secondary hover:text-primary hover:bg-elevated transition-colors disabled:opacity-50"
          >
            {step === "confirm" ? "Back" : "Cancel"}
          </button>
          <button
            type="button"
            disabled={pairs.length === 0 || saving}
            onClick={step === "config" ? () => setStep("confirm") : handleCreate}
            className="flex-1 px-4 py-2.5 rounded-lg bg-accent text-black text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-40"
          >
            {saving
              ? "Creating…"
              : step === "config"
              ? `Review ${pairs.length} Match${pairs.length !== 1 ? "es" : ""} →`
              : `Create ${pairs.length} Match${pairs.length !== 1 ? "es" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BracketsPage() {
  const { user } = useAuth();
  const router   = useRouter();

  const [tournament,    setTournament]    = useState<Tournament | null | undefined>(undefined);
  const [brackets,      setBrackets]      = useState<Bracket[]>([]);
  const [competitors,   setCompetitors]   = useState<Competitor[]>([]);
  const [matches,       setMatches]       = useState<Match[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [shareCopied,   setShareCopied]   = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [createForBracket, setCreateForBracket] = useState<Bracket | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeActiveTournament(user.uid, (t) => {
      setTournament(t);
      setLoading(false);
    });
  }, [user]);

  useEffect(() => {
    if (!tournament?.id) { setBrackets([]); setMatches([]); return; }
    const unsubB = subscribeBrackets(tournament.id, setBrackets);
    const unsubM = subscribeMatches(tournament.id, setMatches);
    return () => { unsubB(); unsubM(); };
  }, [tournament?.id]);

  useEffect(() => {
    if (!user) return;
    return subscribeCompetitors(user.uid, setCompetitors);
  }, [user]);

  function handleShare() {
    if (!tournament) return;
    const url = `${window.location.origin}/brackets/public/${tournament.id}`;
    navigator.clipboard.writeText(url);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2500);
  }

  async function handleDelete(id: string) {
    await deleteBracket(id);
    setDeleteConfirm(null);
  }

  return (
    <Shell title="Brackets">
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold text-primary">All Brackets</h2>
            {brackets.length > 0 && (
              <p className="text-xs text-muted mt-0.5">
                {brackets.length} bracket{brackets.length !== 1 ? "s" : ""}
                {tournament ? ` · ${tournament.name}` : ""}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {tournament && (
              <button
                onClick={handleShare}
                className="px-4 py-2 rounded-lg border border-border text-sm font-semibold text-secondary hover:text-accent hover:border-accent/50 transition-colors"
              >
                {shareCopied ? "✓ Link Copied" : "Share Brackets"}
              </button>
            )}
            <button
              onClick={() => router.push("/brackets/new")}
              disabled={!tournament}
              title={!tournament ? "Create a tournament first" : undefined}
              className="px-4 py-2 rounded-lg bg-accent text-black text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              + Create Bracket
            </button>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-secondary">Loading…</div>
        ) : !tournament ? (
          <div className="flex flex-col items-center justify-center py-16 text-secondary">
            <p className="text-4xl mb-3">🏆</p>
            <p className="text-sm">No active tournament.</p>
            <p className="text-xs mt-1 text-muted">Create a tournament first, then come back to manage brackets.</p>
          </div>
        ) : brackets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-secondary">
            <p className="text-4xl mb-3">🌿</p>
            <p className="text-sm">No brackets yet.</p>
            <p className="text-xs mt-1 text-muted">Click &ldquo;+ Create Bracket&rdquo; to get started.</p>
          </div>
        ) : (
          <ul>
            {brackets.map((b, i) => {
              const competitorCount = b.seededIds.filter((id) => id !== null).length;
              const pairCount = Math.floor(
                b.seededIds.reduce<number>((acc, _, idx, arr) => {
                  if (idx % 2 === 0 && arr[idx] && arr[idx + 1]) return acc + 1;
                  return acc;
                }, 0)
              );
              return (
                <li
                  key={b.id}
                  className={`flex items-center gap-4 px-5 py-4 ${
                    i < brackets.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  {/* Icon */}
                  <div
                    className="w-9 h-9 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0 text-base cursor-pointer"
                    onClick={() => router.push(`/brackets/${b.id}`)}
                  >
                    🌿
                  </div>

                  {/* Name + meta */}
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => router.push(`/brackets/${b.id}`)}
                  >
                    <p className="text-sm font-semibold text-primary truncate">{b.name}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {competitorCount} competitor{competitorCount !== 1 ? "s" : ""} · Created {formatDate(b.createdAt)}
                    </p>
                  </div>

                  {/* Create matches button */}
                  {pairCount > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setCreateForBracket(b); }}
                      title={`Create ${pairCount} match${pairCount !== 1 ? "es" : ""} from this bracket`}
                      className="px-3 py-1.5 rounded-lg border border-accent/40 bg-accent/10 text-accent text-xs font-semibold hover:bg-accent/20 transition-colors flex-shrink-0 whitespace-nowrap"
                    >
                      + Create Matches
                    </button>
                  )}

                  {/* Open arrow */}
                  <span
                    className="text-muted text-sm flex-shrink-0 cursor-pointer"
                    onClick={() => router.push(`/brackets/${b.id}`)}
                  >
                    →
                  </span>

                  {/* Delete */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteConfirm(b.id); }}
                    title="Delete bracket"
                    className="w-7 h-7 flex items-center justify-center rounded-md text-muted hover:text-danger hover:bg-danger/10 transition-colors flex-shrink-0"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Delete confirm modal */}
      {deleteConfirm && (() => {
        const b = brackets.find((x) => x.id === deleteConfirm);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
            <div className="relative z-10 w-full max-w-sm bg-surface border border-border rounded-2xl shadow-2xl p-6">
              <h3 className="text-base font-semibold text-primary mb-1">Delete &ldquo;{b?.name}&rdquo;?</h3>
              <p className="text-sm text-secondary mt-1">This cannot be undone.</p>
              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-secondary hover:text-primary hover:bg-elevated transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-danger text-white text-sm font-semibold hover:bg-danger/80 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Create matches modal */}
      {createForBracket && tournament && (
        <CreateMatchesModal
          bracket={createForBracket}
          tournament={tournament}
          competitors={competitors}
          existingMatchCount={matches.length}
          onClose={() => setCreateForBracket(null)}
        />
      )}
    </Shell>
  );
}
