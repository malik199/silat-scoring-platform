"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  listAllUsers, getCompetitorCount, getTournamentCount,
  getUserTournaments, setUserTier, setUserSuperAdmin, deleteUserData,
  type UserProfile, type AdminTournament,
} from "@/lib/admin";
import { TIERS, type TierId } from "@/lib/tiers";

// ─── Tier badge ───────────────────────────────────────────────────────────────

const TIER_COLORS: Record<TierId, string> = {
  free:     "bg-muted/20 text-muted border-muted/30",
  starter:  "bg-blue-500/15 text-blue-400 border-blue-500/30",
  club:     "bg-accent/15 text-accent border-accent/30",
  regional: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  elite:    "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
};

// ─── Per-user extra data ──────────────────────────────────────────────────────

interface UserExtra {
  competitorCount: number;
  tournamentCount: number;
  tournaments:     AdminTournament[];
  loading:         boolean;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SuperAdminPage() {
  const router              = useRouter();
  const { user, userProfile, loading: authLoading } = useAuth();

  const [users,    setUsers]    = useState<UserProfile[]>([]);
  const [extra,    setExtra]    = useState<Record<string, UserExtra>>({});
  const [search,   setSearch]   = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  // Guard — redirect non-super-admins
  useEffect(() => {
    if (authLoading) return;
    if (!user || !userProfile?.isSuperAdmin) {
      router.replace("/dashboard");
    }
  }, [authLoading, user, userProfile, router]);

  // Load all users
  useEffect(() => {
    if (!userProfile?.isSuperAdmin) return;
    listAllUsers().then((rows) => {
      setUsers(rows);
      setPageLoading(false);
      // Kick off per-user count loads in parallel
      rows.forEach((u) => {
        setExtra((prev) => ({ ...prev, [u.uid]: { competitorCount: 0, tournamentCount: 0, tournaments: [], loading: true } }));
        Promise.all([getCompetitorCount(u.uid), getTournamentCount(u.uid)]).then(([cc, tc]) => {
          setExtra((prev) => ({ ...prev, [u.uid]: { ...prev[u.uid], competitorCount: cc, tournamentCount: tc, loading: false } }));
        });
      });
    });
  }, [userProfile?.isSuperAdmin]);

  // Load tournaments for an expanded row
  useEffect(() => {
    if (!expanded) return;
    const ex = extra[expanded];
    if (!ex || ex.tournaments.length > 0) return;
    getUserTournaments(expanded).then((tours) => {
      setExtra((prev) => ({ ...prev, [expanded]: { ...prev[expanded], tournaments: tours } }));
    });
  }, [expanded]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleTierChange(uid: string, tier: TierId) {
    await setUserTier(uid, tier);
    setUsers((prev) => prev.map((u) => u.uid === uid ? { ...u, tier } : u));
  }

  async function handleDeleteUser(uid: string, email: string) {
    const confirmed = confirm(
      `Delete data for ${email}?\n\nThis will permanently delete:\n• All their competitors\n• All their tournaments\n• Their platform profile\n\nTheir email/login is kept. This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await deleteUserData(uid);
      setUsers((prev) => prev.filter((u) => u.uid !== uid));
      setExtra((prev) => { const next = { ...prev }; delete next[uid]; return next; });
    } catch (err: unknown) {
      alert(`Failed to delete: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  const BOOTSTRAP_EMAIL = "visdevelopllc@gmail.com";

  async function handleSuperAdminToggle(uid: string, current: boolean, email: string) {
    if (email === BOOTSTRAP_EMAIL) return; // bootstrap admin is permanent
    if (uid === user?.uid && current) {
      if (!confirm("Remove your own super admin access? You will be locked out of this page.")) return;
    }
    await setUserSuperAdmin(uid, !current);
    setUsers((prev) => prev.map((u) => u.uid === uid ? { ...u, isSuperAdmin: !current } : u));
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.displayName ?? "").toLowerCase().includes(q)
    );
  }, [users, search]);

  // Summary stats
  const totalUsers  = users.length;
  const paidUsers   = users.filter((u) => u.tier !== "free").length;
  const tierCounts  = TIERS.reduce((acc, t) => ({ ...acc, [t.id]: users.filter((u) => u.tier === t.id).length }), {} as Record<TierId, number>);

  function formatDate(createdAt: unknown): string {
    if (!createdAt) return "—";
    const ts = createdAt as { seconds?: number };
    if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleDateString();
    return "—";
  }

  if (authLoading || pageLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!userProfile?.isSuperAdmin) return null;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-primary">Super Admin</h1>
          <p className="text-sm text-muted mt-0.5">Manage all users, tiers, and access</p>
        </div>
        <input
          type="search"
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 bg-surface border border-border rounded-lg px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-accent"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatCard label="Total Users" value={totalUsers} />
        <StatCard label="Paid" value={paidUsers} accent />
        {TIERS.map((t) => (
          <StatCard key={t.id} label={t.name} value={tierCounts[t.id] ?? 0} />
        ))}
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted">User</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted">Tier</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted text-right">Competitors</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted text-right">Tournaments</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted">Created</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted text-center">Super Admin</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted text-sm">
                    {search ? "No users match your search." : "No users found."}
                  </td>
                </tr>
              )}
              {filtered.map((u) => {
                const ex = extra[u.uid];
                const isExpanded = expanded === u.uid;
                const initials = (u.displayName || u.email).slice(0, 2).toUpperCase();

                return (
                  <>
                    <tr
                      key={u.uid}
                      className={`hover:bg-elevated transition-colors cursor-pointer ${isExpanded ? "bg-elevated" : ""}`}
                      onClick={() => setExpanded(isExpanded ? null : u.uid)}
                    >
                      {/* User */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-xs font-bold text-black flex-shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-primary truncate max-w-[180px]">
                              {u.displayName || u.email}
                            </p>
                            {u.displayName && (
                              <p className="text-xs text-muted truncate max-w-[180px]">{u.email}</p>
                            )}
                          </div>
                          {u.uid === user?.uid && (
                            <span className="text-xs text-accent font-semibold">(you)</span>
                          )}
                        </div>
                      </td>

                      {/* Tier */}
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={u.tier}
                          onChange={(e) => handleTierChange(u.uid, e.target.value as TierId)}
                          className={`text-xs font-bold border rounded-lg px-2 py-1.5 bg-transparent cursor-pointer focus:outline-none ${TIER_COLORS[u.tier]}`}
                        >
                          {TIERS.map((t) => (
                            <option key={t.id} value={t.id} className="bg-surface text-primary">
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Competitors */}
                      <td className="px-4 py-3 text-right">
                        {ex?.loading ? (
                          <span className="text-muted text-xs">…</span>
                        ) : (
                          <span className="font-semibold text-primary">{ex?.competitorCount ?? 0}</span>
                        )}
                      </td>

                      {/* Tournaments */}
                      <td className="px-4 py-3 text-right">
                        {ex?.loading ? (
                          <span className="text-muted text-xs">…</span>
                        ) : (
                          <span className="font-semibold text-primary">{ex?.tournamentCount ?? 0}</span>
                        )}
                      </td>

                      {/* Created */}
                      <td className="px-4 py-3 text-muted text-xs">
                        {formatDate(u.createdAt)}
                      </td>

                      {/* Super Admin */}
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleSuperAdminToggle(u.uid, u.isSuperAdmin, u.email)}
                          disabled={u.email === BOOTSTRAP_EMAIL}
                          className={`w-10 h-6 rounded-full border-2 transition-colors relative flex-shrink-0 ${
                            u.isSuperAdmin
                              ? "bg-accent border-accent"
                              : "bg-transparent border-border"
                          } ${u.email === BOOTSTRAP_EMAIL ? "opacity-40 cursor-not-allowed" : ""}`}
                          title={u.email === BOOTSTRAP_EMAIL ? "Primary super admin cannot be removed" : u.isSuperAdmin ? "Remove super admin" : "Grant super admin"}
                        >
                          <span
                            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                              u.isSuperAdmin ? "translate-x-4" : "translate-x-0.5"
                            }`}
                          />
                        </button>
                      </td>

                      {/* Delete */}
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        {u.uid !== user?.uid && (
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u.uid, u.email)}
                            className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                            title="Delete account"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                              <path d="M10 11v6M14 11v6"/>
                              <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>

                    {/* Expanded tournament links */}
                    {isExpanded && (
                      <tr key={`${u.uid}-expanded`} className="bg-elevated">
                        <td colSpan={7} className="px-6 py-4">
                          <p className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">
                            Tournaments
                          </p>
                          {ex?.tournaments.length === 0 ? (
                            <p className="text-sm text-muted">No tournaments found.</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {ex?.tournaments.map((t) => (
                                <a
                                  key={t.id}
                                  href={`/tournaments/${t.id}`}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-primary hover:border-accent/60 hover:text-accent transition-colors"
                                >
                                  <span className="text-xs">🏆</span>
                                  {t.name}
                                </a>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="bg-surface border border-border rounded-xl px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted">{label}</p>
      <p className={`text-2xl font-black mt-0.5 ${accent ? "text-accent" : "text-primary"}`}>{value}</p>
    </div>
  );
}
