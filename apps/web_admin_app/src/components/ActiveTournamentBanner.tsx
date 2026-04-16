"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { subscribeActiveTournament, type Tournament } from "@/lib/tournaments";

export function ActiveTournamentBanner() {
  const { user } = useAuth();
  const [tournament, setTournament] = useState<Tournament | null | undefined>(undefined);

  useEffect(() => {
    if (!user) return;
    return subscribeActiveTournament(user.uid, setTournament);
  }, [user]);

  // undefined = still loading, skip render to avoid flash
  if (tournament === undefined) return null;

  if (!tournament) {
    return (
      <div className="flex items-center gap-3 bg-surface border border-border rounded-xl px-5 py-4 mb-6">
        <div className="w-2 h-2 rounded-full bg-muted flex-shrink-0" />
        <p className="text-sm text-secondary">
          No active tournament.{" "}
          <Link href="/tournaments" className="text-accent hover:underline">
            Create one →
          </Link>
        </p>
      </div>
    );
  }

  const arenaText = `${tournament.arenaCount} arena${tournament.arenaCount !== 1 ? "s" : ""}`;
  const competitorCount = Object.values(tournament.arenaAssignments ?? {}).flat().length;

  return (
    <Link href={`/tournaments/${tournament.id}`} className="block mb-6 group">
      <div className="flex items-center gap-4 bg-surface border border-accent/30 rounded-xl px-5 py-4 hover:border-accent/60 transition-colors">
        {/* Live indicator */}
        <div className="relative flex-shrink-0">
          <div className="w-2.5 h-2.5 rounded-full bg-accent" />
          <div className="absolute inset-0 rounded-full bg-accent animate-ping opacity-50" />
        </div>

        {/* Tournament info */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-0.5">
            Active Tournament
          </p>
          <p className="text-base font-bold text-primary truncate group-hover:text-accent transition-colors">
            {tournament.name}
          </p>
        </div>

        {/* Meta chips */}
        <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
          <span className="text-xs text-secondary bg-elevated border border-border rounded-full px-3 py-1">
            {arenaText}
          </span>
          <span className="text-xs text-secondary bg-elevated border border-border rounded-full px-3 py-1">
            {competitorCount} competitor{competitorCount !== 1 ? "s" : ""}
          </span>
          <span className="text-xs text-muted">→</span>
        </div>
      </div>
    </Link>
  );
}
