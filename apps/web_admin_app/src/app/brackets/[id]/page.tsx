"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Shell } from "@/components/Shell";
import { useAuth } from "@/context/AuthContext";
import { subscribeCompetitors, type Competitor } from "@/lib/competitors";
import { subscribeActiveTournament, type Tournament } from "@/lib/tournaments";
import { createMatch, subscribeMatches, type Match } from "@/lib/matches";
import {
  getBracket, renameBracket, deleteBracket, buildRounds, updateBracketSeededIds,
  type Bracket, type BracketMatchup,
} from "@/lib/brackets";

// ─── Layout constants ─────────────────────────────────────────────────────────

const CARD_W    = 200;
const CARD_H    = 52;
const GAP       = 8;
const MATCHUP_H = CARD_H * 2 + GAP;  // 112
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

// ─── Add-competitor dialog ────────────────────────────────────────────────────

function AddCompetitorDialog({
  available,
  onAdd,
  onClose,
}: {
  available: Competitor[];
  onAdd: (competitorId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [saving, setSaving] = useState(false);

  const sel = "w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:border-accent transition-colors appearance-none [color-scheme:dark]";

  async function handleAdd() {
    if (!selectedId || saving) return;
    setSaving(true);
    await onAdd(selectedId);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-surface border border-border rounded-2xl shadow-2xl">
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <h2 className="text-base font-semibold text-primary">Add Competitor</h2>
          <p className="text-xs text-secondary mt-1">Select a competitor to add to this bracket.</p>
        </div>
        <div className="px-6 py-5">
          {available.length === 0 ? (
            <p className="text-sm text-secondary">All competitors are already in this bracket.</p>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-secondary uppercase tracking-widest mb-1.5">Competitor</label>
              <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className={sel}>
                <option value="">Select a competitor…</option>
                {available.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName} · {c.schoolName} · {c.weightKg}kg
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-border flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-secondary hover:text-primary hover:bg-elevated transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleAdd} disabled={!selectedId || saving || available.length === 0}
            className="flex-1 px-4 py-2.5 rounded-lg bg-accent text-black text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-40">
            {saving ? "Adding…" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Remove-competitor dialog ─────────────────────────────────────────────────

function RemoveCompetitorDialog({
  bracketCompetitors,
  onRemove,
  onClose,
}: {
  bracketCompetitors: Competitor[];
  onRemove: (competitorId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [saving, setSaving] = useState(false);

  const sel = "w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:border-accent transition-colors appearance-none [color-scheme:dark]";

  async function handleRemove() {
    if (!selectedId || saving) return;
    setSaving(true);
    await onRemove(selectedId);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-surface border border-border rounded-2xl shadow-2xl">
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <h2 className="text-base font-semibold text-primary">Remove Competitor</h2>
          <p className="text-xs text-secondary mt-1">Select a competitor to remove from this bracket.</p>
        </div>
        <div className="px-6 py-5">
          {bracketCompetitors.length === 0 ? (
            <p className="text-sm text-secondary">No competitors in this bracket.</p>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-secondary uppercase tracking-widest mb-1.5">Competitor</label>
              <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className={sel}>
                <option value="">Select a competitor…</option>
                {bracketCompetitors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName} · {c.schoolName} · {c.weightKg}kg
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-border flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-secondary hover:text-primary hover:bg-elevated transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleRemove} disabled={!selectedId || saving || bracketCompetitors.length === 0}
            className="flex-1 px-4 py-2.5 rounded-lg bg-danger text-white text-sm font-semibold hover:bg-danger/80 transition-colors disabled:opacity-40">
            {saving ? "Removing…" : "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Swap-competitor dialog ───────────────────────────────────────────────────

function SwapCompetitorDialog({
  targetId,
  opponentId,
  bracketCompetitors,
  cMap,
  onSwap,
  onClose,
}: {
  targetId: string;
  opponentId: string | null;
  bracketCompetitors: Competitor[];
  cMap: Map<string, Competitor>;
  onSwap: (targetId: string, replaceWithId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [saving, setSaving] = useState(false);

  const target  = cMap.get(targetId);
  const options = bracketCompetitors.filter((c) => c.id !== targetId && c.id !== opponentId);

  const sel = "w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:border-accent transition-colors appearance-none [color-scheme:dark]";

  async function handleSwap() {
    if (!selectedId || saving) return;
    setSaving(true);
    await onSwap(targetId, selectedId);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-surface border border-border rounded-2xl shadow-2xl">
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <h2 className="text-base font-semibold text-primary">Swap Competitor</h2>
          {target && (
            <p className="text-xs text-secondary mt-1">
              Swapping <span className="font-semibold text-primary">{target.firstName} {target.lastName}</span> with another competitor in this bracket.
            </p>
          )}
        </div>
        <div className="px-6 py-5">
          {options.length === 0 ? (
            <p className="text-sm text-secondary">No other competitors available to swap with.</p>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-secondary uppercase tracking-widest mb-1.5">Swap with</label>
              <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className={sel}>
                <option value="">Select a competitor…</option>
                {options.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName} · {c.schoolName}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-border flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-secondary hover:text-primary hover:bg-elevated transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSwap} disabled={!selectedId || saving || options.length === 0}
            className="flex-1 px-4 py-2.5 rounded-lg bg-accent text-black text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-40">
            {saving ? "Swapping…" : "Swap"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Create-match dialog (pre-filled from bracket) ───────────────────────────

function BracketMatchDialog({
  p1,
  p2,
  tournament,
  currentCount,
  onClose,
}: {
  p1: Competitor;
  p2: Competitor;
  tournament: Tournament;
  currentCount: number;
  onClose: () => void;
}) {
  const arenas = Array.from({ length: tournament.arenaCount }, (_, i) => i + 1);
  const [arenaNumber,          setArenaNumber]          = useState<number>(arenas[0] ?? 1);
  const [roundDurationSeconds, setRoundDurationSeconds] = useState<90 | 120>(120);
  const [dirtyTime,            setDirtyTime]            = useState(false);
  const [saving,               setSaving]               = useState(false);
  const [error,                setError]                = useState("");

  const sel = "w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:border-accent transition-colors appearance-none [color-scheme:dark]";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createMatch({
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        arenaNumber,
        redCornerCompetitorId: p1.id,
        blueCornerCompetitorId: p2.id,
        roundDurationSeconds,
        dirtyTime,
        currentCount,
      });
      onClose();
    } catch {
      setError("Failed to create match. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl">
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <h2 className="text-base font-semibold text-primary">Create Match</h2>
          <p className="text-xs text-secondary mt-1">{tournament.name} · Match #{currentCount + 1}</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5 text-danger">Red Corner</label>
                <div className="px-3 py-2.5 bg-danger/5 border border-danger/20 rounded-lg">
                  <p className="text-sm font-semibold text-primary truncate">{p1.firstName} {p1.lastName}</p>
                  <p className="text-xs text-secondary mt-0.5">{p1.weightKg}kg</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5 text-blue-400">Blue Corner</label>
                <div className="px-3 py-2.5 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                  <p className="text-sm font-semibold text-primary truncate">{p2.firstName} {p2.lastName}</p>
                  <p className="text-xs text-secondary mt-0.5">{p2.weightKg}kg</p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-secondary uppercase tracking-widest mb-1.5">Arena</label>
              {arenas.length <= 1 ? (
                <p className="text-sm text-primary px-3 py-2 bg-elevated border border-border rounded-lg">Arena {arenas[0] ?? 1}</p>
              ) : (
                <select value={arenaNumber} onChange={(e) => setArenaNumber(Number(e.target.value))} className={sel}>
                  {arenas.map((n) => <option key={n} value={n}>Arena {n}</option>)}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-secondary uppercase tracking-widest mb-1.5">Round Duration</label>
              <div className="grid grid-cols-2 gap-2">
                {([120, 90] as const).map((secs) => (
                  <button
                    key={secs}
                    type="button"
                    onClick={() => setRoundDurationSeconds(secs)}
                    className={`py-2.5 rounded-lg text-sm font-semibold border transition-colors ${
                      roundDurationSeconds === secs
                        ? "bg-accent/10 border-accent text-accent"
                        : "bg-elevated border-border text-secondary hover:text-primary"
                    }`}
                  >
                    {secs === 120 ? "2:00" : "1:30"}
                  </button>
                ))}
              </div>
            </div>

            <div
              className="flex items-center justify-between px-4 py-3 bg-elevated border border-border rounded-lg cursor-pointer select-none"
              onClick={() => setDirtyTime((v) => !v)}
            >
              <div>
                <p className="text-sm font-semibold text-primary">Dirty Time</p>
                <p className="text-xs text-secondary mt-0.5">Allow dewan to score while timer is running</p>
              </div>
              <div className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${dirtyTime ? "bg-accent" : "bg-border"}`}>
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${dirtyTime ? "translate-x-4" : "translate-x-0.5"}`} />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-danger/5 border border-danger/30 rounded-lg px-3 py-2.5">
                <span className="text-danger text-xs mt-0.5 flex-shrink-0">✕</span>
                <p className="text-xs text-danger">{error}</p>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-border flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-secondary hover:text-primary hover:bg-elevated transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-lg bg-accent text-black text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-40">
              {saving ? "Creating…" : "Create Match"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Competitor card ──────────────────────────────────────────────────────────

function CompCard({
  competitor,
  onSwap,
}: {
  competitor: Competitor | null | undefined;
  onSwap?: () => void;
}) {
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
      <div className="flex items-center gap-1 flex-shrink-0 ml-1.5">
        <span className="text-xs text-muted">{competitor.weightKg}kg</span>
        {onSwap && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onSwap(); }}
            className="w-5 h-5 flex items-center justify-center rounded text-muted hover:text-primary hover:bg-border/50 transition-colors text-[11px] leading-none"
            title="Swap with another competitor"
          >
            ⇄
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Matchup box ──────────────────────────────────────────────────────────────

function MatchupBox({
  matchup,
  cMap,
  matchPairSet,
  matchedCompetitorIds,
  onCreateMatch,
  onSwap,
}: {
  matchup: BracketMatchup;
  cMap: Map<string, Competitor>;
  matchPairSet: Set<string>;
  matchedCompetitorIds: Set<string>;
  onCreateMatch: (p1Id: string, p2Id: string) => void;
  onSwap: (targetId: string, opponentId: string | null) => void;
}) {
  const p1 = matchup.p1Id ? cMap.get(matchup.p1Id) ?? null : null;
  const p2 = matchup.p2Id ? cMap.get(matchup.p2Id) ?? null : null;
  const canCreate = matchup.p1Id !== null && matchup.p2Id !== null;
  const hasMatch  = canCreate && matchPairSet.has(`${matchup.p1Id}|${matchup.p2Id}`);

  return (
    <div style={{ height: MATCHUP_H, position: "relative" }} className="flex flex-col">
      <CompCard
        competitor={p1}
        onSwap={p1 && !matchedCompetitorIds.has(p1.id) ? () => onSwap(p1.id, matchup.p2Id) : undefined}
      />
      <div style={{ height: GAP }} />
      <CompCard
        competitor={p2}
        onSwap={p2 && !matchedCompetitorIds.has(p2.id) ? () => onSwap(p2.id, matchup.p1Id) : undefined}
      />
      {canCreate && (
        <button
          type="button"
          disabled={hasMatch}
          onClick={hasMatch ? undefined : () => onCreateMatch(matchup.p1Id!, matchup.p2Id!)}
          style={{ position: "absolute", right: -13, top: "50%", transform: "translateY(-50%)", zIndex: 10 }}
          className={`w-[26px] h-[26px] flex items-center justify-center transition-opacity flex-shrink-0 ${hasMatch ? "cursor-default" : "hover:opacity-70"}`}
          title={hasMatch ? "Match already created" : "Create match"}
        >
          <img src={hasMatch ? "/check.svg" : "/play.svg"} alt={hasMatch ? "Match created" : "Create match"} className="w-[26px] h-[26px]" />
        </button>
      )}
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
  const [tournament,    setTournament]    = useState<Tournament | null>(null);
  const [matches,       setMatches]       = useState<Match[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [notFound,      setNotFound]      = useState(false);
  const [renaming,      setRenaming]      = useState(false);
  const [nameInput,     setNameInput]     = useState("");
  const [saving,        setSaving]        = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  const [matchDialog,   setMatchDialog]   = useState<{ p1Id: string; p2Id: string } | null>(null);
  const [addDialog,     setAddDialog]     = useState(false);
  const [removeDialog,  setRemoveDialog]  = useState(false);
  const [swapDialog,    setSwapDialog]    = useState<{ targetId: string; opponentId: string | null } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!params?.id) return;
    getBracket(params.id).then((b) => {
      if (!b) setNotFound(true);
      else setBracket(b);
    });
  }, [params?.id]);

  useEffect(() => {
    if (!user) return;
    return subscribeActiveTournament(user.uid, setTournament);
  }, [user]);

  useEffect(() => {
    if (!tournament?.id) { setMatches([]); return; }
    return subscribeMatches(tournament.id, setMatches);
  }, [tournament?.id]);

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

  const bracketIds = useMemo(() => {
    const ids = new Set<string>();
    (bracket?.seededIds ?? []).forEach((id) => { if (id) ids.add(id); });
    return ids;
  }, [bracket]);

  const bracketCompetitors = useMemo(() =>
    competitors.filter((c) => bracketIds.has(c.id)),
    [competitors, bracketIds]
  );

  const availableToAdd = useMemo(() =>
    competitors.filter((c) => !bracketIds.has(c.id)),
    [competitors, bracketIds]
  );

  const matchPairSet = useMemo(() => {
    const s = new Set<string>();
    matches.forEach((m) => {
      s.add(`${m.redCornerCompetitorId}|${m.blueCornerCompetitorId}`);
      s.add(`${m.blueCornerCompetitorId}|${m.redCornerCompetitorId}`);
    });
    return s;
  }, [matches]);

  const matchedCompetitorIds = useMemo(() => {
    const s = new Set<string>();
    matches.forEach((m) => {
      s.add(m.redCornerCompetitorId);
      s.add(m.blueCornerCompetitorId);
    });
    return s;
  }, [matches]);

  const rounds = useMemo(() => {
    if (!bracket) return [];
    return buildRounds(bracket.seededIds);
  }, [bracket]);

  const numByes = useMemo(() => {
    const realIds = (bracket?.seededIds ?? []).filter((id): id is string => id !== null);
    const n = realIds.length;
    let P = 1;
    while (P < n) P *= 2;
    return P - n;
  }, [bracket]);

  const numRounds = rounds.length;

  const TOTAL_H = useMemo(() => {
    const maxM = rounds.length > 0 ? Math.max(...rounds.map((r) => r.length)) : 1;
    return Math.max(maxM * SLOT_H, MATCHUP_H + 40);
  }, [rounds]);

  const TOTAL_W = numRounds * CARD_W + Math.max(0, numRounds - 1) * CONN_W;

  async function handleAddCompetitor(competitorId: string) {
    if (!bracket) return;
    const newSeededIds = [...bracket.seededIds, competitorId];
    await updateBracketSeededIds(bracket.id, newSeededIds);
    setBracket((b) => b ? { ...b, seededIds: newSeededIds } : b);
    setAddDialog(false);
  }

  async function handleRemoveCompetitor(competitorId: string) {
    if (!bracket) return;
    const newSeededIds = bracket.seededIds.filter((id) => id !== competitorId);
    await updateBracketSeededIds(bracket.id, newSeededIds);
    setBracket((b) => b ? { ...b, seededIds: newSeededIds } : b);
    setRemoveDialog(false);
  }

  async function handleSwap(targetId: string, replaceWithId: string) {
    if (!bracket) return;
    const newSeededIds = bracket.seededIds.map((id) =>
      id === targetId ? replaceWithId : id === replaceWithId ? targetId : id
    );
    await updateBracketSeededIds(bracket.id, newSeededIds);
    setBracket((b) => b ? { ...b, seededIds: newSeededIds } : b);
    setSwapDialog(null);
  }

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

  const dialogP1 = matchDialog ? cMap.get(matchDialog.p1Id) : undefined;
  const dialogP2 = matchDialog ? cMap.get(matchDialog.p2Id) : undefined;

  return (
    <Shell title={bracket?.name ?? "Bracket"}>
      {/* Rename / add / delete row */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
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
            <button type="submit" disabled={!nameInput.trim() || saving}
              className="px-3 py-1.5 rounded-lg bg-accent text-black text-xs font-semibold hover:bg-accent-hover transition-colors disabled:opacity-40">
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={cancelRename}
              className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-secondary hover:text-primary hover:bg-elevated transition-colors">
              Cancel
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={startRename}
              className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-secondary hover:text-primary hover:bg-elevated transition-colors">
              ✎ Rename
            </button>
            <button type="button" onClick={() => setAddDialog(true)}
              className="px-3 py-1.5 rounded-lg border border-accent/40 text-xs font-semibold text-accent hover:bg-accent/10 transition-colors">
              + Add Competitor
            </button>
            <button type="button" onClick={() => setRemoveDialog(true)}
              className="px-3 py-1.5 rounded-lg border border-danger/40 text-xs font-semibold text-danger hover:bg-danger/10 transition-colors">
              − Remove Competitor
            </button>
            <button type="button" onClick={() => setConfirmDelete(true)}
              className="px-3 py-1.5 rounded-lg border border-danger/40 text-xs font-semibold text-danger hover:bg-danger/10 transition-colors">
              Delete Bracket
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto pb-6">
        <div className="relative inline-block" style={{ width: TOTAL_W + 26, height: TOTAL_H + 48 }}>
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
                  <MatchupBox
                    key={i}
                    matchup={matchup}
                    cMap={cMap}
                    matchPairSet={matchPairSet}
                    matchedCompetitorIds={matchedCompetitorIds}
                    onCreateMatch={(p1Id, p2Id) => setMatchDialog({ p1Id, p2Id })}
                    onSwap={(targetId, opponentId) => setSwapDialog({ targetId, opponentId })}
                  />
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
              <button type="button" onClick={() => setConfirmDelete(false)} disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-secondary hover:text-primary hover:bg-elevated transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button type="button" disabled={deleting}
                onClick={async () => {
                  if (!bracket) return;
                  setDeleting(true);
                  await deleteBracket(bracket.id);
                  router.push("/brackets");
                }}
                className="flex-1 px-4 py-2.5 rounded-lg bg-danger text-white text-sm font-semibold hover:bg-danger/80 transition-colors disabled:opacity-50">
                {deleting ? "Deleting…" : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create-match dialog */}
      {matchDialog && tournament && dialogP1 && dialogP2 && (
        <BracketMatchDialog
          p1={dialogP1}
          p2={dialogP2}
          tournament={tournament}
          currentCount={matches.length}
          onClose={() => setMatchDialog(null)}
        />
      )}

      {/* Add competitor dialog */}
      {addDialog && (
        <AddCompetitorDialog
          available={availableToAdd}
          onAdd={handleAddCompetitor}
          onClose={() => setAddDialog(false)}
        />
      )}

      {/* Remove competitor dialog */}
      {removeDialog && (
        <RemoveCompetitorDialog
          bracketCompetitors={bracketCompetitors}
          onRemove={handleRemoveCompetitor}
          onClose={() => setRemoveDialog(false)}
        />
      )}

      {/* Swap competitor dialog */}
      {swapDialog && (
        <SwapCompetitorDialog
          targetId={swapDialog.targetId}
          opponentId={swapDialog.opponentId}
          bracketCompetitors={bracketCompetitors}
          cMap={cMap}
          onSwap={handleSwap}
          onClose={() => setSwapDialog(null)}
        />
      )}
    </Shell>
  );
}
