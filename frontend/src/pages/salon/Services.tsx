import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, Pencil, Plus, Scissors, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiDelete, apiPost, apiPut } from "@/lib/api";
import { brl, errMsg } from "@/lib/format";
import type { Service, ServiceIn } from "@/lib/types";
import { EmptyState, PageHeader } from "@/components/common";
import { useServices } from "@/components/AppointmentDialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CATEGORIES = ["Cabelo", "Barba", "Coloração", "Unhas", "Estética", "Sobrancelhas", "Outros"];

export default function Services() {
  const qc = useQueryClient();
  const services = useServices();
  const [editing, setEditing] = useState<Service | "new" | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/salon/services/${id}`),
    onSuccess: () => { toast.success("Serviço removido"); qc.invalidateQueries({ queryKey: ["salon"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const list = services.isError ? [] : services.data ?? [];
  const grouped = CATEGORIES.map((c) => ({ c, items: list.filter((s) => (CATEGORIES.includes(s.category) ? s.category : "Outros") === c) })).filter((g) => g.items.length);

  return (
    <>
      <PageHeader title="Serviços" subtitle="Nome, duração e preço exibidos na sua página de agendamento." actions={<Button onClick={() => setEditing("new")} data-testid="btn-new-service"><Plus className="size-4" /> Novo serviço</Button>} />
      {!services.isPending && list.length === 0 ? (
        <EmptyState icon={<Scissors className="size-5" />} title="Nenhum serviço cadastrado" text="Cadastre seus serviços para que clientes possam agendar." action={<Button onClick={() => setEditing("new")}>Cadastrar serviço</Button>} />
      ) : (
        <div className="space-y-6">
          {grouped.map((g) => (
            <section key={g.c}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{g.c}</h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {g.items.map((s) => (
                  <div key={s.id} data-testid={`service-card-${s.id}`} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-[box-shadow,border-color] hover:border-slate-300 hover:shadow-md">
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600"><Scissors className="size-5" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-900">{s.name} {!s.active && <span className="text-xs font-medium text-slate-400">(inativo)</span>}</p>
                      <p className="flex items-center gap-3 text-sm text-slate-500"><span className="flex items-center gap-1"><Clock className="size-3.5" />{s.duration} min</span><span className="font-medium text-slate-800">{brl(s.price)}</span></p>
                    </div>
                    <Button variant="ghost" size="icon-sm" onClick={() => setEditing(s)} aria-label="Editar" data-testid={`btn-edit-service-${s.id}`}><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => remove.mutate(s.id)} aria-label="Excluir" data-testid={`btn-delete-service-${s.id}`}><Trash2 className="size-4 text-rose-600" /></Button>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent data-testid="dialog-service">
          {editing !== null && <ServiceForm key={editing === "new" ? "new" : editing.id} svc={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ServiceForm({ svc, onDone }: { svc: Service | null; onDone: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState<ServiceIn>(svc ?? { name: "", category: "Cabelo", duration: 30, price: 0, active: true });
  const save = useMutation({
    mutationFn: () => (svc ? apiPut<Service>(`/salon/services/${svc.id}`, f) : apiPost<Service>("/salon/services", f)),
    onSuccess: () => { toast.success("Serviço salvo"); qc.invalidateQueries({ queryKey: ["salon"] }); onDone(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate(); };
  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader><DialogTitle>{svc ? "Editar serviço" : "Novo serviço"}</DialogTitle></DialogHeader>
      <div className="space-y-1.5"><Label>Nome do serviço</Label><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="input-service-name" placeholder="Corte Masculino" /></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="col-span-2 space-y-1.5 sm:col-span-1">
          <Label>Categoria</Label>
          <Select value={f.category} onValueChange={(v: string) => setF({ ...f, category: v })}>
            <SelectTrigger className="w-full" data-testid="select-service-category"><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>Duração (min)</Label><Input required type="number" min={5} step={5} value={f.duration} onChange={(e) => setF({ ...f, duration: Number(e.target.value) })} data-testid="input-service-duration" /></div>
        <div className="space-y-1.5"><Label>Preço (R$)</Label><Input required type="number" min={0} step="0.01" value={f.price} onChange={(e) => setF({ ...f, price: Number(e.target.value) })} data-testid="input-service-price" /></div>
      </div>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.active} onCheckedChange={(c) => setF({ ...f, active: !!c })} data-testid="checkbox-service-active" /> Disponível para agendamento online</label>
      <DialogFooter><Button type="submit" disabled={save.isPending} data-testid="btn-save-service">Salvar serviço</Button></DialogFooter>
    </form>
  );
}
