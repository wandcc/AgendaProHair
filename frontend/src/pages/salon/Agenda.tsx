import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarPlus, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { apiGet } from "@/lib/api";
import { addDays, longDate, parseDate, shortDate, startOfWeek, STATUS_META, WEEKDAYS } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMe, useReadOnly } from "@/lib/useMe";
import type { Appointment } from "@/lib/types";
import { EmptyState, PageHeader } from "@/components/common";
import { AppointmentDetailDialog, NewAppointmentDialog } from "@/components/AppointmentDialogs";
import { useDashboard, usePros, useSalon } from "@/lib/salonQueries";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const PX_PER_MIN = 1.3;
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

export default function Agenda() {
  const me = useMe();
  const ro = useReadOnly();
  const dash = useDashboard();
  const salon = useSalon();
  const pros = usePros();
  const today = dash.data?.today ?? "";
  const [view, setView] = useState<"dia" | "semana">("dia");
  const [cursor, setCursor] = useState<string>("");
  const day = cursor || today;
  const range = view === "dia" ? { start: day, end: day } : { start: day ? startOfWeek(day) : "", end: day ? addDays(startOfWeek(day), 6) : "" };
  const appts = useQuery({
    queryKey: ["salon", "appointments", range.start, range.end],
    queryFn: () => apiGet<Appointment[]>(`/salon/appointments?start=${range.start}&end=${range.end}`),
    enabled: !!range.start,
  });
  const [newOpen, setNewOpen] = useState(false);
  const [detail, setDetail] = useState<Appointment | null>(null);
  const list = useMemo(() => (appts.isError ? [] : appts.data ?? []), [appts.isError, appts.data]);
  const step = view === "dia" ? 1 : 7;
  const visiblePros = useMemo(
    () => (pros.data ?? []).filter((p) => p.active || list.some((a) => a.professional_id === p.id)),
    [pros.data, list],
  );
  const noTeam = !pros.isPending && (pros.data ?? []).length === 0;

  return (
    <>
      <PageHeader
        title="Agenda"
        subtitle={agendaSubtitle(view, day, range)}
        actions={!ro && <Button onClick={() => setNewOpen(true)} data-testid="btn-agenda-new-appointment"><CalendarPlus className="size-4" /> Novo agendamento</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={view} onValueChange={(v) => setView(v as "dia" | "semana")}>
          <TabsList>
            <TabsTrigger value="dia" data-testid="tab-agenda-day">Diária</TabsTrigger>
            <TabsTrigger value="semana" data-testid="tab-agenda-week">Semanal</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" onClick={() => setCursor(addDays(day, -step))} disabled={!day} aria-label="Anterior" data-testid="btn-agenda-prev"><ChevronLeft className="size-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(today)} data-testid="btn-agenda-today">Hoje</Button>
          <Button variant="outline" size="icon-sm" onClick={() => setCursor(addDays(day, step))} disabled={!day} aria-label="Próximo" data-testid="btn-agenda-next"><ChevronRight className="size-4" /></Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3 text-xs text-slate-600">
        {Object.entries(STATUS_META).map(([k, m]) => (
          <span key={k} className="flex items-center gap-1.5"><span className={cn("size-2 rounded-full", m.dot)} />{m.label}</span>
        ))}
      </div>

      {noTeam && <EmptyState icon={<Users className="size-5" />} title="Cadastre sua equipe" text="Adicione profissionais e serviços para começar a usar a agenda." />}
      {!noTeam && view === "dia" && (
        <DayGrid appts={list} pros={visiblePros} open={salon.data?.open_time ?? "08:00"} close={salon.data?.close_time ?? "20:00"} onPick={setDetail} />
      )}
      {!noTeam && view === "semana" && (
        <WeekGrid appts={list} start={range.start} today={today} onPick={setDetail} onDay={(d) => { setCursor(d); setView("dia"); }} />
      )}

      <NewAppointmentDialog open={newOpen} onOpenChange={setNewOpen} defaultDate={day >= today ? day : today} />
      <AppointmentDetailDialog appt={detail} salonName={me.data?.salon_name ?? ""} onClose={() => setDetail(null)} />
    </>
  );
}

function agendaSubtitle(view: "dia" | "semana", day: string, range: { start: string; end: string }): string {
  if (!day) return "";
  if (view === "dia") return longDate(day);
  return `Semana de ${shortDate(range.start)} a ${shortDate(range.end)}`;
}

function groupByPro(appts: Appointment[]): Map<string, Appointment[]> {
  const m = new Map<string, Appointment[]>();
  for (const a of appts) {
    const list = m.get(a.professional_id);
    if (list) list.push(a);
    else m.set(a.professional_id, [a]);
  }
  return m;
}

