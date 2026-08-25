"use client";

import { type ReactNode, useState } from "react";
import { Sidebar } from "./Sidebar";
import { AuthGuard } from "./AuthGuard";

interface ShellProps {
  children: ReactNode;
  title: string;
  badge?: ReactNode;
}

export function Shell({ children, title, badge }: ShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <AuthGuard>
      <div className="flex h-screen bg-base text-primary overflow-hidden">
        {/* Mobile overlay backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top bar */}
          <header className="flex items-center px-6 py-5 border-b border-border flex-shrink-0 gap-3">
            {/* Hamburger — mobile only */}
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden flex flex-col gap-1.5 p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-elevated transition-colors flex-shrink-0"
              aria-label="Open menu"
            >
              <span className="block w-5 h-0.5 bg-current rounded" />
              <span className="block w-5 h-0.5 bg-current rounded" />
              <span className="block w-5 h-0.5 bg-current rounded" />
            </button>
            <h1 className="text-lg font-semibold text-primary flex-1">{title}</h1>
            {badge}
          </header>
          {/* Scrollable content */}
          <main className="flex-1 overflow-y-auto px-6 lg:px-8 py-6">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
