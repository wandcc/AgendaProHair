import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, Clock, Loader2, MessageCircle, Trash2, UserX } from "lucide-react";
import { toast } from "sonner";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { brl, errMsg, formatPhone, longDate, maskPhone, shortDate, STATUS_META, waLink } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useReadOnly } from "@/lib/useMe";
import type { Appointment, AppointmentIn, ApptStatus, Availability, DashboardOut, Professional, Salon, Service } from "@/lib/types";
import { StatusBadge } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const useSalon = () => useQuery({ queryKey: ["salon", "me"], queryFn: () => apiGet<Salon>("/salon/me") });
export const useServices = () => useQuery({ queryKey: ["salon", "services"], queryFn: () => apiGet<Service[]>("/salon/services") });
export const usePros = () => useQuery({ queryKey: ["salon", "professionals"], queryFn: () => apiGet<Professional[]>("/salon/professionals") });
export const useDashboard = () => useQuery({ queryKey: ["salon", "dashboard"], queryFn: () => apiGet<DashboardOut>("/salon/dashboard") });

export function NewAppointmentDialog({ open, onOpenChange, defaultDate }: { open: boolean; onOpenChange: (o: boolean) => void; defaultDate: string }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg" data-testid="dialog-new-appointment">
        {open && <NewAppointmentForm defaultDate={defaultDate} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function NewAppointmentForm({ defaultDate, onDone }: { defaultDate: string; onDone: () => void }) {
  const qc = useQueryClient();
  const services = useServices();
  const pros = usePros();
  const activeServices = (services.data ?? []).filter((s) => s.active);
  const activePros = (pros.data ?? []).filter((p) => p.active);
  const [f, setF] = useState({ service_id: "", professional_id: "any", date: defaultDate, start: "", client_name: "", client_phone: "", notes: "" });
  const serviceId = f.service_id || activeServices[0]?.id || "";
  const avail = useQuery({
    queryKey: ["salon", "availability", f.date, serviceId, f.professional_id],
    queryFn: () => apiGet<Availability>(`/salon/availability?date=${f.date}&service_id=${serviceId}${f.professional_id !== "any" ? `&professional_id=${f.professional_id}` : ""}`),
    enabled: !!serviceId && !!f.date,
  });
  const create = useMutation({
    mutationFn: () => {
      const body: AppointmentIn = { service_id: serviceId, professional_id: f.professional_id === "any" ? null : f.professional_id, date: f.date, start: f.start, client_name: f.client_name, client_phone: f.client_phone.replace(/\D/g, ""), notes: f.notes };
      return apiPost<Appointment>("/salon/appointments", body);
    },
    onSuccess: (a) => {
      toast.success(`Agendamento criado: ${a.client_name} às ${a.start}`);
      qc.invalidateQueries({ queryKey: ["salon"] });
      onDone();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!f.start) return toast.error("Escolha um horário disponível");
    create.mutate();
  };
  const slots = avail.isError ? [] : avail.data?.slots ?? [];

  if (!services.isPending && activeServices.length === 0) {
    return <p className="p-2 text-sm text-slate-600" data-testid="new-appt-no-services">Cadastre ao menos um serviço e um profissional antes de agendar.</p>;
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>Novo agendamento</DialogTitle>
        <DialogDescription>Os horários livres consideram o funcionamento do salão e a agenda da equipe.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Serviço</Label>
          <Select value={serviceId} onValueChange={(v: string) => setF({ ...f, service_id: v, start: "" })}>
            <SelectTrigger className="w-full" data-testid="select-new-appt-service"><SelectValue>{(v) => { const s = activeServices.find((x) => x.id === v); return s ? `${s.name} · ${s.duration} min · ${brl(s.price)}` : "Selecione"; }}</SelectValue></SelectTrigger>
            <SelectContent>{activeServices.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} · {s.duration} min · {brl(s.price)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Profissional</Label>
          <Select value={f.professional_id} onValueChange={(v: string) => setF({ ...f, professional_id: v, start: "" })}>
            <SelectTrigger className="w-full" data-testid="select-new-appt-professional"><SelectValue>{(v) => (v === "any" ? "Qualquer disponível" : activePros.find((p) => p.id === v)?.name ?? "")}</SelectValue></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Qualquer disponível</SelectItem>
              {activePros.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Data</Label>
          <Input type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value, start: "" })} data-testid="input-new-appt-date" />
        </div>
      </div>
      <div>
        <Label className="mb-2 block">Horário</Label>
        {avail.isFetching ? (
          <p className="text-sm text-slate-500">Buscando horários…</p>
        ) : avail.data && !avail.data.open ? (
          <p className="text-sm text-rose-600">Salão fechado nesta data.</p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum horário livre nesta data.</p>
        ) : (
          <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto" data-testid="new-appt-slots">
            {slots.map((s) => (
              <button type="button" key={s} onClick={() => setF({ ...f, start: s })} data-testid={`new-appt-slot-${s.replace(":", "")}`}
                className={cn("rounded-lg border px-3 py-1.5 font-mono text-sm transition-[background-color,border-color,color]", f.start === s ? "border-indigo-500 bg-indigo-600 text-white" : "border-slate-200 hover:border-indigo-300")}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label>Nome do cliente</Label><Input required value={f.client_name} onChange={(e) => setF({ ...f, client_name: e.target.value })} data-testid="input-new-appt-client-name" /></div>
        <div className="space-y-1.5"><Label>WhatsApp</Label><Input required inputMode="tel" value={f.client_phone} onChange={(e) => setF({ ...f, client_phone: maskPhone(e.target.value) })} placeholder="(11) 98765-4321" data-testid="input-new-appt-client-phone" /></div>
      </div>
      <div className="space-y-1.5"><Label>Observações</Label><Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} data-testid="input-new-appt-notes" /></div>
      <DialogFooter>
        <Button type="submit" disabled={create.isPending} data-testid="btn-submit-new-appointment">{create.isPending && <Loader2 className="size-4 animate-spin" />} Confirmar agendamento</Button>
      </DialogFooter>
    </form>
  );
}

const STATUS_ACTIONS: { status: ApptStatus; label: string; icon: typeof CheckCircle2; cls: string; testId: string }[] = [
  { status: "confirmado", label: "Confirmado", icon: Clock, cls: "hover:border-indigo-300 data-[on=true]:border-indigo-500 data-[on=true]:bg-indigo-50 data-[on=true]:text-indigo-700", testId: "btn-status-confirmado" },
  { status: "finalizado", label: "Finalizado", icon: CheckCircle2, cls: "hover:border-emerald-300 data-[on=true]:border-emerald-500 data-[on=true]:bg-emerald-50 data-[on=true]:text-emerald-700", testId: "btn-status-concluido" },
  { status: "cancelado", label: "Cancelado", icon: Ban, cls: "hover:border-rose-300 data-[on=true]:border-rose-500 data-[on=true]:bg-rose-50 data-[on=true]:text-rose-700", testId: "btn-status-cancelado" },
  { status: "ausente", label: "Ausente", icon: UserX, cls: "hover:border-slate-400 data-[on=true]:border-slate-500 data-[on=true]:bg-slate-100 data-[on=true]:text-slate-800", testId: "btn-status-ausente" },
];

export function AppointmentDetailDialog({ appt, salonName, onClose }: { appt: Appointment | null; salonName: string; onClose: () => void }) {
  const qc = useQueryClient();
  const ro = useReadOnly();
  const [current, setCurrent] = useState<Appointment | null>(null);
  const a = current && appt && current.id === appt.id ? current : appt;
  const patch = useMutation({
    mutationFn: (status: ApptStatus) => apiPatch<Appointment>(`/salon/appointments/${appt!.id}`, { status }),
    onSuccess: (u) => { setCurrent(u); toast.success(`Status alterado para ${STATUS_META[u.status].label}`); qc.invalidateQueries({ queryKey: ["salon"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const remove = useMutation({
    mutationFn: () => apiDelete(`/salon/appointments/${appt!.id}`),
    onSuccess: () => { toast.success("Agendamento excluído"); qc.invalidateQueries({ queryKey: ["salon"] }); onClose(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  if (!a) return <Dialog open={false} />;
  const first = a.client_name.split(" ")[0];
  const confirmMsg = `Olá, ${first}! Seu horário no ${salonName} está confirmado ✅\n\n💇 ${a.service_name}\n👤 ${a.professional_name}\n📅 ${shortDate(a.date)} às ${a.start}\n💰 ${brl(a.price)}\n\nSe precisar remarcar, é só responder esta mensagem.`;
  const reminderMsg = `Olá, ${first}! Passando para lembrar do seu horário no ${salonName}: ${a.service_name} em ${shortDate(a.date)} às ${a.start}. Podemos confirmar sua presença?`;

  return (
    <Dialog open={!!appt} onOpenChange={(o) => { if (!o) { setCurrent(null); onClose(); } }}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-appointment-detail">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">{a.client_name}</DialogTitle>
          <DialogDescription>{longDate(a.date)} · {a.start}–{a.end}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Serviço</span><span className="font-medium">{a.service_name}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Profissional</span><span className="font-medium">{a.professional_name}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Valor</span><span className="font-medium">{brl(a.price)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">WhatsApp</span><span className="font-medium">{formatPhone(a.client_phone)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Origem</span><span className="font-medium">{a.source === "online" ? "Link online" : "Balcão"}</span></div>
          <div className="flex items-center justify-between"><span className="text-slate-500">Status</span><StatusBadge status={a.status} /></div>
          {a.notes && <p className="border-t border-slate-200 pt-2 text-slate-600">“{a.notes}”</p>}
        </div>
        {ro ? (
          <p className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-800" data-testid="appointment-readonly-note">
            Modo demonstração: somente visualização. Na sua conta você altera o status (Confirmado, Finalizado, Cancelado, Ausente) e envia confirmação/lembrete pelo WhatsApp.
          </p>
        ) : (
        <>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Alterar status</p>
          <div className="grid grid-cols-2 gap-2">
            {STATUS_ACTIONS.map((s) => (
              <button key={s.status} data-on={a.status === s.status} disabled={patch.isPending} onClick={() => patch.mutate(s.status)} data-testid={s.testId}
                className={cn("flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 transition-[background-color,border-color,color]", s.cls)}>
                <s.icon className="size-4" /> {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <a href={waLink(a.client_phone, confirmMsg)} target="_blank" rel="noopener noreferrer" data-testid="btn-whatsapp-confirm-client"
            className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-3 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90">
            <MessageCircle className="size-4" /> Confirmar
          </a>
          <a href={waLink(a.client_phone, reminderMsg)} target="_blank" rel="noopener noreferrer" data-testid="btn-whatsapp-reminder-client"
            className="flex items-center justify-center gap-2 rounded-xl border border-emerald-300 px-3 py-2.5 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50">
            <MessageCircle className="size-4" /> Lembrete
          </a>
        </div>
        <DialogFooter>
          <Button variant="ghost" className="text-rose-600" onClick={() => remove.mutate()} disabled={remove.isPending} data-testid="btn-delete-appointment"><Trash2 className="size-4" /> Excluir</Button>
        </DialogFooter>
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}
