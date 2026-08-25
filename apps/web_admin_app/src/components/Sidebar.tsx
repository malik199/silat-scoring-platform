"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { signOut } from "@/lib/auth";
import { subscribeActiveTournament, type Tournament } from "@/lib/tournaments";
import { subscribeBrackets, type Bracket } from "@/lib/brackets";

const NAV = [
  { label: "Tournament",  href: "/tournaments", icon: "🏆" },
  { label: "Competitors", href: "/competitors", icon: "👤" },
  { label: "Brackets",    href: "/brackets",    icon: "🌿" },
  { label: "Matches",     href: "/matches",     icon: "🤼" },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, userProfile } = useAuth();

  const [tournament,        setTournament]        = useState<Tournament | null | undefined>(undefined);
  const [brackets,          setBrackets]          = useState<Bracket[]>([]);
  const [desktopCollapsed,  setDesktopCollapsed]  = useState(false);

  // Restore desktop collapse preference
  useEffect(() => {
    try {
      setDesktopCollapsed(localStorage.getItem("sidebar-collapsed") === "true");
    } catch {}
  }, []);

  useEffect(() => {
    if (!user) return;
    return subscribeActiveTournament(user.uid, setTournament);
  }, [user]);

  useEffect(() => {
    if (!tournament?.id) { setBrackets([]); return; }
    return subscribeBrackets(tournament.id, setBrackets);
  }, [tournament?.id]);

  const arenaCount = tournament?.arenaCount ?? 0;

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : "??";

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  function toggleDesktop() {
    const next = !desktopCollapsed;
    setDesktopCollapsed(next);
    try { localStorage.setItem("sidebar-collapsed", String(next)); } catch {}
  }

  const close = () => onClose?.();

  // On desktop, collapsed = icon rail (w-16); expanded = full (w-64)
  const dc = desktopCollapsed;

  return (
    <aside className={`
      flex flex-col bg-surface border-r border-border flex-shrink-0
      fixed inset-y-0 left-0 z-50 transition-all duration-300
      lg:relative lg:translate-x-0 lg:z-auto
      ${isOpen ? "translate-x-0 w-64" : "-translate-x-full w-64"}
      ${dc ? "lg:w-16" : "lg:w-64"}
    `}>

      {/* Logo / collapse toggle */}
      <div className={`flex items-center border-b border-border flex-shrink-0 ${dc ? "justify-center px-0 py-4" : "px-5 py-4"}`}>
        {dc ? (
          /* Collapsed: just the toggle button */
          <button
            type="button"
            onClick={toggleDesktop}
            className="hidden lg:flex w-9 h-9 items-center justify-center rounded-lg text-muted hover:text-primary hover:bg-elevated transition-colors"
            title="Expand sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        ) : (
          /* Expanded: logo + collapse button */
          <div className="flex items-center justify-between w-full">
            <img src="/logo.svg" alt="Silat Score" className="h-[120px] w-auto" />
            <button
              type="button"
              onClick={toggleDesktop}
              className="hidden lg:flex w-8 h-8 items-center justify-center rounded-lg text-muted hover:text-primary hover:bg-elevated transition-colors flex-shrink-0"
              title="Collapse sidebar"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* User header */}
      <div className={`flex items-center border-b border-border flex-shrink-0 ${dc ? "justify-center px-0 py-3" : "gap-3 px-5 py-4"}`}>
        <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center font-semibold text-black text-sm flex-shrink-0">
          {initials}
        </div>
        {!dc && (
          <div className="flex-1 min-w-0 lg:block">
            <p className="text-sm font-semibold text-primary truncate">{user?.email ?? "Admin"}</p>
            <p className="text-xs text-secondary truncate">Silat Admin</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className={`flex-1 py-4 space-y-1 overflow-y-auto ${dc ? "px-2" : "px-3"}`}>
        {!dc && (
          <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Main</p>
        )}

        {NAV.map(({ label, href, icon }) => {
          const active       = pathname === href;
          const isTournaments = href === "/tournaments";
          const isBrackets   = href === "/brackets";
          const activeTournamentHref = tournament ? `/tournaments/${tournament.id}` : null;
          const subActive    = activeTournamentHref ? pathname === activeTournamentHref : false;

          return (
            <div key={href}>
              <Link
                href={href}
                onClick={close}
                title={dc ? label : undefined}
                className={`flex items-center rounded-lg text-sm font-medium transition-colors ${
                  dc ? "justify-center px-0 py-2.5 w-full" : "gap-3 px-3 py-2"
                } ${active ? "bg-accent text-black" : "text-secondary hover:bg-elevated hover:text-primary"}`}
              >
                <span className="text-base leading-none flex-shrink-0">{icon}</span>
                {!dc && label}
              </Link>

              {/* Sub-items only when expanded */}
              {!dc && isTournaments && tournament && (
                <div className="ml-2 border-l border-border pl-2 mt-0.5">
                  <Link
                    href={`/tournaments/${tournament.id}`}
                    onClick={close}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors truncate ${subActive ? "bg-accent text-black" : "text-secondary hover:bg-elevated hover:text-primary"}`}
                  >
                    <span className="text-xs leading-none text-muted">▶</span>
                    <span className="truncate">{tournament.name}</span>
                  </Link>
                </div>
              )}
              {!dc && isBrackets && brackets.length > 0 && (
                <div className="ml-2 border-l border-border pl-2 mt-0.5">
                  {brackets.map((b) => {
                    const bracketActive = pathname === `/brackets/${b.id}`;
                    return (
                      <Link
                        key={b.id}
                        href={`/brackets/${b.id}`}
                        onClick={close}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors truncate ${bracketActive ? "bg-accent text-black" : "text-secondary hover:bg-elevated hover:text-primary"}`}
                      >
                        <span className="text-xs leading-none text-muted">▶</span>
                        <span className="truncate">{b.name}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Arenas */}
        {arenaCount > 0 && (
          <div className={dc ? "" : "pt-3"}>
            {!dc && (
              <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Arenas</p>
            )}
            {dc && <div className="my-1 border-t border-border" />}
            <div className={dc ? "space-y-1" : "ml-2 border-l border-border pl-2 space-y-0.5"}>
              {Array.from({ length: arenaCount }, (_, i) => i + 1).map((n) => (
                <a
                  key={n}
                  href={`/arena/${n}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={dc ? `Arena ${n} Screen` : undefined}
                  className={`flex items-center rounded-lg text-sm font-medium text-secondary hover:bg-elevated hover:text-primary transition-colors ${dc ? "justify-center px-0 py-2.5 w-full" : "gap-2 px-3 py-2"}`}
                >
                  <span className={`leading-none ${dc ? "text-base" : "text-xs text-muted"}`}>{dc ? "↗" : "↗"}</span>
                  {!dc && `Arena ${n} Screen`}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Dewan */}
        {arenaCount > 0 && (
          <div className={dc ? "" : "pt-3"}>
            {!dc && (
              <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Dewan</p>
            )}
            {dc && <div className="my-1 border-t border-border" />}
            <div className={dc ? "space-y-1" : "ml-2 border-l border-border pl-2 space-y-0.5"}>
              {Array.from({ length: arenaCount }, (_, i) => i + 1).map((n) => {
                const active = pathname === `/dewan/${n}`;
                return (
                  <Link
                    key={n}
                    href={`/dewan/${n}`}
                    onClick={close}
                    title={dc ? `Dewan ${n}` : undefined}
                    className={`flex items-center rounded-lg text-sm font-medium transition-colors ${
                      dc ? "justify-center px-0 py-2.5 w-full" : "gap-2 px-3 py-2"
                    } ${active ? "bg-accent text-black" : "text-secondary hover:bg-elevated hover:text-primary"}`}
                  >
                    <span className="text-base leading-none">⚖</span>
                    {!dc && `Dewan ${n}`}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Super Admin */}
        {userProfile?.isSuperAdmin && (
          <div className={dc ? "" : "pt-3"}>
            {!dc && (
              <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-widest text-muted">System</p>
            )}
            {dc && <div className="my-1 border-t border-border" />}
            <Link
              href="/superadmin"
              onClick={close}
              title={dc ? "Super Admin" : undefined}
              className={`flex items-center rounded-lg text-sm font-medium transition-colors ${
                dc ? "justify-center px-0 py-2.5 w-full" : "gap-3 px-3 py-2"
              } ${pathname === "/superadmin" ? "bg-accent text-black" : "text-secondary hover:bg-elevated hover:text-primary"}`}
            >
              <span className="text-base leading-none">🛡</span>
              {!dc && "Super Admin"}
            </Link>
          </div>
        )}
      </nav>

      {/* Sign out */}
      <div className={`border-t border-border flex-shrink-0 ${dc ? "px-2 py-3" : "px-3 py-4"}`}>
        <button
          onClick={() => { close(); handleSignOut(); }}
          title={dc ? "Sign out" : undefined}
          className={`w-full flex items-center rounded-lg text-sm font-medium text-secondary hover:bg-elevated hover:text-primary transition-colors ${dc ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"}`}
        >
          <span className="text-base leading-none">→</span>
          {!dc && "Sign out"}
        </button>
      </div>
    </aside>
  );
}
