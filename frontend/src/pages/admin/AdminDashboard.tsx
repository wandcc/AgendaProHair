import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, BadgeCheck, CircleDollarSign, Store, Users } from "lucide-react";
import { apiGet } from "@/lib/api";
import { brl } from "@/lib/format";
import type { AdminMetrics, SalonAdminRow } from "@/lib/types";
import { EmptyState, PageHeader, Panel, StatCard } from "@/components/common";
import { buttonVariants } from "@/components/ui/button";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SalonStatusBadge } from "@/pages/admin/AdminSalons";

// Chart props hoisted so Recharts doesn't receive new objects on every render.
const AXIS_TICK = { fontSize: 12, fill: "#475569" };
const BAR_RADIUS: [number, number, number, number] = [8, 8, 0, 0];
const fmtBrlTick = (v: number) => `R$${v}`;
const fmtBrl = (value: number) => brl(value);

export default function AdminDashboard() {
  const metrics = useQuery({ queryKey: ["admin", "metrics"], queryFn: () => apiGet<AdminMetrics>("/admin/metrics") });
  const salons = useQuery({ queryKey: ["admin", "salons"], queryFn: () => apiGet<SalonAdminRow[]>("/admin/salons") });
  const m = metrics.isError ? undefined : metrics.data;
  const dash = "—";
  const health = m && m.total_salons ? Math.round((m.active / m.total_salons) * 100) : 0;
  const recent = (salons.isError ? [] : salons.data ?? []).slice(0, 5);

  return (
    <>
      <PageHeader
        title="Visão Geral da Plataforma"
        subtitle="Métricas de assinaturas, receita recorrente e saúde das licenças."
        actions={<Link to="/admin/assinantes" className={buttonVariants()} data-testid="btn-goto-subscribers">Gerenciar assinantes <ArrowRight className="size-4" /></Link>}
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard testId="kpi-mrr" label="MRR (Receita Recorrente)" value={m ? brl(m.mrr) : dash} hint="Soma dos planos de salões ativos" icon={<CircleDollarSign className="size-4.5" />} />
        <StatCard testId="kpi-total-salons" label="Salões cadastrados" value={m?.total_salons ?? dash} hint={m ? `${m.total_users} acessos de usuários` : undefined} icon={<Store className="size-4.5" />} tone="rose" />
        <StatCard testId="kpi-total-pros" label="Profissionais ativos" value={m?.total_professionals ?? dash} hint="Em todos os salões" icon={<Users className="size-4.5" />} tone="slate" />
        <StatCard testId="kpi-license-health" label="Licenças ativas / inadimplentes" value={m ? `${m.active} / ${m.delinquent}` : dash} hint={m ? `${health}% ativas · ${m.suspended} suspensas` : undefined} icon={<BadgeCheck className="size-4.5" />} tone="emerald" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Panel title="Receita por plano" testId="panel-plan-revenue">
          {m && m.plans.length ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={m.plans}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="plan_name" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={60} tickFormatter={fmtBrlTick} />
                  <Tooltip formatter={fmtBrl} />
                  <Bar dataKey="revenue" name="MRR" fill="#4F46E5" radius={BAR_RADIUS} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState icon={<CircleDollarSign className="size-5" />} title="Sem receita ainda" text="Cadastre o primeiro salão assinante para começar a acompanhar o MRR." />
          )}
        </Panel>

        <Panel title="Últimos salões" testId="panel-recent-salons" action={<Link to="/admin/assinantes" className="text-sm font-medium text-indigo-600">Ver todos</Link>}>
          {recent.length ? (
            <ul className="divide-y divide-slate-100">
              {recent.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-3" data-testid={`recent-salon-${s.slug}`}>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{s.name} {s.is_demo && <span className="ml-1 rounded bg-slate-100 px-1.5 text-[10px] font-semibold uppercase text-slate-500">demo</span>}</p>
                    <p className="text-xs text-slate-500">{s.plan_name} · {brl(s.plan_price)}/mês</p>
                  </div>
                  <SalonStatusBadge status={s.status} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<Store className="size-5" />} title="Nenhum salão" text="Os salões cadastrados aparecerão aqui." />
          )}
          {m && m.delinquent > 0 && (
            <p className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800" data-testid="delinquent-alert">
              <AlertTriangle className="size-4" /> {m.delinquent} salão(ões) com pagamento em atraso.
            </p>
          )}
        </Panel>
      </div>
    </>
  );
}
