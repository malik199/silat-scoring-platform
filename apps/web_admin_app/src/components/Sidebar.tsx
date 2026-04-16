"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { signOut } from "@/lib/auth";

const NAV = [
  { label: "Dashboard",   href: "/",            icon: "▣" },
  { label: "Matches",     href: "/matches",     icon: "⚔" },
  { label: "Tournament",  href: "/tournaments", icon: "🏆" },
  { label: "Competitors", href: "/competitors", icon: "👤" },
  { label: "Judges",      href: "/judges",      icon: "⚖" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { user } = useAuth();

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
      <nav className="flex-1 px-3 py-4 space-y-1">
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
