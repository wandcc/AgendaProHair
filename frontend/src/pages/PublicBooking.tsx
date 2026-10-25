import { useState, type FormEvent, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Check, CheckCircle2, Clock, Loader2, MapPin, MessageCircle, Moon, Scissors, Sparkles, Sun, Sunrise, User, Users } from "lucide-react";
import { toast } from "sonner";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import { addDays, brl, errMsg, longDate, maskPhone, parseDate, waLink, WEEKDAYS } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Availability, PublicBookingOut, PublicSalon, PublicService } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const COVER = "https://images.unsplash.com/photo-1790009419857-51fa0a2d9354?crop=entropy&cs=srgb&fm=jpg&q=75&w=1200";
const STEPS = ["Serviço", "Profissional", "Horário", "Seus dados"];
const ANY = "any";
const COVER_SCRIM = { background: "linear-gradient(135deg, rgba(15,23,42,0.92) 0%, rgba(30,27,75,0.88) 60%, rgba(136,19,55,0.75) 100%)" };

// Motion props hoisted so they are not recreated each render.
const STEP_MOTION = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: { duration: 0.22 },
};
const SUCCESS_MOTION = { initial: { opacity: 0, scale: 0.96 }, animate: { opacity: 1, scale: 1 } };

interface ClientInfo { name: string; phone: string; notes: string }

export default function PublicBooking() {
  const { slug = "" } = useParams();
  const salonQ = useQuery({ queryKey: ["public", slug], queryFn: () => apiGet<PublicSalon>(`/public/salons/${slug}`), retry: false });
  const salon = salonQ.isError ? undefined : salonQ.data;
  const [step, setStep] = useState(0);
  const [service, setService] = useState<PublicService | null>(null);
  const [pro, setPro] = useState<string>(ANY);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [client, setClient] = useState<ClientInfo>({ name: "", phone: "", notes: "" });
  const [done, setDone] = useState<PublicBookingOut | null>(null);

  const avail = useQuery({
    queryKey: ["public", slug, "availability", date, service?.id, pro],
    queryFn: () => apiGet<Availability>(`/public/salons/${slug}/availability?date=${date}&service_id=${service!.id}${pro !== ANY ? `&professional_id=${pro}` : ""}`),
    enabled: !!service && !!date && step === 2,
  });
  const book = useMutation({
    mutationFn: () => apiPost<PublicBookingOut>(`/public/salons/${slug}/book`, {
      service_id: service!.id, professional_id: pro === ANY ? null : pro, date, start: time,
      client_name: client.name, client_phone: client.phone.replace(/\D/g, ""), notes: client.notes,
    }),
    onSuccess: (r) => { setDone(r); toast.success("Agendamento confirmado com sucesso!"); },
    onError: (e) => {
      toast.error(errMsg(e, "Não foi possível agendar"));
      if (e instanceof ApiError && e.status === 409) { setTime(""); setStep(2); avail.refetch(); }
    },
  });

  const pickService = (sv: PublicService) => { setService(sv); setTime(""); setStep(1); };
  const pickPro = (id: string) => { setPro(id); setTime(""); setStep(2); };
  const pickDate = (d: string) => { setDate(d); setTime(""); };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (client.phone.replace(/\D/g, "").length < 10) return toast.error("Informe um WhatsApp válido com DDD");
    book.mutate();
  };
  const proName = pro === ANY ? "Qualquer profissional" : salon?.professionals.find((p) => p.id === pro)?.name ?? "";
  const showCta = !done && !salonQ.isError && (step === 2 || step === 3);

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto min-h-screen max-w-md bg-slate-50 shadow-xl shadow-slate-900/5">
        <SalonHeader salon={salon} unavailable={salonQ.isError} />
        <main className="relative -mt-4 rounded-t-3xl bg-slate-50 px-4 pb-32 pt-5">
          <BookingBody unavailable={salonQ.isError} done={done}>
            <Progress step={step} onBack={() => setStep(step - 1)} />
            <AnimatePresence mode="wait">
              <motion.div key={step} {...STEP_MOTION}>
                {step === 0 && <ServiceStep salon={salon} selected={service?.id} onPick={pickService} />}
                {step === 1 && <ProStep salon={salon} selected={pro} onPick={pickPro} />}
                {step === 2 && salon && (
                  <DateTimeStep salon={salon} date={date} time={time} avail={avail.isError ? undefined : avail.data} loading={avail.isFetching} onDate={pickDate} onTime={setTime} />
                )}
                {step === 3 && service && (
                  <DetailsStep service={service} proName={proName} date={date} time={time} client={client} onChange={setClient} onSubmit={submit} />
                )}
              </motion.div>
            </AnimatePresence>
          </BookingBody>
        </main>
        {showCta && <StickyCta step={step} time={time} pending={book.isPending} onContinue={() => setStep(3)} />}
      </div>
    </div>
  );
}

