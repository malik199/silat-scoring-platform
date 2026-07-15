"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/context/AuthContext";
import { subscribeCompetitors, type Competitor } from "@/lib/competitors";
import { getBracket, renameBracket, deleteBracket, buildRounds, type Bracket, type BracketMatchup } from "@/lib/brackets";

// ─── Layout constants ─────────────────────────────────────────────────────────

const CARD_W    = 200;
const CARD_H    = 44;
const GAP       = 8;
const MATCHUP_H = CARD_H * 2 + GAP;  // 96
const CONN_W    = 56;
const SLOT_H    = 148;
const ACCENT    = "#00d084";

// Y-center of matchup[idx] when numMatchups items fill totalH with justify-around spacing
function matchupCenterY(idx: number, numMatchups: number, totalH: number): number {
  return totalH * (2 * idx + 1) / (2 * numMatchups);
}

// Labels: last round = "Finals", second-to-last = "Semifinals", earlier = "Round N"
function getRoundLabel(r: number, numRounds: number): string {
  const fromEnd = numRounds - 1 - r;
  if (fromEnd === 0) return "Finals";
  if (fromEnd === 1) return "Semifinals";
  return `Round ${r + 1}`;
}

// ─── Competitor card ──────────────────────────────────────────────────────────

function CompCard({ competitor }: { competitor: Competitor | null | undefined }) {
  if (!competitor) {
    return (
      <div
        style={{ width: CARD_W, height: CARD_H }}
        className="flex items-center px-3 rounded-lg border border-dashed border-border/50 bg-elevated/40"
      >
        <span className="text-xs text-muted">TBD</span>
      </div>
    );
  }
  return (
    <div
      style={{ width: CARD_W, height: CARD_H }}
      className="flex items-center justify-between px-3 rounded-lg border border-border bg-elevated"
    >
      <span className="text-sm font-semibold text-primary truncate">
        {competitor.firstName} {competitor.lastName}
      </span>
      <span className="text-xs text-muted flex-shrink-0 ml-2">{competitor.weightKg}kg</span>
    </div>
  );
}

// ─── Matchup box ──────────────────────────────────────────────────────────────

