"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { signOut } from "@/lib/auth";
import { subscribeActiveTournament, type Tournament } from "@/lib/tournaments";

const NAV = [
  { label: "Dashboard",   href: "/",            icon: "▣" },
  { label: "Matches",     href: "/matches",     icon: "⚔" },
  { label: "Tournament",  href: "/tournaments", icon: "🏆" },
  { label: "Competitors", href: "/competitors", icon: "👤" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { user } = useAuth();

  const [tournament, setTournament] = useState<Tournament | null | undefined>(undefined);

  useEffect(() => {
    if (!user) return;
    return subscribeActiveTournament(user.uid, setTournament);
  }, [user]);

  const arenaCount = tournament?.arenaCount ?? 0;

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : "??";

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-surface border-r border-border flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center justify-center px-5 py-4 border-b border-border">
        <img src="/logo.svg" alt="Silat Score" className="h-[168px] w-auto" />
      </div>

      {/* User header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
        <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center text-base font-semibold text-base-content text-black text-sm flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-primary truncate">
            {user?.email ?? "Admin"}
          </p>
          <p className="text-xs text-secondary truncate">Silat Admin</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
          Main
        </p>
        {NAV.map(({ label, href, icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-accent text-black"
                  : "text-secondary hover:bg-elevated hover:text-primary"
              }`}
            >
              <span className="text-base leading-none">{icon}</span>
              {label}
            </Link>
          );
        })}

        {/* Arenas — only shown when there is an active tournament with arenas */}
        {arenaCount > 0 && (
          <div className="pt-3">
            <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
              Arenas
            </p>
            <div className="ml-2 border-l border-border pl-2 space-y-0.5">
              {Array.from({ length: arenaCount }, (_, i) => i + 1).map((n) => (
                <a
                  key={n}
                  href={`/arena/${n}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-secondary hover:bg-elevated hover:text-primary transition-colors"
                >
                  <span className="text-xs leading-none text-muted">↗</span>
                  Arena {n} Screen
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Timekeeper links hidden from nav — pages still exist at /timekeeper/[n] */}

        {/* Dewan — live judge scoring per arena */}
        {arenaCount > 0 && (
          <div className="pt-3">
            <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
              Dewan
            </p>
            <div className="ml-2 border-l border-border pl-2 space-y-0.5">
              {Array.from({ length: arenaCount }, (_, i) => i + 1).map((n) => {
                const active = pathname === `/dewan/${n}`;
                return (
                  <Link
                    key={n}
                    href={`/dewan/${n}`}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? "bg-accent text-black"
                        : "text-secondary hover:bg-elevated hover:text-primary"
                    }`}
                  >
                    <span className="text-xs leading-none">⚖</span>
                    Dewan {n}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Sign out */}
      <div className="px-3 py-4 border-t border-border">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-secondary hover:bg-elevated hover:text-primary transition-colors"
        >
          <span className="text-base leading-none">→</span>
          Sign out
        </button>
      </div>
    </aside>
  );
}