/* ---------- layout pieces ---------- */

function SalonHeader({ salon, unavailable }: { salon: PublicSalon | undefined; unavailable: boolean }) {
  const fallback = unavailable ? "Agenda indisponível" : "Carregando…";
  return (
    <header className="relative overflow-hidden">
      <img src={COVER} alt="" className="absolute inset-0 size-full object-cover" />
      <div className="absolute inset-0" style={COVER_SCRIM} />
      <div className="relative px-5 pb-8 pt-8 text-white">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-white/15 backdrop-blur"><Scissors className="size-5" /></span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold" data-testid="public-salon-name">{salon?.name ?? fallback}</h1>
            {salon?.address && <p className="flex items-center gap-1 truncate text-xs text-slate-300"><MapPin className="size-3" />{salon.address}</p>}
          </div>
        </div>
        {salon && <p className="mt-3 text-xs text-slate-300"><Clock className="mr-1 inline size-3" />{salon.work_days.map((d) => WEEKDAYS[d]).join(", ")} · {salon.open_time}–{salon.close_time}</p>}
      </div>
    </header>
  );
}

function BookingBody({ unavailable, done, children }: { unavailable: boolean; done: PublicBookingOut | null; children: ReactNode }) {
  if (unavailable) {
    return (
      <div className="py-16 text-center" data-testid="public-not-found">
        <p className="font-heading text-lg font-semibold">Esta agenda não está disponível</p>
        <p className="mt-1 text-sm text-slate-500">Verifique o link com o salão.</p>
      </div>
    );
  }
  if (done) return <Success b={done} />;
  return <>{children}</>;
}

function Progress({ step, onBack }: { step: number; onBack: () => void }) {
  return (
    <div className="mb-5" data-testid="booking-progress">
      <div className="flex gap-1.5">
        {STEPS.map((l, i) => <span key={l} className={cn("h-1.5 flex-1 rounded-full transition-colors duration-300", i <= step ? "bg-indigo-600" : "bg-slate-200")} />)}
      </div>
      <div className="mt-2 flex items-center justify-between">
        {step > 0 ? (
          <button onClick={onBack} className="flex items-center gap-1 text-sm font-medium text-slate-600" data-testid="btn-booking-back"><ArrowLeft className="size-4" />Voltar</button>
        ) : <span />}
        <span className="text-xs font-medium text-slate-500">Passo {step + 1} de 4 · {STEPS[step]}</span>
      </div>
    </div>
  );
}

function StickyCta({ step, time, pending, onContinue }: { step: number; time: string; pending: boolean; onContinue: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-slate-200 bg-white/95 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] backdrop-blur-xl">
      {step === 2 ? (
        <button disabled={!time} onClick={onContinue} data-testid="btn-booking-continue"
          className="h-12 w-full rounded-2xl bg-indigo-600 font-semibold text-white shadow-lg shadow-indigo-600/25 transition-opacity disabled:opacity-40">
          {time ? `Continuar · ${time}` : "Escolha um horário"}
        </button>
      ) : (
        <button type="submit" form="booking-form" disabled={pending} data-testid="btn-confirm-booking-step4"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-rose-600 font-semibold text-white shadow-lg shadow-rose-600/20 transition-opacity disabled:opacity-60">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Confirmar agendamento
        </button>
      )}
    </div>
  );
}

/* ---------- steps ---------- */

