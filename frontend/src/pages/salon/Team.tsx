import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Pencil, Percent, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { apiDelete, apiPost, apiPut } from "@/lib/api";
import { errMsg, formatPhone, maskPhone, waLink } from "@/lib/format";
import { useReadOnly } from "@/lib/useMe";
import type { Professional, ProfessionalIn } from "@/lib/types";
import { EmptyState, PageHeader } from "@/components/common";
import { usePros } from "@/components/AppointmentDialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function Team() {
  const qc = useQueryClient();
  const pros = usePros();
  const ro = useReadOnly();
  const [editing, setEditing] = useState<Professional | "new" | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/salon/professionals/${id}`),
    onSuccess: () => { toast.success("Profissional removido"); qc.invalidateQueries({ queryKey: ["salon"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const list = pros.isError ? [] : pros.data ?? [];
  return (
    <>
      <PageHeader title="Equipe" subtitle="Profissionais, especialidades e comissão padrão." actions={!ro && <Button onClick={() => setEditing("new")} data-testid="btn-new-professional"><Plus className="size-4" /> Novo profissional</Button>} />
      {!pros.isPending && list.length === 0 ? (
        <EmptyState icon={<Users className="size-5" />} title="Nenhum profissional" text="Cadastre sua equipe para distribuir os agendamentos." action={<Button onClick={() => setEditing("new")}>Cadastrar profissional</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => (
            <div key={p.id} data-testid={`professional-card-${p.id}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-[box-shadow,border-color] hover:border-slate-300 hover:shadow-md">
              <div className="flex items-start gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-rose-500 font-heading text-lg font-bold text-white">{p.name.slice(0, 1)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">{p.name}</p>
                  <p className="truncate text-sm text-slate-500">{p.specialty || "—"}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{p.active ? "Ativo" : "Inativo"}</span>
              </div>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="flex items-center gap-1 text-slate-600"><Percent className="size-3.5" /> Comissão <b className="text-slate-900">{p.commission_pct}%</b></span>
                {p.phone && (ro ? (
                  <span className="text-slate-500">{formatPhone(p.phone)}</span>
                ) : (
                  <a href={waLink(p.phone, `Olá, ${p.name.split(" ")[0]}!`)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-emerald-700" data-testid={`btn-whatsapp-pro-${p.id}`}><MessageCircle className="size-3.5" />{formatPhone(p.phone)}</a>
                ))}
              </div>
              {!ro && (
                <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
                  <Button variant="outline" size="sm" onClick={() => setEditing(p)} data-testid={`btn-edit-professional-${p.id}`}><Pencil className="size-3.5" /> Editar</Button>
                  <Button variant="ghost" size="sm" className="text-rose-600" onClick={() => remove.mutate(p.id)} data-testid={`btn-delete-professional-${p.id}`}><Trash2 className="size-3.5" /> Remover</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent data-testid="dialog-professional">
          {editing !== null && <ProForm key={editing === "new" ? "new" : editing.id} pro={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProForm({ pro, onDone }: { pro: Professional | null; onDone: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState<ProfessionalIn>(pro ? { ...pro, phone: maskPhone(pro.phone) } : { name: "", specialty: "", phone: "", commission_pct: 40, active: true });
  const save = useMutation({
    mutationFn: () => {
      const body = { ...f, phone: f.phone.replace(/\D/g, "") };
      return pro ? apiPut<Professional>(`/salon/professionals/${pro.id}`, body) : apiPost<Professional>("/salon/professionals", body);
    },
    onSuccess: () => { toast.success("Profissional salvo"); qc.invalidateQueries({ queryKey: ["salon"] }); onDone(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate(); };
  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader><DialogTitle>{pro ? "Editar profissional" : "Novo profissional"}</DialogTitle></DialogHeader>
      <div className="space-y-1.5"><Label>Nome</Label><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="input-professional-name" /></div>
      <div className="space-y-1.5"><Label>Especialidade</Label><Input value={f.specialty} onChange={(e) => setF({ ...f, specialty: e.target.value })} placeholder="Barbeiro, Colorista…" data-testid="input-professional-specialty" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>WhatsApp</Label><Input inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: maskPhone(e.target.value) })} placeholder="(11) 98765-4321" data-testid="input-professional-phone" /></div>
        <div className="space-y-1.5"><Label>Comissão (%)</Label><Input required type="number" min={0} max={100} value={f.commission_pct} onChange={(e) => setF({ ...f, commission_pct: Number(e.target.value) })} data-testid="input-professional-commission" /></div>
      </div>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.active} onCheckedChange={(c) => setF({ ...f, active: !!c })} data-testid="checkbox-professional-active" /> Ativo (recebe agendamentos)</label>
      <DialogFooter><Button type="submit" disabled={save.isPending} data-testid="btn-save-professional">Salvar</Button></DialogFooter>
    </form>
  );
}
