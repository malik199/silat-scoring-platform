"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { StatCard } from "@/components/StatCard";
import { ActiveTournamentBanner } from "@/components/ActiveTournamentBanner";
import { useAuth } from "@/context/AuthContext";
import { subscribeActiveTournament, type Tournament } from "@/lib/tournaments";
import { subscribeCompetitors } from "@/lib/competitors";
import { subscribeMatches, type Match } from "@/lib/matches";

export default function DashboardPage() {
  const { user } = useAuth();

  const [tournament,       setTournament]       = useState<Tournament | null | undefined>(undefined);
  const [competitorCount,  setCompetitorCount]  = useState<number | null>(null);
  const [matches,          setMatches]          = useState<Match[] | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsubT = subscribeActiveTournament(user.uid, setTournament);
    const unsubC = subscribeCompetitors((c) => setCompetitorCount(c.length));
    return () => { unsubT(); unsubC(); };
  }, [user]);

  useEffect(() => {
    if (!tournament) { setMatches(tournament === null ? [] : null); return; }
    return subscribeMatches(tournament.id, setMatches);
  }, [tournament?.id]);

  const loading = tournament === undefined || competitorCount === null || matches === null;

  const totalMatches  = matches?.length ?? 0;
  const runningCount  = matches?.filter((m) => m.status === "in_progress").length ?? 0;
  const recentMatches = matches ? [...matches].sort((a, b) => b.order - a.order).slice(0, 5) : [];

  const fmt = (n: number | null) => (n === null ? "—" : String(n));

  return (
    <Shell title="Dashboard">
      <ActiveTournamentBanner />

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Matches"
          value={loading ? "—" : fmt(totalMatches)}
          sub={runningCount > 0 ? `${runningCount} running now` : totalMatches === 0 ? "No matches yet" : "None running"}
          trend={runningCount > 0 ? "up" : "neutral"}
        />
        <StatCard
          label="Active Tournament"
          value={loading ? "—" : tournament ? "1" : "0"}
          sub={tournament ? tournament.name : "No active tournament"}
          trend={tournament ? "up" : "neutral"}
        />
        <StatCard
          label="Registered Competitors"
          value={loading ? "—" : fmt(competitorCount)}
          sub={competitorCount === 0 ? "None added yet" : competitorCount === 1 ? "1 competitor" : `${competitorCount} competitors`}
          trend={competitorCount ? "up" : "neutral"}
        />
        <StatCard
          label="Matches Pending"
          value={loading ? "—" : fmt(matches?.filter((m) => m.status === "pending").length ?? 0)}
          sub={totalMatches === 0 ? "No matches yet" : "Waiting to start"}
          trend="neutral"
        />
      </div>

      {/* Recent matches */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-primary">Recent Matches</h2>
          <a href="/matches" className="text-xs text-accent hover:underline">See all</a>
        </div>

        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-secondary">Loading…</div>
        ) : recentMatches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-secondary">
            <p className="text-4xl mb-3">⚔</p>
            <p className="text-sm">No matches yet.</p>
            <p className="text-xs mt-1 text-muted">
              {tournament ? "Create a match to get started." : "Create a tournament to get started."}
            </p>
          </div>
        ) : (
          <ul>
            {recentMatches.map((m, i) => (
              <li
                key={m.id}
                className={`flex items-center gap-4 px-5 py-3 ${i < recentMatches.length - 1 ? "border-b border-border" : ""}`}
              >
                <span className="text-xs font-bold text-muted w-6 text-center flex-shrink-0">
                  {m.order}
                </span>
                <span className="text-sm text-secondary flex-shrink-0">Arena {m.arenaNumber}</span>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-danger flex-shrink-0" />
                  <span className="text-sm text-primary truncate">Red</span>
                  <span className="text-xs text-muted mx-1">vs</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                  <span className="text-sm text-primary truncate">Blue</span>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border flex-shrink-0 ${
                  m.status === "in_progress" ? "bg-warn/10 text-warn border-warn/30" :
                  m.status === "completed"   ? "bg-accent/10 text-accent border-accent/30" :
                  m.status === "cancelled"   ? "bg-danger/10 text-danger border-danger/30" :
                  "bg-elevated text-secondary border-border"
                }`}>
                  {m.status === "in_progress" && <span className="w-1.5 h-1.5 rounded-full bg-warn mr-1 animate-pulse" />}
                  {m.status === "in_progress" ? "Running" :
                   m.status === "completed"   ? "Done" :
                   m.status === "cancelled"   ? "Cancelled" : "Pending"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Shell>
  );
}
