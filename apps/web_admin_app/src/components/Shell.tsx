"use client";

import { type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { AuthGuard } from "./AuthGuard";

interface ShellProps {
  children: ReactNode;
  title: string;
  badge?: ReactNode;
}

export function Shell({ children, title, badge }: ShellProps) {
  return (
    <AuthGuard>
      <div className="flex h-screen bg-base text-primary overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top bar */}
          <header className="flex items-center px-8 py-5 border-b border-border flex-shrink-0">
            <h1 className="text-lg font-semibold text-primary flex-1">{title}</h1>
            {badge}
          </header>
          {/* Scrollable content */}
          <main className="flex-1 overflow-y-auto px-8 py-6">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
