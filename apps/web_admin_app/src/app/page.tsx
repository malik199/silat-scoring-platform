"use client";

import { Shell } from "@/components/Shell";
import { StatCard } from "@/components/StatCard";

const STATS = [
  { label: "Total Matches",      value: "0",  sub: "No matches yet",     trend: "neutral" as const },
  { label: "Active Tournaments", value: "0",  sub: "No tournaments yet", trend: "neutral" as const },
  { label: "Registered Competitors", value: "0", sub: "None added yet",  trend: "neutral" as const },
  { label: "Judges Assigned",    value: "0",  sub: "None assigned yet",  trend: "neutral" as const },
];

export default function DashboardPage() {
  return (
    <Shell title="Dashboard">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {STATS.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Recent matches placeholder */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-primary">Recent Matches</h2>
          <a href="/matches" className="text-xs text-accent hover:underline">
            See all
          </a>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-secondary">
          <p className="text-4xl mb-3">⚔</p>
          <p className="text-sm">No matches yet.</p>
          <p className="text-xs mt-1">Create a tournament to get started.</p>
        </div>
      </div>
    </Shell>
  );
}
