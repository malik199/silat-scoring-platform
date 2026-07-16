"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getBracket, buildRounds, type BracketMatchup } from "@/lib/brackets";
import { getCompetitorsByIds, type Competitor } from "@/lib/competitors";

// ─── Layout constants (must match admin view) ─────────────────────────────────

const CARD_W    = 200;
const CARD_H    = 52;
const GAP       = 8;
const MATCHUP_H = CARD_H * 2 + GAP;
const CONN_W    = 56;
const SLOT_H    = 148;
const ACCENT    = "#00d084";

function matchupCenterY(idx: number, numMatchups: number, totalH: number): number {
  return totalH * (2 * idx + 1) / (2 * numMatchups);
}

function getRoundLabel(r: number, numRounds: number): string {
  const fromEnd = numRounds - 1 - r;
  if (fromEnd === 0) return "Finals";
  if (fromEnd === 1) return "Semifinals";
  return `Round ${r + 1}`;
}

// ─── Read-only competitor card ────────────────────────────────────────────────

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
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-xs font-semibold text-primary truncate leading-tight">
          {competitor.firstName} {competitor.lastName}
        </span>
        <span className="text-[10px] text-muted truncate leading-tight mt-0.5">
          {competitor.schoolName}
        </span>
      </div>
      <span className="text-xs text-muted flex-shrink-0 ml-1.5">{competitor.weightKg}kg</span>
    </div>
  );
}

// ─── Read-only matchup box ────────────────────────────────────────────────────

function MatchupBox({
  matchup,
  cMap,
}: {
  matchup: BracketMatchup;
  cMap: Map<string, Competitor>;
}) {
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

export default function PublicBracketPage() {
  const params = useParams<{ id: string }>();

  const [bracketName,      setBracketName]      = useState("");
  const [tournamentName,   setTournamentName]   = useState("");
  const [seededIds,        setSeededIds]        = useState<(string | null)[]>([]);
  const [competitors,      setCompetitors]      = useState<Competitor[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [notFound,         setNotFound]         = useState(false);

  useEffect(() => {
    if (!params?.id) return;
    getBracket(params.id).then(async (b) => {
      if (!b) { setNotFound(true); setLoading(false); return; }
      setBracketName(b.name);
      setTournamentName(b.tournamentName);
      setSeededIds(b.seededIds);
      const ids = b.seededIds.filter((id): id is string => id !== null);
      const comps = await getCompetitorsByIds(ids);
      setCompetitors(comps);
      setLoading(false);
    });
  }, [params?.id]);

  const cMap = useMemo(() => new Map(competitors.map((c) => [c.id, c])), [competitors]);

  const rounds = useMemo(() => buildRounds(seededIds), [seededIds]);

  const numByes = useMemo(() => {
    const realIds = seededIds.filter((id): id is string => id !== null);
    const n = realIds.length;
    let P = 1;
    while (P < n) P *= 2;
    return P - n;
  }, [seededIds]);

  const numRounds = rounds.length;

  const TOTAL_H = useMemo(() => {
    const maxM = rounds.length > 0 ? Math.max(...rounds.map((r) => r.length)) : 1;
    return Math.max(maxM * SLOT_H, MATCHUP_H + 40);
  }, [rounds]);

  const TOTAL_W = numRounds * CARD_W + Math.max(0, numRounds - 1) * CONN_W;

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
      const x0 = r * (CARD_W + CONN_W) + CARD_W;
      const mx = x0 + CONN_W / 2;
      const x1 = (r + 1) * (CARD_W + CONN_W);

      if (r === 0 && numByes > 0) {
        let r0Ptr = 0;
        nextRound.forEach((m, i) => {
          const oneBye = (m.p1Id !== null) !== (m.p2Id !== null);
          const twoTbd = m.p1Id === null && m.p2Id === null;

          if (oneBye && r0Ptr < thisRound.length) {
            const y0 = matchupCenterY(r0Ptr, thisRound.length, TOTAL_H);
            const y1 = matchupCenterY(i, nextRound.length, TOTAL_H);
            els.push(
              <polyline key={`bf-${i}`} points={`${x0},${y0} ${mx},${y0} ${mx},${y1} ${x1},${y1}`} {...lp} />
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
        });
      } else {
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
      <div className="min-h-screen bg-base text-primary flex flex-col">
        <PublicHeader />
        <div className="flex flex-col items-center justify-center flex-1 text-secondary">
          <p className="text-4xl mb-3">🌿</p>
          <p className="text-sm">Bracket not found.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-base text-primary flex flex-col">
        <PublicHeader />
        <div className="flex-1 flex items-center justify-center text-sm text-secondary">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base text-primary flex flex-col">
      <PublicHeader />

      <main className="flex-1 px-8 py-6 overflow-auto">
        <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-1">{tournamentName}</p>
        <h1 className="text-2xl font-bold text-primary mb-8">{bracketName}</h1>

        <div className="overflow-x-auto pb-6">
          <div className="relative inline-block" style={{ width: TOTAL_W, height: TOTAL_H + 48 }}>
            {/* Round labels */}
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
              <svg
                className="absolute inset-0 pointer-events-none"
                width={TOTAL_W}
                height={TOTAL_H}
                style={{ overflow: "visible" }}
              >
                {svgLines}
              </svg>

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
      </main>
    </div>
  );
}

function PublicHeader() {
  return (
    <header className="flex items-center px-8 py-4 border-b border-border flex-shrink-0">
      <img src="/SilatScore.svg" alt="Silat Score" className="h-8" />
    </header>
  );
}
