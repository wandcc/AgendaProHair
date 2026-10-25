import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownCircle, ArrowUpCircle, ChevronLeft, ChevronRight, Coins, PiggyBank, Plus, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { brl, errMsg, monthLabel, shiftMonth, shortDate } from "@/lib/format";
import { useReadOnly } from "@/lib/useMe";
import type { Expense, ExpenseIn, FinanceOut } from "@/lib/types";
import { EmptyState, PageHeader, Panel, StatCard } from "@/components/common";
import { useDashboard } from "@/lib/salonQueries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Chart props hoisted so Recharts doesn't receive new objects on every render.
const AXIS_TICK = { fontSize: 11, fill: "#64748B" };
const fmtTooltip = (value: number, name: string): [string, string] => [brl(value), name];
const fmtDayLabel = (label: string) => `Dia ${label}`;

const EXP_CATS = ["Aluguel", "Produtos", "Energia", "Água", "Serviços", "Marketing", "Salários", "Outros"];

export default function Finance() {
  const qc = useQueryClient();
  const dash = useDashboard();
  const ro = useReadOnly();
  const [month, setMonth] = useState("");
  const m = month || dash.data?.today.slice(0, 7) || "";
  const fin = useQuery({ queryKey: ["salon", "finance", m], queryFn: () => apiGet<FinanceOut>(`/salon/finance?month=${m}`), enabled: !!m });
  const d = fin.isError ? undefined : fin.data;
  const [expOpen, setExpOpen] = useState(false);
  const chartData = useMemo(() => (d?.daily ?? []).map((x) => ({ ...x, label: x.date.slice(8) })), [d?.daily]);

  const pay = useMutation({
    mutationFn: (professional_id: string) => apiPost<{ updated: number }>("/salon/commissions/pay", { professional_id, month: m }),
    onSuccess: (r) => { toast.success(`${r.updated} comissões marcadas como pagas`); qc.invalidateQueries({ queryKey: ["salon"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const delExp = useMutation({
    mutationFn: (id: string) => apiDelete(`/salon/expenses/${id}`),
    onSuccess: () => { toast.success("Despesa removida"); qc.invalidateQueries({ queryKey: ["salon"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const dashTxt = "—";

  return (
    <>
      <PageHeader
        title="Financeiro"
        subtitle="Entradas por atendimento, comissões e despesas do salão."
        actions={
          <>
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
              <Button variant="ghost" size="icon-sm" onClick={() => setMonth(shiftMonth(m, -1))} disabled={!m} aria-label="Mês anterior" data-testid="btn-finance-prev-month"><ChevronLeft className="size-4" /></Button>
              <span className="min-w-32 text-center text-sm font-medium first-letter:uppercase" data-testid="finance-month-label">{m ? monthLabel(m) : ""}</span>
              <Button variant="ghost" size="icon-sm" onClick={() => setMonth(shiftMonth(m, 1))} disabled={!m} aria-label="Próximo mês" data-testid="btn-finance-next-month"><ChevronRight className="size-4" /></Button>
            </div>
            {!ro && <Button onClick={() => setExpOpen(true)} data-testid="btn-new-expense"><Plus className="size-4" /> Despesa</Button>}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard testId="kpi-finance-revenue" label="Entradas" value={d ? brl(d.revenue) : dashTxt} hint={d ? `${d.entries.length} atendimentos finalizados` : undefined} icon={<ArrowUpCircle className="size-4.5" />} tone="emerald" />
        <StatCard testId="kpi-finance-commissions" label="Comissões" value={d ? brl(d.commissions_total) : dashTxt} icon={<Coins className="size-4.5" />} tone="amber" />
        <StatCard testId="kpi-finance-expenses" label="Despesas" value={d ? brl(d.expenses_total) : dashTxt} icon={<ArrowDownCircle className="size-4.5" />} tone="rose" />
        <StatCard testId="kpi-finance-profit" label="Lucro líquido" value={d ? brl(d.profit) : dashTxt} hint="Entradas − comissões − despesas" icon={<PiggyBank className="size-4.5" />} />
      </div>

      <Panel title="Fluxo de caixa diário" className="mt-6" testId="panel-cashflow">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4F46E5" stopOpacity={0.35} /><stop offset="100%" stopColor="#4F46E5" stopOpacity={0} /></linearGradient>
                <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#E11D48" stopOpacity={0.25} /><stop offset="100%" stopColor="#E11D48" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={50} />
              <Tooltip formatter={fmtTooltip} labelFormatter={fmtDayLabel} />
              <Area type="monotone" dataKey="revenue" name="Entradas" stroke="#4F46E5" strokeWidth={2} fill="url(#gRev)" />
              <Area type="monotone" dataKey="expenses" name="Despesas" stroke="#E11D48" strokeWidth={2} fill="url(#gExp)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Tabs defaultValue="comissoes" className="mt-6">
        <TabsList>
          <TabsTrigger value="comissoes" data-testid="tab-finance-commissions">Comissões</TabsTrigger>
          <TabsTrigger value="entradas" data-testid="tab-finance-entries">Entradas</TabsTrigger>
          <TabsTrigger value="despesas" data-testid="tab-finance-expenses">Despesas</TabsTrigger>
        </TabsList>

        <TabsContent value="comissoes" className="mt-4">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <Table data-testid="table-commissions">
              <TableHeader><TableRow className="bg-slate-50/80"><TableHead>Profissional</TableHead><TableHead className="hidden sm:table-cell">Atend.</TableHead><TableHead className="hidden sm:table-cell">Produção</TableHead><TableHead>Comissão</TableHead><TableHead>A pagar</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {(d?.by_professional ?? []).map((r) => (
                  <TableRow key={r.professional_id} data-testid={`commission-row-${r.professional_id}`}>
                    <TableCell><p className="font-medium">{r.name}</p><p className="text-xs text-slate-500">{r.commission_pct}%</p></TableCell>
                    <TableCell className="hidden sm:table-cell">{r.appointments}</TableCell>
                    <TableCell className="hidden sm:table-cell">{brl(r.revenue)}</TableCell>
                    <TableCell>{brl(r.commission)}</TableCell>
                    <TableCell className={r.pending > 0 ? "font-semibold text-amber-700" : "text-emerald-700"}>{r.pending > 0 ? brl(r.pending) : "Pago"}</TableCell>
                    <TableCell className="text-right">
                      {!ro && <Button size="sm" variant="outline" disabled={r.pending <= 0 || pay.isPending} onClick={() => pay.mutate(r.professional_id)} data-testid={`btn-pay-commission-${r.professional_id}`}>Marcar pago</Button>}
                    </TableCell>
                  </TableRow>
                ))}
                {d && d.by_professional.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-slate-500">Nenhum profissional cadastrado.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="entradas" className="mt-4">
          {d && d.entries.length === 0 ? (
            <EmptyState icon={<Receipt className="size-5" />} title="Sem entradas neste mês" text="Atendimentos marcados como Finalizado aparecem aqui." />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <Table data-testid="table-entries">
                <TableHeader><TableRow className="bg-slate-50/80"><TableHead>Data</TableHead><TableHead>Cliente</TableHead><TableHead className="hidden md:table-cell">Serviço</TableHead><TableHead className="hidden md:table-cell">Profissional</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(d?.entries ?? []).map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-xs">{shortDate(a.date)} {a.start}</TableCell>
                      <TableCell className="font-medium">{a.client_name}</TableCell>
                      <TableCell className="hidden md:table-cell">{a.service_name}</TableCell>
                      <TableCell className="hidden md:table-cell">{a.professional_name}</TableCell>
                      <TableCell className="text-right font-medium text-emerald-700">{brl(a.price)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="despesas" className="mt-4">
          {d && d.expenses.length === 0 ? (
            <EmptyState icon={<Receipt className="size-5" />} title="Nenhuma despesa" text="Registre aluguel, produtos, contas e outras saídas." action={!ro && <Button onClick={() => setExpOpen(true)}>Registrar despesa</Button>} />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <Table data-testid="table-expenses">
                <TableHeader><TableRow className="bg-slate-50/80"><TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead className="hidden sm:table-cell">Categoria</TableHead><TableHead className="text-right">Valor</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {(d?.expenses ?? []).map((e: Expense) => (
                    <TableRow key={e.id} data-testid={`expense-row-${e.id}`}>
                      <TableCell className="font-mono text-xs">{shortDate(e.date)}</TableCell>
                      <TableCell className="font-medium">{e.description}</TableCell>
                      <TableCell className="hidden sm:table-cell">{e.category}</TableCell>
                      <TableCell className="text-right font-medium text-rose-700">{brl(e.amount)}</TableCell>
                      <TableCell className="text-right">{!ro && <Button variant="ghost" size="icon-sm" onClick={() => delExp.mutate(e.id)} aria-label="Excluir" data-testid={`btn-delete-expense-${e.id}`}><Trash2 className="size-4 text-rose-600" /></Button>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={expOpen} onOpenChange={setExpOpen}>
        <DialogContent data-testid="dialog-expense">{expOpen && <ExpenseForm defaultDate={dash.data?.today ?? ""} onDone={() => setExpOpen(false)} />}</DialogContent>
      </Dialog>
    </>
  );
}

function ExpenseForm({ defaultDate, onDone }: { defaultDate: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState<ExpenseIn>({ description: "", category: "Produtos", amount: 0, date: defaultDate });
  const save = useMutation({
    mutationFn: () => apiPost<Expense>("/salon/expenses", f),
    onSuccess: () => { toast.success("Despesa registrada"); qc.invalidateQueries({ queryKey: ["salon"] }); onDone(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate(); };
  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader><DialogTitle>Nova despesa</DialogTitle></DialogHeader>
      <div className="space-y-1.5"><Label>Descrição</Label><Input required value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} data-testid="input-expense-description" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Categoria</Label>
          <Select value={f.category} onValueChange={(v: string) => setF({ ...f, category: v })}>
            <SelectTrigger className="w-full" data-testid="select-expense-category"><SelectValue /></SelectTrigger>
            <SelectContent>{EXP_CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>Valor (R$)</Label><Input required type="number" min={0.01} step="0.01" value={f.amount || ""} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} data-testid="input-expense-amount" /></div>
      </div>
      <div className="space-y-1.5"><Label>Data</Label><Input required type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} data-testid="input-expense-date" /></div>
      <DialogFooter><Button type="submit" disabled={save.isPending} data-testid="btn-save-expense">Salvar despesa</Button></DialogFooter>
    </form>
  );
}
