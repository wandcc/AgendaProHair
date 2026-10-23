import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { STATUS_META } from "@/lib/format";
import type { ApptStatus } from "@/lib/types";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between animate-fade-up">
      <div>
        <h1 data-testid="page-title" className="text-2xl font-bold text-slate-900 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label, value, hint, icon, tone = "indigo", testId,
}: { label: string; value: ReactNode; hint?: string; icon: ReactNode; tone?: "indigo" | "rose" | "emerald" | "amber" | "slate"; testId: string }) {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-600",
    rose: "bg-rose-50 text-rose-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    slate: "bg-slate-100 text-slate-700",
  };
  return (
    <div
      data-testid={testId}
      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className={cn("grid size-9 place-items-center rounded-xl", tones[tone])}>{icon}</span>
      </div>
      <p className="mt-3 font-heading text-2xl font-bold tracking-tight text-slate-900" data-testid={`${testId}-value`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function StatusBadge({ status }: { status: ApptStatus }) {
  const m = STATUS_META[status];
  return (
    <span data-testid={`status-badge-${status}`} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium", m.cls)}>
      <span className={cn("size-1.5 rounded-full", m.dot)} />
      {m.label}
    </span>
  );
}

export function EmptyState({ icon, title, text, action, testId }: { icon: ReactNode; title: string; text?: string; action?: ReactNode; testId?: string }) {
  return (
    <div data-testid={testId ?? "empty-state"} className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center">
      <span className="mb-3 grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-500">{icon}</span>
      <p className="font-heading font-semibold text-slate-900">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Panel({ title, action, children, className, testId }: { title?: string; action?: ReactNode; children: ReactNode; className?: string; testId?: string }) {
  return (
    <section data-testid={testId} className={cn("rounded-2xl border border-slate-200 bg-white shadow-sm", className)}>
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h2 className="font-heading text-base font-semibold text-slate-900">{title}</h2>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}
