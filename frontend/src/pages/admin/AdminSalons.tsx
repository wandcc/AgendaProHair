import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, MoreHorizontal, Plus, Store, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { brl, errMsg } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Plan, SalonAdminRow, SalonCreateIn, SalonStatus, SalonUserIn, SalonUserOut } from "@/lib/types";
import { EmptyState, PageHeader } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const STATUS: Record<SalonStatus, { label: string; cls: string }> = {
  ativo: { label: "Ativo", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  inadimplente: { label: "Inadimplente", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  suspenso: { label: "Suspenso", cls: "bg-rose-50 text-rose-700 border-rose-200" },
};

export function SalonStatusBadge({ status }: { status: SalonStatus }) {
  return <span data-testid={`salon-status-${status}`} className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-medium", STATUS[status].cls)}>{STATUS[status].label}</span>;
}

const slugify = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function AdminSalons() {
  const qc = useQueryClient();
  const salons = useQuery({ queryKey: ["admin", "salons"], queryFn: () => apiGet<SalonAdminRow[]>("/admin/salons") });
  const plans = useQuery({ queryKey: ["admin", "plans"], queryFn: () => apiGet<Plan[]>("/admin/plans") });
  const [createOpen, setCreateOpen] = useState(false);
  const [usersFor, setUsersFor] = useState<SalonAdminRow | null>(null);
  const [planFor, setPlanFor] = useState<SalonAdminRow | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin"] });
  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { status?: SalonStatus; plan_id?: string } }) => apiPatch(`/admin/salons/${id}`, body),
    onSuccess: () => { invalidate(); toast.success("Assinatura atualizada"); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const rows = salons.isError ? [] : salons.data ?? [];
  const planList = plans.isError ? [] : plans.data ?? [];

  return (
    <>
      <PageHeader
        title="Assinantes"
        subtitle="Salões e profissionais que assinam a plataforma."
        actions={<Button onClick={() => setCreateOpen(true)} data-testid="btn-create-salon"><Plus className="size-4" /> Novo salão / acesso</Button>}
      />

      {salons.isPending ? (
        <p className="text-sm text-slate-500">Carregando…</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={<Store className="size-5" />} title="Nenhum assinante" text="Crie o primeiro salão para liberar o acesso ao painel." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <Table data-testid="table-salons-superadmin">
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                <TableHead>Salão</TableHead>
                <TableHead className="hidden md:table-cell">Responsável</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead className="hidden sm:table-cell">Equipe</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id} data-testid={`salon-row-${s.slug}`}>
                  <TableCell>
                    <p className="font-medium text-slate-900">{s.name} {s.is_demo && <span className="ml-1 rounded bg-slate-100 px-1.5 text-[10px] font-semibold uppercase text-slate-500">demo</span>}</p>
                    <p className="font-mono text-xs text-slate-500">/agendar/{s.slug}</p>
                  </TableCell>
                  <TableCell className="hidden text-sm text-slate-600 md:table-cell">{s.owner_email || "—"}</TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">{s.plan_name}</p>
                    <p className="text-xs text-slate-500">{brl(s.plan_price)}/mês</p>
                  </TableCell>
                  <TableCell className="hidden text-sm sm:table-cell">{s.professionals_count} prof. · {s.users_count} acessos</TableCell>
                  <TableCell><SalonStatusBadge status={s.status} /></TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" data-testid={`btn-salon-actions-${s.slug}`} aria-label="Ações" />}>
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        {s.status !== "ativo" && (
                          <DropdownMenuItem data-testid={`btn-activate-${s.slug}`} onClick={() => patch.mutate({ id: s.id, body: { status: "ativo" } })}>Ativar assinatura</DropdownMenuItem>
                        )}
                        {s.status !== "inadimplente" && (
                          <DropdownMenuItem data-testid={`btn-delinquent-${s.slug}`} onClick={() => patch.mutate({ id: s.id, body: { status: "inadimplente" } })}>Marcar inadimplente</DropdownMenuItem>
                        )}
                        {s.status !== "suspenso" && (
                          <DropdownMenuItem variant="destructive" data-testid={`btn-suspend-${s.slug}`} onClick={() => patch.mutate({ id: s.id, body: { status: "suspenso" } })}>Suspender</DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem data-testid={`btn-change-plan-${s.slug}`} onClick={() => setPlanFor(s)}>Trocar plano</DropdownMenuItem>
                        <DropdownMenuItem data-testid={`btn-manage-users-${s.slug}`} onClick={() => setUsersFor(s)}>Acessos do salão</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateSalonDialog open={createOpen} onOpenChange={setCreateOpen} plans={planList} onDone={invalidate} />
      <ChangePlanDialog salon={planFor} onClose={() => setPlanFor(null)} plans={planList} onSave={(plan_id) => planFor && patch.mutate({ id: planFor.id, body: { plan_id } }, { onSuccess: () => setPlanFor(null) })} />
      <SalonUsersDialog salon={usersFor} onClose={() => setUsersFor(null)} onChanged={invalidate} />
    </>
  );
}

function CreateSalonDialog({ open, onOpenChange, plans, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; plans: Plan[]; onDone: () => void }) {
  const empty: SalonCreateIn = { name: "", slug: "", phone: "", plan_id: "", owner_name: "", owner_email: "", owner_password: "" };
  const [f, setF] = useState<SalonCreateIn>(empty);
  const [slugTouched, setSlugTouched] = useState(false);
  const planId = f.plan_id || plans[0]?.id || "";
  const create = useMutation({
    mutationFn: () => apiPost("/admin/salons", { ...f, plan_id: planId, phone: f.phone.replace(/\D/g, "") }),
    onSuccess: () => {
      toast.success("Salão criado e acesso liberado!");
      onDone();
      setF(empty);
      setSlugTouched(false);
      onOpenChange(false);
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const set = (k: keyof SalonCreateIn, v: string) => setF((p) => ({ ...p, [k]: v }));
  const submit = (e: FormEvent) => { e.preventDefault(); create.mutate(); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" data-testid="dialog-create-salon">
        <DialogHeader>
          <DialogTitle>Novo salão / profissional</DialogTitle>
          <DialogDescription>Cria o assinante e o acesso do proprietário ao Painel do Salão.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nome do salão</Label>
              <Input required value={f.name} data-testid="input-salon-name" onChange={(e) => { set("name", e.target.value); if (!slugTouched) set("slug", slugify(e.target.value)); }} placeholder="Studio Belleza" />
            </div>
            <div className="space-y-1.5">
              <Label>Link de agendamento</Label>
              <div className="flex items-center rounded-lg border border-input pl-2 text-sm text-slate-500">
                /agendar/
                <input required className="h-8 min-w-0 flex-1 bg-transparent px-1 text-slate-900 outline-none" value={f.slug} data-testid="input-salon-slug" onChange={(e) => { setSlugTouched(true); set("slug", slugify(e.target.value)); }} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>WhatsApp do salão</Label>
              <Input value={f.phone} data-testid="input-salon-phone" onChange={(e) => set("phone", e.target.value)} placeholder="(11) 99999-0000" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Plano</Label>
              <Select value={planId} onValueChange={(v: string) => set("plan_id", v)}>
                <SelectTrigger className="w-full" data-testid="select-plan-superadmin">
                  <SelectValue>{(v) => { const p = plans.find((x) => x.id === v); return p ? `${p.name} — ${brl(p.price)}/mês` : "Selecione"; }}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} — {brl(p.price)}/mês</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800"><KeyRound className="size-4" /> Acesso do proprietário</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2"><Label>Nome</Label><Input required value={f.owner_name} data-testid="input-owner-name" onChange={(e) => set("owner_name", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>E-mail de login</Label><Input required type="email" value={f.owner_email} data-testid="input-owner-email" onChange={(e) => set("owner_email", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Senha inicial</Label><Input required minLength={6} value={f.owner_password} data-testid="input-owner-password" onChange={(e) => set("owner_password", e.target.value)} placeholder="mín. 6 caracteres" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending || !planId} data-testid="btn-submit-create-salon">
              {create.isPending && <Loader2 className="size-4 animate-spin" />} Criar salão e acesso
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ChangePlanDialog({ salon, onClose, plans, onSave }: { salon: SalonAdminRow | null; onClose: () => void; plans: Plan[]; onSave: (id: string) => void }) {
  const [sel, setSel] = useState<string>("");
  const value = sel || salon?.plan_id || "";
  return (
    <Dialog open={!!salon} onOpenChange={(o) => { if (!o) { onClose(); setSel(""); } }}>
      <DialogContent data-testid="dialog-change-plan">
        <DialogHeader>
          <DialogTitle>Trocar plano</DialogTitle>
          <DialogDescription>{salon?.name}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {plans.map((p) => (
            <button key={p.id} type="button" onClick={() => setSel(p.id)} data-testid={`plan-option-${p.id}`}
              className={cn("flex items-center justify-between rounded-xl border p-4 text-left transition-[border-color,background-color]", value === p.id ? "border-indigo-400 bg-indigo-50" : "border-slate-200 hover:border-slate-300")}>
              <div>
                <p className="font-semibold text-slate-900">{p.name}</p>
                <p className="text-xs text-slate-500">Até {p.max_professionals} profissionais</p>
              </div>
              <p className="font-heading font-bold text-slate-900">{brl(p.price)}<span className="text-xs font-normal text-slate-500">/mês</span></p>
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={() => { onSave(value); setSel(""); }} disabled={!value} data-testid="btn-save-plan">Salvar plano</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SalonUsersDialog({ salon, onClose, onChanged }: { salon: SalonAdminRow | null; onClose: () => void; onChanged: () => void }) {
  const qc = useQueryClient();
  const key = ["admin", "salon-users", salon?.id];
  const users = useQuery({ queryKey: key, queryFn: () => apiGet<SalonUserOut[]>(`/admin/salons/${salon!.id}/users`), enabled: !!salon });
  const empty: SalonUserIn = { name: "", email: "", password: "", salon_role: "staff" };
  const [f, setF] = useState<SalonUserIn>(empty);
  const create = useMutation({
    mutationFn: () => apiPost<SalonUserOut>(`/admin/salons/${salon!.id}/users`, f),
    onSuccess: () => { toast.success("Acesso criado"); setF(empty); qc.invalidateQueries({ queryKey: key }); onChanged(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const remove = useMutation({
    mutationFn: (uid: string) => apiDelete(`/admin/salons/${salon!.id}/users/${uid}`),
    onSuccess: () => { toast.success("Acesso removido"); qc.invalidateQueries({ queryKey: key }); onChanged(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <Dialog open={!!salon} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" data-testid="dialog-salon-users">
        <DialogHeader>
          <DialogTitle>Acessos — {salon?.name}</DialogTitle>
          <DialogDescription>Usuários que podem entrar no Painel do Salão.</DialogDescription>
        </DialogHeader>
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {(users.data ?? []).map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-3 px-4 py-3" data-testid={`salon-user-${u.email}`}>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{u.name}</p>
                <p className="truncate text-xs text-slate-500">{u.email} · {u.salon_role === "owner" ? "Proprietário" : "Profissional"}</p>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => remove.mutate(u.id)} aria-label="Remover" data-testid={`btn-remove-user-${u.email}`}><Trash2 className="size-4 text-rose-600" /></Button>
            </li>
          ))}
          {users.data?.length === 0 && <li className="px-4 py-3 text-sm text-slate-500">Nenhum acesso.</li>}
        </ul>
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-3 rounded-xl bg-slate-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold"><UserPlus className="size-4" /> Criar novo acesso</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input required placeholder="Nome" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="input-new-user-name" />
            <Input required type="email" placeholder="E-mail" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} data-testid="input-new-user-email" />
            <Input required minLength={6} placeholder="Senha (mín. 6)" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} data-testid="input-new-user-password" />
            <Select value={f.salon_role} onValueChange={(v: string) => setF({ ...f, salon_role: v as SalonUserIn["salon_role"] })}>
              <SelectTrigger className="w-full" data-testid="select-new-user-role"><SelectValue>{(v) => (v === "owner" ? "Proprietário" : "Profissional")}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">Proprietário</SelectItem>
                <SelectItem value="staff">Profissional</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={create.isPending} data-testid="btn-submit-new-user">Criar acesso</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
