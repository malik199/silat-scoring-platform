"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { subscribeBrackets, type Bracket } from "@/lib/brackets";

function formatDate(ts: unknown): string {
  if (!ts) return "";
  const secs = (ts as { seconds?: number })?.seconds;
  if (!secs) return "";
  return new Date(secs * 1000).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}

export default function PublicBracketsPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const router = useRouter();

  const [brackets, setBrackets] = useState<Bracket[] | null>(null);

  useEffect(() => {
    return subscribeBrackets(tournamentId, (b) => setBrackets(b));
  }, [tournamentId]);

  const tournamentName = brackets?.[0]?.tournamentName ?? "";

  return (
    <div className="min-h-screen bg-base text-primary" style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div className="border-b border-border bg-surface px-6 py-5 flex items-center gap-4">
        <img src="/SilatScore.svg" alt="Silat Score" className="h-8 w-auto flex-shrink-0" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted mb-0.5">Tournament Brackets</p>
          <h1 className="text-xl font-bold text-primary leading-tight">
            {tournamentName || "Brackets"}
          </h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-xl mx-auto px-4 py-8">
        {brackets === null ? (
          <p className="text-sm text-secondary text-center py-16">Loading…</p>
        ) : brackets.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🌿</p>
            <p className="text-sm text-secondary">No brackets have been published yet.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {brackets.map((b) => {
              const count = b.seededIds.filter((id) => id !== null).length;
              const date  = formatDate(b.createdAt);
              return (
                <li key={b.id}>
                  <button
                    onClick={() => router.push(`/b/${b.id}`)}
                    className="w-full flex items-center gap-4 px-5 py-4 bg-surface border border-border rounded-xl hover:border-accent/40 hover:bg-elevated/50 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-base flex-shrink-0">
                      🌿
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-primary truncate">{b.name}</p>
                      <p className="text-xs text-muted mt-0.5">
                        {count} competitor{count !== 1 ? "s" : ""}
                        {date ? ` · ${date}` : ""}
                      </p>
                    </div>
                    <span className="text-muted text-sm flex-shrink-0">→</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
