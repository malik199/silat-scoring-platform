interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  trend?: "up" | "down" | "neutral";
}

export function StatCard({ label, value, sub, trend }: StatCardProps) {
  const trendColor =
    trend === "up"   ? "text-accent" :
    trend === "down" ? "text-danger" :
    "text-secondary";

  return (
    <div className="bg-surface border border-border rounded-xl px-6 py-5 flex flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-widest text-secondary">{label}</p>
      <p className="text-3xl font-bold text-primary">{value}</p>
      {sub && (
        <p className={`text-sm font-medium ${trendColor}`}>{sub}</p>
      )}
    </div>
  );
}