function DayGrid({ appts, pros, open, close, onPick }: { appts: Appointment[]; pros: { id: string; name: string }[]; open: string; close: string; onPick: (a: Appointment) => void }) {
  const startH = Math.floor(toMin(open) / 60);
  const endH = Math.ceil(toMin(close) / 60);
  const hours = Array.from({ length: endH - startH }, (_, i) => startH + i);
  const height = (endH - startH) * 60 * PX_PER_MIN;
  const byPro = useMemo(() => groupByPro(appts), [appts]);
  const columnStyle = useMemo(
    () => ({ height, backgroundImage: `repeating-linear-gradient(to bottom, #F1F5F9 0 1px, transparent 1px ${60 * PX_PER_MIN}px)` }),
    [height],
  );
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm" data-testid="agenda-calendar-grid">
      <div className="flex min-w-max">
        <div className="sticky left-0 z-10 w-14 shrink-0 border-r border-slate-100 bg-white">
          <div className="h-12 border-b border-slate-100" />
          <div className="relative" style={{ height }}>
            {hours.map((h) => (
              <span key={h} className="absolute right-2 -translate-y-1/2 font-mono text-[11px] text-slate-400" style={{ top: (h - startH) * 60 * PX_PER_MIN }}>{String(h).padStart(2, "0")}:00</span>
            ))}
          </div>
        </div>
        {pros.map((p) => (
          <div key={p.id} className="w-56 shrink-0 border-r border-slate-100 last:border-r-0 sm:w-60" data-testid={`agenda-column-${p.id}`}>
            <div className="flex h-12 items-center gap-2 border-b border-slate-100 px-3">
              <span className="grid size-7 place-items-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">{p.name.slice(0, 1)}</span>
              <span className="truncate text-sm font-semibold text-slate-800">{p.name}</span>
            </div>
            <div className="relative" style={columnStyle}>
              {(byPro.get(p.id) ?? []).map((a) => {
                const top = (toMin(a.start) - startH * 60) * PX_PER_MIN;
                const h = Math.max((toMin(a.end) - toMin(a.start)) * PX_PER_MIN - 3, 26);
                return (
                  <button key={a.id} onClick={() => onPick(a)} data-testid="appointment-card-item"
                    className={cn("absolute inset-x-1.5 overflow-hidden rounded-lg border px-2 py-1 text-left text-xs shadow-sm transition-[box-shadow,transform] hover:z-10 hover:-translate-y-px hover:shadow-md", STATUS_META[a.status].cls, a.status === "cancelado" && "opacity-60 line-through")}
                    style={{ top, height: h }}>
                    <p className="truncate font-semibold">{a.start} · {a.client_name}</p>
                    <p className="truncate opacity-80">{a.service_name}</p>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeekGrid({ appts, start, today, onPick, onDay }: { appts: Appointment[]; start: string; today: string; onPick: (a: Appointment) => void; onDay: (d: string) => void }) {
  const days = start ? Array.from({ length: 7 }, (_, i) => addDays(start, i)) : [];
  const byDate = useMemo(() => {
    const m = new Map<string, Appointment[]>();
    for (const x of appts) m.set(x.date, [...(m.get(x.date) ?? []), x]);
    return m;
  }, [appts]);
  return (
    <div className="grid gap-3 md:grid-cols-7" data-testid="agenda-week-grid">
      {days.map((d) => {
        const items = byDate.get(d) ?? [];
        const dt = parseDate(d);
        return (
          <div key={d} className={cn("flex min-h-40 flex-col rounded-2xl border bg-white shadow-sm", d === today ? "border-indigo-300 ring-2 ring-indigo-100" : "border-slate-200")} data-testid={`agenda-week-day-${d}`}>
            <button onClick={() => onDay(d)} className="flex items-baseline justify-between border-b border-slate-100 px-3 py-2 text-left">
              <span className="text-xs font-semibold uppercase text-slate-500">{WEEKDAYS[dt.getDay()]}</span>
              <span className={cn("font-heading text-lg font-bold", d === today ? "text-indigo-600" : "text-slate-900")}>{dt.getDate()}</span>
            </button>
            <div className="flex-1 space-y-1.5 p-2">
              {items.length === 0 && <p className="px-1 py-2 text-xs text-slate-400">Livre</p>}
              {items.map((a) => (
                <button key={a.id} onClick={() => onPick(a)} data-testid="appointment-card-item"
                  className={cn("block w-full rounded-lg border px-2 py-1 text-left text-[11px] transition-shadow hover:shadow", STATUS_META[a.status].cls, a.status === "cancelado" && "opacity-60")}>
                  <span className="font-mono font-semibold">{a.start}</span> {a.client_name.split(" ")[0]}
                  <span className="block truncate opacity-75">{a.service_name}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