function ServiceStep({ salon, selected, onPick }: { salon: PublicSalon | undefined; selected: string | undefined; onPick: (s: PublicService) => void }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold">Escolha o serviço</h2>
      {salon && salon.services.length === 0 && <p className="text-sm text-slate-500" data-testid="public-no-services">Nenhum serviço disponível no momento.</p>}
      <div className="space-y-2.5">
        {salon?.services.map((sv) => (
          <button key={sv.id} onClick={() => onPick(sv)} data-testid={`booking-service-${sv.id}`}
            className={cn("flex w-full items-center gap-3 rounded-2xl border bg-white p-4 text-left shadow-sm transition-[border-color,box-shadow,transform] active:scale-[0.99]", selected === sv.id ? "border-indigo-500 ring-2 ring-indigo-100" : "border-slate-200 hover:border-slate-300")}>
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600"><Sparkles className="size-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-slate-900">{sv.name}</p>
              <p className="text-xs text-slate-500">{sv.category} · {sv.duration} min</p>
            </div>
            <span className="font-heading font-bold text-slate-900">{brl(sv.price)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function ProStep({ salon, selected, onPick }: { salon: PublicSalon | undefined; selected: string; onPick: (id: string) => void }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold">Com quem?</h2>
      <div className="space-y-2.5">
        <ProOption active={selected === ANY} onClick={() => onPick(ANY)} testId="booking-pro-any" icon={<Users className="size-5" />} title="Qualquer um disponível" subtitle="Mais opções de horário" highlight />
        {salon?.professionals.map((p) => (
          <ProOption key={p.id} active={selected === p.id} onClick={() => onPick(p.id)} testId={`booking-pro-${p.id}`} icon={<span className="font-heading text-base font-bold">{p.name.slice(0, 1)}</span>} title={p.name} subtitle={p.specialty} />
        ))}
      </div>
    </section>
  );
}

function ProOption({ active, onClick, icon, title, subtitle, testId, highlight }: { active: boolean; onClick: () => void; icon: ReactNode; title: string; subtitle: string; testId: string; highlight?: boolean }) {
  return (
    <button onClick={onClick} data-testid={testId}
      className={cn("flex w-full items-center gap-3 rounded-2xl border bg-white p-4 text-left shadow-sm transition-[border-color,box-shadow,transform] active:scale-[0.99]", active ? "border-indigo-500 ring-2 ring-indigo-100" : "border-slate-200")}>
      <span className={cn("grid size-11 shrink-0 place-items-center rounded-full", highlight ? "bg-indigo-600 text-white" : "bg-gradient-to-br from-indigo-100 to-rose-100 text-indigo-700")}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-slate-900">{title}</p>
        {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
      </div>
      {active ? <CheckCircle2 className="size-5 text-indigo-600" /> : <User className="size-4 text-slate-300" />}
    </button>
  );
}

function dateChipCls(selected: boolean, closed: boolean): string {
  if (selected) return "border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-600/25";
  if (closed) return "border-slate-100 bg-slate-100 text-slate-300";
  return "border-slate-200 bg-white text-slate-700";
}

function DateTimeStep({ salon, date, time, avail, loading, onDate, onTime }: {
  salon: PublicSalon; date: string; time: string; avail: Availability | undefined; loading: boolean;
  onDate: (d: string) => void; onTime: (t: string) => void;
}) {
  const days = Array.from({ length: 21 }, (_, i) => addDays(salon.today, i));
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold">Data e horário</h2>
      <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2" data-testid="booking-date-list">
        {days.map((d) => {
          const dt = parseDate(d);
          const closed = !salon.work_days.includes(dt.getDay());
          return (
            <button key={d} disabled={closed} onClick={() => onDate(d)} data-testid={`booking-date-${d}`}
              className={cn("flex w-16 shrink-0 snap-start flex-col items-center rounded-2xl border py-2.5 transition-[background-color,border-color,color]", dateChipCls(date === d, closed))}>
              <span className="text-[11px] font-medium uppercase">{WEEKDAYS[dt.getDay()]}</span>
              <span className="font-heading text-xl font-bold">{dt.getDate()}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-4">
        <SlotArea date={date} loading={loading} avail={avail} value={time} onPick={onTime} />
      </div>
    </section>
  );
}

function SlotArea({ date, loading, avail, value, onPick }: { date: string; loading: boolean; avail: Availability | undefined; value: string; onPick: (s: string) => void }) {
  if (!date) return <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Selecione um dia acima</p>;
  if (loading) return <p className="p-6 text-center text-sm text-slate-500"><Loader2 className="mr-2 inline size-4 animate-spin" />Buscando horários…</p>;
  const slots = avail?.slots ?? [];
  if (slots.length === 0) return <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500" data-testid="booking-no-slots">Sem horários livres neste dia. Tente outra data.</p>;
  return <SlotGroups slots={slots} value={value} onPick={onPick} />;
}

const SLOT_GROUPS = [
  { label: "Manhã", icon: Sunrise, match: (s: string) => s < "12:00" },
  { label: "Tarde", icon: Sun, match: (s: string) => s >= "12:00" && s < "18:00" },
  { label: "Noite", icon: Moon, match: (s: string) => s >= "18:00" },
];

function SlotGroups({ slots, value, onPick }: { slots: string[]; value: string; onPick: (s: string) => void }) {
  const groups = SLOT_GROUPS.map((g) => ({ ...g, items: slots.filter(g.match) })).filter((g) => g.items.length);
  return (
    <div className="space-y-4" data-testid="booking-slots">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><g.icon className="size-3.5" />{g.label}</p>
          <div className="grid grid-cols-4 gap-2">
            {g.items.map((s) => (
              <button key={s} onClick={() => onPick(s)} data-testid={`booking-slot-${s.replace(":", "")}`}
                className={cn("rounded-xl border py-2.5 font-mono text-sm font-medium transition-[background-color,border-color,color]", value === s ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-700")}>
                {s}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DetailsStep({ service, proName, date, time, client, onChange, onSubmit }: {
  service: PublicService; proName: string; date: string; time: string; client: ClientInfo;
  onChange: (c: ClientInfo) => void; onSubmit: (e: FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} id="booking-form">
      <h2 className="mb-3 text-lg font-bold">Seus dados</h2>
      <div className="mb-4 space-y-2 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-sm" data-testid="booking-summary">
        <Row k="Serviço" v={`${service.name} (${service.duration} min)`} />
        <Row k="Profissional" v={proName} />
        <Row k="Quando" v={`${longDate(date)} às ${time}`} />
        <Row k="Valor" v={brl(service.price)} bold />
      </div>
      <div className="space-y-3">
        <div className="space-y-1.5"><Label htmlFor="cn">Nome completo</Label><Input id="cn" required minLength={2} value={client.name} onChange={(e) => onChange({ ...client, name: e.target.value })} className="h-12 bg-white text-base" data-testid="input-client-name" /></div>
        <div className="space-y-1.5"><Label htmlFor="cp">WhatsApp</Label><Input id="cp" required inputMode="tel" placeholder="(11) 98765-4321" value={client.phone} onChange={(e) => onChange({ ...client, phone: maskPhone(e.target.value) })} className="h-12 bg-white text-base" data-testid="input-client-whatsapp" /></div>
        <div className="space-y-1.5"><Label htmlFor="co">Observações (opcional)</Label><Textarea id="co" rows={2} value={client.notes} onChange={(e) => onChange({ ...client, notes: e.target.value })} className="bg-white" data-testid="input-client-notes" /></div>
      </div>
    </form>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return <div className="flex justify-between gap-4"><span className="text-slate-500">{k}</span><span className={cn("text-right text-slate-900", bold ? "font-bold" : "font-medium")}>{v}</span></div>;
}

function Success({ b }: { b: PublicBookingOut }) {
  const msg = `Olá, ${b.salon_name}! Acabei de agendar pelo link:\n\n💇 ${b.service_name}\n👤 ${b.professional_name}\n📅 ${longDate(b.date)} às ${b.start}\n💰 ${brl(b.price)}\n\nNome: ${b.client_name}`;
  return (
    <motion.div {...SUCCESS_MOTION} className="py-6 text-center" data-testid="booking-success">
      <span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-100 text-emerald-600"><CheckCircle2 className="size-8" /></span>
      <h2 className="mt-4 text-2xl font-bold">Agendamento confirmado!</h2>
      <p className="mt-1 text-sm text-slate-500">Te esperamos, {b.client_name.split(" ")[0]}.</p>
      <div className="mt-6 space-y-2 rounded-2xl border border-slate-200 bg-white p-4 text-left text-sm">
        <Row k="Serviço" v={b.service_name} />
        <Row k="Profissional" v={b.professional_name} />
        <Row k="Data" v={longDate(b.date)} />
        <Row k="Horário" v={`${b.start} – ${b.end}`} />
        <Row k="Valor" v={brl(b.price)} bold />
      </div>
      {b.salon_phone && (
        <a href={waLink(b.salon_phone, msg)} target="_blank" rel="noopener noreferrer" data-testid="btn-whatsapp-confirm-link"
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] font-semibold text-white shadow-lg shadow-emerald-600/20 transition-opacity hover:opacity-90">
          <MessageCircle className="size-5" /> Enviar confirmação no WhatsApp
        </a>
      )}
      <button onClick={() => window.location.reload()} className="mt-3 text-sm font-medium text-indigo-600" data-testid="btn-booking-new">Fazer outro agendamento</button>
    </motion.div>
  );
}
