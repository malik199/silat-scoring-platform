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

function formatDate(ts: unknown): string {
  if (!ts) return "—";
  const secs = (ts as { seconds?: number })?.seconds;
  if (!secs) return "—";
  return new Date(secs * 1000).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}

export default function BracketsPage() {
  const { user } = useAuth();
  const router   = useRouter();

  const [tournament,    setTournament]    = useState<Tournament | null | undefined>(undefined);
  const [brackets,      setBrackets]      = useState<Bracket[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [shareCopied,   setShareCopied]   = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeActiveTournament(user.uid, (t) => {
      setTournament(t);
      setLoading(false);
    });
  }, [user]);

  useEffect(() => {
    if (!tournament?.id) { setBrackets([]); return; }
    return subscribeBrackets(tournament.id, setBrackets);
  }, [tournament?.id]);

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
              return (
                <li
                  key={b.id}
                  className={`flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-elevated/50 transition-colors ${
                    i < brackets.length - 1 ? "border-b border-border" : ""
                  }`}
                  onClick={() => router.push(`/brackets/${b.id}`)}
                >
                  {/* Icon */}
                  <div className="w-9 h-9 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0 text-base">
                    🌿
                  </div>

                  {/* Name + meta */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-primary truncate">{b.name}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {competitorCount} competitor{competitorCount !== 1 ? "s" : ""} · Created {formatDate(b.createdAt)}
                    </p>
                  </div>

                  {/* Open arrow */}
                  <span className="text-muted text-sm flex-shrink-0">→</span>

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
    </Shell>
  );
}
