"use client";

import { Shell } from "@/components/Shell";

export default function MatchesPage() {
  return (
    <Shell title="Matches">
      <div className="bg-surface border border-border rounded-xl p-6">
        {/* Table header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-primary">All Matches</h2>
          <button className="px-4 py-2 rounded-lg bg-accent text-black text-sm font-semibold hover:bg-accent-hover transition-colors">
            + New Match
          </button>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-5 gap-4 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-muted mb-1">
          <span>Red Corner</span>
          <span>Blue Corner</span>
          <span>Tournament</span>
          <span>Status</span>
          <span>Arena</span>
        </div>

        {/* Empty state */}
        <div className="flex flex-col items-center justify-center py-16 text-secondary">
          <p className="text-4xl mb-3">⚔</p>
          <p className="text-sm">No matches scheduled.</p>
          <p className="text-xs mt-1 text-muted">Matches will appear here once created.</p>
        </div>
      </div>
    </Shell>
  );
}
