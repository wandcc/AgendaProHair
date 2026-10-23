import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiPut } from "@/lib/api";
import { errMsg, maskPhone, WEEKDAYS } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMe } from "@/lib/useMe";
import type { Salon, SalonSettingsIn } from "@/lib/types";
import { PageHeader, Panel } from "@/components/common";
import { useSalon } from "@/components/AppointmentDialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SalonSettings() {
  const salon = useSalon();
  return (
    <>
      <PageHeader title="Configurações do salão" subtitle="Dados exibidos na página pública e horário de funcionamento usado na agenda." />
      {salon.data ? <SettingsForm key={salon.data.id} salon={salon.data} /> : <p className="text-sm text-slate-500">{salon.isError ? "Não foi possível carregar." : "Carregando…"}</p>}
    </>
  );
}

function SettingsForm({ salon }: { salon: Salon }) {
  const qc = useQueryClient();
  const me = useMe();
  const isOwner = me.data?.salon_role === "owner" && !me.data?.is_demo;
  const [f, setF] = useState<SalonSettingsIn>({ name: salon.name, phone: maskPhone(salon.phone), address: salon.address, open_time: salon.open_time, close_time: salon.close_time, work_days: salon.work_days, slot_interval: salon.slot_interval });
  const save = useMutation({
    mutationFn: () => apiPut<Salon>("/salon/me", { ...f, phone: f.phone.replace(/\D/g, "") }),
    onSuccess: () => { toast.success("Configurações salvas"); qc.invalidateQueries({ queryKey: ["salon"] }); qc.invalidateQueries({ queryKey: ["me"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const toggleDay = (d: number) => setF({ ...f, work_days: f.work_days.includes(d) ? f.work_days.filter((x) => x !== d) : [...f.work_days, d].sort() });
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate(); };

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-2">
      <Panel title="Dados do salão">
        <div className="space-y-4">
          <div className="space-y-1.5"><Label>Nome</Label><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} disabled={!isOwner} data-testid="input-settings-name" /></div>
          <div className="space-y-1.5"><Label>WhatsApp do salão</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: maskPhone(e.target.value) })} disabled={!isOwner} placeholder="(11) 98765-4321" data-testid="input-settings-phone" /><p className="text-xs text-slate-500">Recebe a mensagem de confirmação dos clientes que agendam pelo link.</p></div>
          <div className="space-y-1.5"><Label>Endereço</Label><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} disabled={!isOwner} data-testid="input-settings-address" /></div>
        </div>
      </Panel>
      <Panel title="Funcionamento">
        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">Dias de atendimento</Label>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((w, i) => (
                <button type="button" key={w} disabled={!isOwner} onClick={() => toggleDay(i)} data-testid={`btn-workday-${i}`}
                  className={cn("w-12 rounded-xl border py-2 text-sm font-medium transition-[background-color,border-color,color]", f.work_days.includes(i) ? "border-indigo-500 bg-indigo-600 text-white" : "border-slate-200 text-slate-600")}>
                  {w}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label>Abre</Label><Input type="time" required value={f.open_time} onChange={(e) => setF({ ...f, open_time: e.target.value })} disabled={!isOwner} data-testid="input-settings-open" /></div>
            <div className="space-y-1.5"><Label>Fecha</Label><Input type="time" required value={f.close_time} onChange={(e) => setF({ ...f, close_time: e.target.value })} disabled={!isOwner} data-testid="input-settings-close" /></div>
            <div className="space-y-1.5"><Label>Intervalo (min)</Label><Input type="number" min={10} max={120} step={5} required value={f.slot_interval} onChange={(e) => setF({ ...f, slot_interval: Number(e.target.value) })} disabled={!isOwner} data-testid="input-settings-interval" /></div>
          </div>
        </div>
      </Panel>
      <div className="lg:col-span-2">
        {isOwner ? (
          <Button type="submit" disabled={save.isPending} data-testid="btn-save-settings">{save.isPending && <Loader2 className="size-4 animate-spin" />} Salvar configurações</Button>
        ) : (
          <p className="text-sm text-slate-500" data-testid="settings-readonly-note">{me.data?.is_demo ? "Modo demonstração: somente visualização." : "Somente o proprietário pode alterar as configurações."}</p>
        )}
      </div>
    </form>
  );
}
