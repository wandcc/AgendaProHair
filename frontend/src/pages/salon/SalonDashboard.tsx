import { useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CalendarClock, CalendarPlus, Coins, Copy, Inbox, Wallet, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { brl, longDate } from "@/lib/format";
import { useMe } from "@/lib/useMe";
import type { Appointment } from "@/lib/types";
import { EmptyState, PageHeader, Panel, StatCard, StatusBadge } from "@/components/common";
import { AppointmentDetailDialog, NewAppointmentDialog, useDashboard } from "@/components/AppointmentDialogs";
import { Button, buttonVariants } from "@/components/ui/button";

export default function SalonDashboard() {
  const me = useMe();
  const dash = useDashboard();
  const d = dash.isError ? undefined : dash.data;
  const [newOpen, setNewOpen] = useState(false);
  const [detail, setDetail] = useState<Appointment | null>(null);
  const bookingUrl = `${window.location.origin}/agendar/${me.data?.salon_slug ?? ""}`;
  const dashTxt = "—";

  const copy = async () => {
    await navigator.clipboard.writeText(bookingUrl).catch(() => null);
    toast.success("Link de agendamento copiado!");
  };

  return (
    <>
      <PageHeader
        title={`Olá, ${me.data?.name.split(" ")[0] ?? ""}`}
        subtitle={d ? `${longDate(d.today)} · ${me.data?.salon_name ?? ""}` : me.data?.salon_name ?? ""}
        actions={
          <>
            <Button variant="outline" onClick={copy} data-testid="btn-dashboard-copy-link"><Copy className="size-4" /> Copiar link</Button>
            <Button onClick={() => setNewOpen(true)} data-testid="btn-quick-new-appointment"><CalendarPlus className="size-4" /> Novo agendamento</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard testId="kpi-revenue-today" label="Faturamento hoje" value={d ? brl(d.revenue_today) : dashTxt} hint="Atendimentos finalizados" icon={<Wallet className="size-4.5" />} tone="emerald" />
        <StatCard testId="kpi-revenue-month" label="Faturamento do mês" value={d ? brl(d.revenue_month) : dashTxt} hint={d ? `Previsão: ${brl(d.forecast_month)}` : undefined} icon={<TrendingUp className="size-4.5" />} />
        <StatCard testId="kpi-appointments-today" label="Agendamentos hoje" value={d?.appointments_today_count ?? dashTxt} hint={d ? `${d.pending_today} aguardando atendimento` : undefined} icon={<CalendarClock className="size-4.5" />} tone="rose" />
        <StatCard testId="kpi-commissions-pending" label="Comissões a pagar" value={d ? brl(d.commissions_pending) : dashTxt} hint="Acumulado não pago" icon={<Coins className="size-4.5" />} tone="amber" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Panel title="Agendamentos de hoje" testId="panel-today-appointments" action={<Link to="/app/agenda" className="text-sm font-medium text-indigo-600" data-testid="link-open-agenda">Abrir agenda</Link>}>
          {d && d.appointments_today.length ? (
            <ul className="-my-2 divide-y divide-slate-100">
              {d.appointments_today.map((a) => (
                <li key={a.id}>
                  <button onClick={() => setDetail(a)} data-testid="appointment-card-item" className="flex w-full items-center gap-4 py-3 text-left transition-colors hover:bg-slate-50/80">
                    <span className="w-14 shrink-0 font-mono text-sm font-semibold text-slate-900">{a.start}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">{a.client_name}</p>
                      <p className="truncate text-xs text-slate-500">{a.service_name} · {a.professional_name}</p>
                    </div>
                    <span className="hidden text-sm font-medium text-slate-700 sm:block">{brl(a.price)}</span>
                    <StatusBadge status={a.status} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<Inbox className="size-5" />} title="Nenhum agendamento hoje" text="Compartilhe seu link de agendamento para receber clientes online." action={<Link to="/app/link" className={buttonVariants({ variant: "outline" })}>Ver meu link</Link>} />
          )}
        </Panel>

        <Panel title="Notificações" testId="panel-notifications" action={<Bell className="size-4 text-slate-400" />}>
          {d && d.notifications.length ? (
            <ul className="space-y-3">
              {d.notifications.map((n) => (
                <li key={n.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3" data-testid="notification-item">
                  <p className="text-sm font-semibold text-slate-900">{n.title}</p>
                  <p className="mt-0.5 text-xs text-slate-600">{n.message}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Novos agendamentos feitos pelo link aparecerão aqui.</p>
          )}
        </Panel>
      </div>

      <NewAppointmentDialog open={newOpen} onOpenChange={setNewOpen} defaultDate={d?.today ?? ""} />
      <AppointmentDetailDialog appt={detail} salonName={me.data?.salon_name ?? ""} onClose={() => setDetail(null)} />
    </>
  );
}
