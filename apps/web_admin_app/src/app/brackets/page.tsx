"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/context/AuthContext";
import { subscribeActiveTournament, type Tournament } from "@/lib/tournaments";
import {
  subscribeCompetitors,
  EXPERIENCE_LABELS,
  type Competitor,
  type ExperienceLevel,
} from "@/lib/competitors";
import { shuffleArray, padToPowerOfTwo, createBracket, subscribeBrackets, type Bracket } from "@/lib/brackets";

// ─── Experience badge ─────────────────────────────────────────────────────────

const EXPERIENCE_COLOR: Record<ExperienceLevel, string> = {
  beginner:     "bg-elevated text-secondary border-border",
  intermediate: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  advanced:     "bg-warn/10 text-warn border-warn/30",
  pro:          "bg-accent/10 text-accent border-accent/30",
};

function ExperienceBadge({ level }: { level: ExperienceLevel }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${EXPERIENCE_COLOR[level]}`}>
      {EXPERIENCE_LABELS[level]}
    </span>
  );
}

// ─── Sorting ──────────────────────────────────────────────────────────────────

type SortKey = "name" | "dateOfBirth" | "kg" | "lbs" | "gender" | "country" | "school" | "experience";
type SortDir = "asc" | "desc";

const EXPERIENCE_ORDER: Record<ExperienceLevel, number> = {
  beginner: 0, intermediate: 1, advanced: 2, pro: 3,
};

function sortCompetitors(list: Competitor[], key: SortKey, dir: SortDir): Competitor[] {
  return [...list].sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case "name":
        cmp = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
        break;
      case "dateOfBirth":
        cmp = (a.dateOfBirth || "").localeCompare(b.dateOfBirth || "");
        break;
      case "kg":
      case "lbs":
        cmp = a.weightKg - b.weightKg;
        break;
      case "gender":
        cmp = a.gender.localeCompare(b.gender);
        break;
      case "country":
        cmp = (a.country || "").localeCompare(b.country || "");
        break;
      case "school":
        cmp = (a.schoolName || "").localeCompare(b.schoolName || "");
        break;
      case "experience":
        cmp = EXPERIENCE_ORDER[a.experience] - EXPERIENCE_ORDER[b.experience];
        break;
    }
    return dir === "asc" ? cmp : -cmp;
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const COLS = "grid-cols-[40px_1fr_120px_70px_70px_80px_1fr_1fr_110px]";

export default function BracketsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [tournament,  setTournament]  = useState<Tournament | null | undefined>(undefined);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [brackets,    setBrackets]    = useState<Bracket[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [selected,    setSelected]    = useState<Set<string>>(new Set());
  const [sortKey,     setSortKey]     = useState<SortKey>("name");
  const [sortDir,     setSortDir]     = useState<SortDir>("asc");
  const [search,      setSearch]      = useState("");
  const [creating,    setCreating]    = useState(false);
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    if (!user) return;
    return subscribeActiveTournament(user.uid, setTournament);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeCompetitors(user.uid, (data) => {
      setCompetitors(data);
      setLoading(false);
    });
  }, [user]);

  useEffect(() => {
    if (!tournament?.id) { setBrackets([]); return; }
    return subscribeBrackets(tournament.id, setBrackets);
  }, [tournament?.id]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return competitors.filter(
      (c) =>
        !q ||
        c.firstName.toLowerCase().includes(q) ||
        c.lastName.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q) ||
        c.schoolName.toLowerCase().includes(q)
    );
  }, [competitors, search]);

  const sorted = useMemo(
    () => sortCompetitors(filtered, sortKey, sortDir),
    [filtered, sortKey, sortDir]
  );

  const allSelected  = sorted.length > 0 && sorted.every((c) => selected.has(c.id));
  const someSelected = sorted.some((c) => selected.has(c.id)) && !allSelected;
  const selectedCount = selected.size;

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        sorted.forEach((c) => next.delete(c.id));
      } else {
        sorted.forEach((c) => next.add(c.id));
      }
      return next;
    });
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function SortBtn({ label, k }: { label: string; k: SortKey }) {
    const active = sortKey === k;
    return (
      <button
        type="button"
        onClick={() => handleSort(k)}
        className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-widest transition-colors group ${
          active ? "text-accent" : "text-muted hover:text-secondary"
        }`}
      >
        {label}
        <span className={`text-[10px] ${active ? "opacity-100" : "opacity-0 group-hover:opacity-40"}`}>
          {active && sortDir === "desc" ? "↓" : "↑"}
        </span>
      </button>
    );
  }

  return (
    <Shell title="Brackets">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">⌕</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, country, school…"
            className="w-full bg-surface border border-border rounded-lg pl-8 pr-3 py-2 text-sm text-primary placeholder-muted focus:outline-none focus:border-accent transition-colors"
          />
        </div>
        <p className="text-xs text-muted hidden sm:block">
          {loading ? "" : `${competitors.length} competitor${competitors.length !== 1 ? "s" : ""}`}
        </p>
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {/* Column headers */}
        <div className={`grid ${COLS} gap-4 px-5 py-3 border-b border-border`}>
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => { if (el) el.indeterminate = someSelected; }}
              onChange={toggleAll}
              disabled={sorted.length === 0}
              className="w-4 h-4 rounded border-border bg-elevated accent-accent cursor-pointer disabled:cursor-default"
            />
          </div>
          <SortBtn label="Name"          k="name"        />
          <SortBtn label="Date of Birth" k="dateOfBirth" />
          <SortBtn label="KG"            k="kg"          />
          <SortBtn label="LBS"           k="lbs"         />
          <SortBtn label="Gender"        k="gender"      />
          <SortBtn label="Country"       k="country"     />
          <SortBtn label="School"        k="school"      />
          <SortBtn label="Experience"    k="experience"  />
        </div>

        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-secondary">Loading…</div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-secondary">
            <p className="text-4xl mb-3">🏅</p>
            {search ? (
              <>
                <p className="text-sm">No results for &ldquo;{search}&rdquo;</p>
                <button onClick={() => setSearch("")} className="mt-2 text-xs text-accent hover:underline">
                  Clear search
                </button>
              </>
            ) : (
              <>
                <p className="text-sm">No competitors yet.</p>
                <p className="text-xs mt-1 text-muted">Add competitors from the Competitors section first.</p>
              </>
            )}
          </div>
        ) : (
          <ul>
            {sorted.map((c, i) => {
              const isSelected = selected.has(c.id);
              return (
                <li
                  key={c.id}
                  onClick={() => toggle(c.id)}
                  className={`grid ${COLS} gap-4 px-5 py-3.5 items-center cursor-pointer transition-colors ${
                    isSelected ? "bg-accent/5" : "hover:bg-elevated/50"
                  } ${i < sorted.length - 1 ? "border-b border-border" : ""}`}
                >
                  <div
                    className="flex items-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(c.id)}
                      className="w-4 h-4 rounded border-border bg-elevated accent-accent cursor-pointer"
                    />
                  </div>
                  <span className="text-sm font-medium text-primary truncate">
                    {c.firstName} {c.lastName}
                  </span>
                  <span className="text-sm text-secondary">
                    {c.dateOfBirth
                      ? new Date(c.dateOfBirth + "T00:00:00").toLocaleDateString(undefined, {
                          year: "numeric", month: "short", day: "numeric",
                        })
                      : "—"}
                  </span>
                  <span className="text-sm text-secondary">{c.weightKg}</span>
                  <span className="text-sm text-secondary">{(c.weightKg * 2.20462).toFixed(1)}</span>
                  <span className="text-sm text-secondary capitalize">{c.gender}</span>
                  <span className="text-sm text-secondary truncate">{c.country || "—"}</span>
                  <span className="text-sm text-secondary truncate">{c.schoolName || "—"}</span>
                  <ExperienceBadge level={c.experience} />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Floating action bar — appears when at least one competitor is selected */}
      <div
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2 transition-all duration-200 ${
          selectedCount > 0 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        {createError && (
          <div className="px-4 py-2 bg-danger/10 border border-danger/40 rounded-xl text-xs text-danger font-medium">
            {createError}
          </div>
        )}
        {!tournament && selectedCount > 0 && (
          <div className="px-4 py-2 bg-warn/10 border border-warn/40 rounded-xl text-xs text-warn font-medium">
            No active tournament — create one first.
          </div>
        )}
        <div className="flex items-center gap-4 px-6 py-3.5 bg-surface border border-border rounded-2xl shadow-2xl">
          <p className="text-sm font-semibold text-primary whitespace-nowrap">
            {selectedCount} competitor{selectedCount !== 1 ? "s" : ""} selected
          </p>
          <button
            type="button"
            disabled={creating || !tournament}
            onClick={async () => {
              if (creating || !user || !tournament) return;
              setCreating(true);
              setCreateError("");
              try {
                const ids = [...selected];
                const shuffled = shuffleArray(ids);
                const seeded = padToPowerOfTwo(shuffled);
                const name = `Untitled Bracket ${brackets.length + 1}`;
                const bracketId = await createBracket(user.uid, tournament.id, tournament.name, name, seeded);
                router.push(`/brackets/${bracketId}`);
              } catch {
                setCreateError("Failed to create bracket. Please try again.");
                setCreating(false);
              }
            }}
            className="px-5 py-2 rounded-lg bg-accent text-black text-sm font-semibold hover:bg-accent-hover transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {creating ? "Creating…" : "Create Bracket with Selected Competitors"}
          </button>
          <button
            type="button"
            onClick={() => { setSelected(new Set()); setCreateError(""); }}
            title="Clear selection"
            className="text-muted hover:text-primary text-lg leading-none transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    </Shell>
  );
}