function MatchupBox({ matchup, cMap }: { matchup: BracketMatchup; cMap: Map<string, Competitor> }) {
  const p1 = matchup.p1Id ? cMap.get(matchup.p1Id) ?? null : null;
  const p2 = matchup.p2Id ? cMap.get(matchup.p2Id) ?? null : null;
  return (
    <div style={{ height: MATCHUP_H }} className="flex flex-col">
      <CompCard competitor={p1} />
      <div style={{ height: GAP }} />
      <CompCard competitor={p2} />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BracketViewPage() {
  const params   = useParams<{ id: string }>();
  const router   = useRouter();
  const { user } = useAuth();

  const [bracket,       setBracket]       = useState<Bracket | null>(null);
  const [competitors,   setCompetitors]   = useState<Competitor[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [notFound,      setNotFound]      = useState(false);
  const [renaming,      setRenaming]      = useState(false);
  const [nameInput,     setNameInput]     = useState("");
  const [saving,        setSaving]        = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!params?.id) return;
    getBracket(params.id).then((b) => {
      if (!b) setNotFound(true);
      else setBracket(b);
    });
  }, [params?.id]);

  function startRename() {
    setNameInput(bracket?.name ?? "");
    setRenaming(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  async function commitRename() {
    if (!bracket || !nameInput.trim() || saving) return;
    setSaving(true);
    await renameBracket(bracket.id, nameInput.trim());
    setBracket((b) => b ? { ...b, name: nameInput.trim() } : b);
    setSaving(false);
    setRenaming(false);
  }

  function cancelRename() { setRenaming(false); }

  useEffect(() => {
    if (!user) return;
    return subscribeCompetitors(user.uid, setCompetitors);
  }, [user]);

  useEffect(() => {
    if (bracket !== null && competitors.length >= 0) setLoading(false);
  }, [bracket, competitors]);

  const cMap = useMemo(() => new Map(competitors.map((c) => [c.id, c])), [competitors]);

  const rounds = useMemo(() => {
    if (!bracket) return [];
    return buildRounds(bracket.seededIds);
  }, [bracket]);

  // How many competitors skip round 1 (pre-seeded into round 2)
  const numByes = useMemo(() => {
    const realIds = (bracket?.seededIds ?? []).filter((id): id is string => id !== null);
    const n = realIds.length;
    let P = 1;
    while (P < n) P *= 2;
    return P - n;
  }, [bracket]);

  const numRounds = rounds.length;

  // Total height driven by the widest column, not just round 1
  const TOTAL_H = useMemo(() => {
    const maxM = rounds.length > 0 ? Math.max(...rounds.map(r => r.length)) : 1;
    return Math.max(maxM * SLOT_H, MATCHUP_H + 40);
  }, [rounds]);

  const TOTAL_W = numRounds * CARD_W + Math.max(0, numRounds - 1) * CONN_W;

  // Build SVG connector lines between round columns
  const svgLines = useMemo(() => {
    if (!rounds.length) return null;
    const els: React.ReactNode[] = [];
    const lp = {
      stroke: ACCENT, strokeWidth: 2, strokeOpacity: 0.45,
      fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
    };

    for (let r = 0; r < numRounds - 1; r++) {
      const thisRound = rounds[r];
      const nextRound = rounds[r + 1];
      const x0 = r * (CARD_W + CONN_W) + CARD_W;   // right edge of column r
      const mx = x0 + CONN_W / 2;                    // midpoint x between columns
      const x1 = (r + 1) * (CARD_W + CONN_W);        // left edge of column r+1

      if (r === 0 && numByes > 0) {
        // Round 0 → Round 1 transition with byes: mixed connection types
        // • oneBye matchup  → 1:1 L-shape from one R0 matchup
        // • twoTbd matchup  → 2:1 U-shape from two R0 matchups
        // • twoByes matchup → no connector (both slots already filled)
        let r0Ptr = 0;
        nextRound.forEach((m, i) => {
          const oneBye = (m.p1Id !== null) !== (m.p2Id !== null);
          const twoTbd = m.p1Id === null && m.p2Id === null;

          if (oneBye && r0Ptr < thisRound.length) {
            const y0 = matchupCenterY(r0Ptr, thisRound.length, TOTAL_H);
            const y1 = matchupCenterY(i, nextRound.length, TOTAL_H);
            els.push(
              <polyline key={`bf-${i}`}
                points={`${x0},${y0} ${mx},${y0} ${mx},${y1} ${x1},${y1}`}
                {...lp} />
            );
            r0Ptr++;
          } else if (twoTbd && r0Ptr + 1 < thisRound.length) {
            const A  = matchupCenterY(r0Ptr,     thisRound.length, TOTAL_H);
            const B  = matchupCenterY(r0Ptr + 1, thisRound.length, TOTAL_H);
            const M  = (A + B) / 2;
            const yN = matchupCenterY(i, nextRound.length, TOTAL_H);
            els.push(
              <g key={`std-${r}-${i}`} {...lp}>
                <polyline points={`${x0},${A} ${mx},${A} ${mx},${B} ${x0},${B}`} />
                <line x1={mx} y1={M} x2={x1} y2={yN} />
              </g>
            );
            r0Ptr += 2;
          }
          // both pre-filled byes: no connector drawn
        });
      } else {
        // Standard: pair each consecutive two matchups → one in next round (2:1 U-shapes)
        const numPairs = Math.floor(thisRound.length / 2);
        for (let p = 0; p < numPairs; p++) {
          const A  = matchupCenterY(p * 2,     thisRound.length, TOTAL_H);
          const B  = matchupCenterY(p * 2 + 1, thisRound.length, TOTAL_H);
          const M  = (A + B) / 2;
          const yN = matchupCenterY(p, nextRound.length, TOTAL_H);
          els.push(
            <g key={`${r}-${p}`} {...lp}>
              <polyline points={`${x0},${A} ${mx},${A} ${mx},${B} ${x0},${B}`} />
              <line x1={mx} y1={M} x2={x1} y2={yN} />
            </g>
          );
        }
      }
    }
    return els;
  }, [rounds, numRounds, TOTAL_H, numByes]);

  if (notFound) {
    return (
      <Shell title="Bracket">
        <div className="flex flex-col items-center justify-center py-24 text-secondary">
          <p className="text-4xl mb-3">🌿</p>
          <p className="text-sm">Bracket not found.</p>
        </div>
      </Shell>
    );
  }

  if (loading) {
    return (
      <Shell title="Bracket">
        <div className="py-16 text-center text-sm text-secondary">Loading…</div>
      </Shell>
    );
  }

  return (
    <Shell title={bracket?.name ?? "Bracket"}>
      {/* Rename / delete row */}
      <div className="flex items-center gap-3 mb-6">
        {renaming ? (
          <form
            onSubmit={(e) => { e.preventDefault(); commitRename(); }}
            className="flex items-center gap-2 flex-1"
          >
            <input
              ref={inputRef}
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && cancelRename()}
              autoFocus
              className="flex-1 max-w-sm bg-elevated border border-accent rounded-lg px-3 py-1.5 text-sm font-semibold text-primary focus:outline-none"
            />
            <button
              type="submit"
              disabled={!nameInput.trim() || saving}
              className="px-3 py-1.5 rounded-lg bg-accent text-black text-xs font-semibold hover:bg-accent-hover transition-colors disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={cancelRename}
              className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-secondary hover:text-primary hover:bg-elevated transition-colors"
            >
              Cancel
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={startRename}
              className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-secondary hover:text-primary hover:bg-elevated transition-colors"
            >
              ✎ Rename
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="px-3 py-1.5 rounded-lg border border-danger/40 text-xs font-semibold text-danger hover:bg-danger/10 transition-colors"
            >
              Delete Bracket
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto pb-6">
        <div className="relative inline-block" style={{ width: TOTAL_W, height: TOTAL_H + 48 }}>
          {/* Round column labels */}
          <div className="flex" style={{ height: 40 }}>
            {rounds.map((_round, r) => (
              <div key={r} style={{ width: CARD_W, marginLeft: r > 0 ? CONN_W : 0 }} className="flex items-center">
                <span className="inline-flex items-center px-3 py-1 rounded-full border border-border bg-elevated text-xs font-semibold uppercase tracking-widest text-secondary">
                  {getRoundLabel(r, numRounds)}
                </span>
              </div>
            ))}
          </div>

          {/* Bracket area */}
          <div className="relative" style={{ width: TOTAL_W, height: TOTAL_H }}>
            {/* SVG connector lines */}
            <svg
              className="absolute inset-0 pointer-events-none"
              width={TOTAL_W}
              height={TOTAL_H}
              style={{ overflow: "visible" }}
            >
              {svgLines}
            </svg>

            {/* Round columns */}
            {rounds.map((round, r) => (
              <div
                key={r}
                className="absolute flex flex-col justify-around"
                style={{ left: r * (CARD_W + CONN_W), top: 0, width: CARD_W, height: TOTAL_H }}
              >
                {round.map((matchup, i) => (
                  <MatchupBox key={i} matchup={matchup} cMap={cMap} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDelete(false)} />
          <div className="relative z-10 w-full max-w-sm bg-surface border border-border rounded-2xl shadow-2xl">
            <div className="px-6 pt-6 pb-4 border-b border-border">
              <h2 className="text-base font-semibold text-primary">Delete bracket?</h2>
              <p className="text-xs text-secondary mt-1">
                Are you sure you want to delete <span className="font-semibold text-primary">{bracket?.name}</span>? This cannot be undone.
              </p>
            </div>
            <div className="px-6 py-4 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-secondary hover:text-primary hover:bg-elevated transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={async () => {
                  if (!bracket) return;
                  setDeleting(true);
                  await deleteBracket(bracket.id);
                  router.push("/brackets");
                }}
                className="flex-1 px-4 py-2.5 rounded-lg bg-danger text-white text-sm font-semibold hover:bg-danger/80 transition-colors disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
