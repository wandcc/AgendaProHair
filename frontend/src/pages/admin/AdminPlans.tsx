import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { brl, errMsg } from "@/lib/format";
import type { Plan, PlanIn } from "@/lib/types";
import { EmptyState, PageHeader } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function AdminPlans() {
  const qc = useQueryClient();
  const plans = useQuery({ queryKey: ["admin", "plans"], queryFn: () => apiGet<Plan[]>("/admin/plans") });
  const [editing, setEditing] = useState<Plan | "new" | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/plans/${id}`),
    onSuccess: () => { toast.success("Plano excluído"); qc.invalidateQueries({ queryKey: ["admin"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const list = plans.isError ? [] : plans.data ?? [];

  return (
    <>
      <PageHeader title="Planos de Licença" subtitle="Defina preços e limites das assinaturas." actions={<Button onClick={() => setEditing("new")} data-testid="btn-new-plan"><Plus className="size-4" /> Novo plano</Button>} />
      {list.length === 0 && !plans.isPending ? (
        <EmptyState icon={<Layers className="size-5" />} title="Nenhum plano" text="Crie um plano para poder cadastrar salões." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p, i) => (
            <div key={p.id} data-testid={`plan-card-${p.id}`} className={`relative flex flex-col rounded-3xl border p-6 shadow-sm animate-fade-up ${i === 1 ? "border-indigo-300 bg-gradient-to-b from-indigo-50 to-white" : "border-slate-200 bg-white"}`} style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-heading text-lg font-bold text-slate-900">{p.name}</p>
                  {!p.active && <span className="text-xs font-medium text-rose-600">Inativo</span>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => setEditing(p)} aria-label="Editar" data-testid={`btn-edit-plan-${p.id}`}><Pencil className="size-4" /></Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => remove.mutate(p.id)} aria-label="Excluir" data-testid={`btn-delete-plan-${p.id}`}><Trash2 className="size-4 text-rose-600" /></Button>
                </div>
              </div>
              <p className="mt-4 font-heading text-4xl font-extrabold tracking-tight text-slate-900">{brl(p.price)}<span className="text-sm font-medium text-slate-500">/mês</span></p>
              <p className="mt-1 text-sm text-slate-500">Até {p.max_professionals} profissionais</p>
              <ul className="mt-5 space-y-2">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-700"><Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />{f}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      <PlanDialog plan={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function PlanDialog({ plan, onClose }: { plan: Plan | "new" | null; onClose: () => void }) {
  const qc = useQueryClient();
  const open = plan !== null;
  const initial: PlanIn = plan && plan !== "new" ? plan : { name: "", price: 0, max_professionals: 3, features: [], active: true };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="dialog-plan">
        {open && <PlanForm key={plan === "new" ? "new" : plan.id} initial={initial} id={plan === "new" ? null : plan.id} onDone={() => { qc.invalidateQueries({ queryKey: ["admin"] }); onClose(); }} />}
      </DialogContent>
    </Dialog>
  );
}

function PlanForm({ initial, id, onDone }: { initial: PlanIn; id: string | null; onDone: () => void }) {
  const [f, setF] = useState({ ...initial, featuresText: initial.features.join("\n") });
  const save = useMutation({
    mutationFn: () => {
      const body: PlanIn = { name: f.name, price: Number(f.price), max_professionals: Number(f.max_professionals), active: f.active, features: f.featuresText.split("\n").map((s) => s.trim()).filter(Boolean) };
      return id ? apiPut<Plan>(`/admin/plans/${id}`, body) : apiPost<Plan>("/admin/plans", body);
    },
    onSuccess: () => { toast.success("Plano salvo"); onDone(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate(); };
  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader><DialogTitle>{id ? "Editar plano" : "Novo plano"}</DialogTitle></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5 sm:col-span-3"><Label>Nome</Label><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="input-plan-name" /></div>
        <div className="space-y-1.5 sm:col-span-2"><Label>Preço mensal (R$)</Label><Input required type="number" min={0} step="0.01" value={f.price} onChange={(e) => setF({ ...f, price: Number(e.target.value) })} data-testid="input-plan-price" /></div>
        <div className="space-y-1.5"><Label>Máx. profissionais</Label><Input required type="number" min={1} value={f.max_professionals} onChange={(e) => setF({ ...f, max_professionals: Number(e.target.value) })} data-testid="input-plan-max-pros" /></div>
      </div>
      <div className="space-y-1.5"><Label>Recursos (um por linha)</Label><Textarea rows={4} value={f.featuresText} onChange={(e) => setF({ ...f, featuresText: e.target.value })} data-testid="input-plan-features" /></div>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.active} onCheckedChange={(c) => setF({ ...f, active: !!c })} data-testid="checkbox-plan-active" /> Plano ativo</label>
      <DialogFooter><Button type="submit" disabled={save.isPending} data-testid="btn-save-plan-form">Salvar</Button></DialogFooter>
    </form>
  );
}
