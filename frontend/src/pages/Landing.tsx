import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight, BarChart3, CalendarCheck, CalendarDays, Check, Clock, Eye, Loader2, MessageCircle, QrCode,
  Scissors, Smartphone, Sparkles, Users, Wallet,
} from "lucide-react";
import { apiGet } from "@/lib/api";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";
import { homeFor, useMe } from "@/lib/useMe";
import { useDemoLogin } from "@/lib/useDemo";
import type { Plan, UserOut } from "@/lib/types";
import { Brand } from "@/components/AppShell";
import { buttonVariants } from "@/components/ui/button";

const HERO = "https://images.unsplash.com/photo-1790009419857-51fa0a2d9354?crop=entropy&cs=srgb&fm=jpg&q=80&w=1800";
const BARBER = "https://images.unsplash.com/photo-1647140655214-e4a2d914971f?crop=entropy&cs=srgb&fm=jpg&q=75&w=1000";
const HERO_SCRIM = { background: "linear-gradient(135deg, rgba(15,23,42,0.94) 0%, rgba(30,27,75,0.9) 55%, rgba(136,19,55,0.8) 100%)" };

const FEATURES = [
  { icon: CalendarDays, title: "Agenda diária e semanal", text: "Veja a equipe inteira numa grade por profissional, com status Confirmado, Finalizado, Cancelado e Ausente." },
  { icon: QrCode, title: "Link e QR Code", text: "Seu cliente agenda sozinho, 24h por dia, por um link exclusivo do seu salão ou pelo QR Code no balcão." },
  { icon: Wallet, title: "Financeiro e comissões", text: "Entradas por atendimento, despesas, lucro do mês e a comissão de cada profissional calculada na hora." },
  { icon: MessageCircle, title: "Confirmação por WhatsApp", text: "Mensagens prontas de confirmação e lembrete para o cliente, com um toque." },
  { icon: Users, title: "Equipe e serviços", text: "Cadastre profissionais, comissões, serviços com duração e preço. Os horários livres se ajustam sozinhos." },
  { icon: Smartphone, title: "Feito para o celular", text: "Painel com menu inferior no celular e página de agendamento 100% otimizada para o seu cliente." },
];

const STEPS = [
  { n: "1", t: "Escolhe o serviço", d: "Com duração e preço" },
  { n: "2", t: "Escolhe o profissional", d: "Ou qualquer um disponível" },
  { n: "3", t: "Escolhe dia e horário", d: "Só horários realmente livres" },
  { n: "4", t: "Confirma com nome e WhatsApp", d: "Pronto, está na sua agenda" },
];

const PREVIEW_ROWS = [
  { h: "09:00", n: "Larissa D.", s: "Design de Sobrancelhas", status: "Finalizado", cls: "bg-emerald-50 text-emerald-700" },
  { h: "10:00", n: "Felipe S.", s: "Mechas / Luzes", status: "Confirmado", cls: "bg-indigo-50 text-indigo-700" },
  { h: "11:30", n: "Isabela G.", s: "Corte Masculino", status: "Confirmado", cls: "bg-indigo-50 text-indigo-700" },
];

interface DemoProps { onDemo: () => void; pending: boolean }

function DemoButton({ onDemo, pending, className, testId, label = "Ver demonstração" }: DemoProps & { className?: string; testId: string; label?: string }) {
  return (
    <button onClick={onDemo} disabled={pending} data-testid={testId}
      className={cn("inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition-[background-color,box-shadow,transform,opacity] active:scale-[0.98] disabled:opacity-70", className)}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />} {label}
    </button>
  );
}

export default function Landing() {
  const me = useMe();
  const demo = useDemoLogin();
  const plans = useQuery({ queryKey: ["public", "plans"], queryFn: () => apiGet<Plan[]>("/public/plans") });
  const d: DemoProps = { onDemo: () => demo.mutate(), pending: demo.isPending };
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <LandingNav user={me.data} />
      <Hero {...d} />
      <Features />
      <ClientFlow />
      <Plans plans={plans.isError ? [] : plans.data ?? []} loading={plans.isPending} {...d} />
      <FinalCta {...d} />
      <Footer />
    </div>
  );
}

function LandingNav({ user }: { user: UserOut | undefined }) {
  return (
    <header className="absolute inset-x-0 top-0 z-30">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Brand />
        <nav className="flex items-center gap-2 sm:gap-3">
          <a href="#planos" className="hidden px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:text-white sm:block" data-testid="landing-nav-plans">Planos</a>
          <a href="#recursos" className="hidden px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:text-white sm:block" data-testid="landing-nav-features">Recursos</a>
          {user ? (
            <Link to={homeFor(user)} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100" data-testid="landing-nav-panel">Ir para o painel</Link>
          ) : (
            <Link to="/login" className="rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/20" data-testid="landing-nav-login">Entrar</Link>
          )}
        </nav>
      </div>
    </header>
  );
}

function Hero(d: DemoProps) {
  return (
    <section className="relative overflow-hidden">
      <img src={HERO} alt="Interior de salão de beleza" className="absolute inset-0 size-full object-cover" />
      <div className="absolute inset-0" style={HERO_SCRIM} />
      <div className="relative mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-32 sm:px-8 lg:grid-cols-[1.15fr_1fr] lg:pb-28 lg:pt-40">
        <div className="animate-fade-up text-white">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
            <Sparkles className="size-3.5 text-rose-300" /> Para salões, barbearias e estética
          </p>
          <h1 className="text-4xl font-extrabold leading-[1.05] sm:text-5xl lg:text-6xl" data-testid="landing-hero-title">
            Agenda cheia, equipe organizada e <span className="bg-gradient-to-r from-indigo-300 to-rose-300 bg-clip-text text-transparent">caixa no controle.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-slate-200">O AgendaPROHair junta agendamento online, agenda da equipe, financeiro com comissões e confirmação por WhatsApp num só lugar.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <DemoButton {...d} testId="landing-hero-demo-button" label="Ver demonstração do painel" className="h-13 bg-white px-6 text-slate-900 shadow-xl shadow-indigo-950/30 hover:bg-slate-100" />
            <a href="#planos" className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl border border-white/25 px-6 font-semibold text-white transition-colors hover:bg-white/10" data-testid="landing-hero-plans-button">
              Ver planos <ArrowRight className="size-4" />
            </a>
          </div>
          <p className="mt-4 text-sm text-slate-300">Sem cadastro: a demonstração abre um salão-exemplo, só para visualizar.</p>
        </div>
        <HeroPreview />
      </div>
    </section>
  );
}

function HeroPreview() {
  return (
    <div className="relative hidden lg:block">
      <div className="animate-float-slow rounded-3xl border border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between text-white">
          <p className="font-heading font-semibold">Hoje · Salão Exemplo</p>
          <span className="rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-xs font-medium text-emerald-200">14 agendamentos</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white p-4"><p className="text-xs text-slate-500">Faturamento hoje</p><p className="font-heading text-xl font-bold">R$ 630,00</p></div>
          <div className="rounded-2xl bg-white p-4"><p className="text-xs text-slate-500">Comissões</p><p className="font-heading text-xl font-bold">R$ 248,50</p></div>
        </div>
        <ul className="mt-3 space-y-2">
          {PREVIEW_ROWS.map((r) => (
            <li key={r.h} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3">
              <span className="font-mono text-sm font-semibold">{r.h}</span>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{r.n}</p><p className="truncate text-xs text-slate-500">{r.s}</p></div>
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", r.cls)}>{r.status}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="absolute -bottom-6 -left-8 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-xl">
        <span className="grid size-9 place-items-center rounded-xl bg-[#25D366] text-white"><MessageCircle className="size-4" /></span>
        <div><p className="text-sm font-semibold">Novo agendamento online</p><p className="text-xs text-slate-500">Ana agendou Escova · 14:30</p></div>
      </div>
    </div>
  );
}

function Features() {
  return (
    <section id="recursos" className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-wider text-rose-600">Recursos</p>
        <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Tudo que o seu salão precisa para o dia a dia</h2>
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <div key={f.title} data-testid={`landing-feature-${i}`} className={cn("rounded-3xl border bg-white p-6 shadow-sm transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-md", i === 0 ? "border-indigo-200 lg:row-span-2 lg:flex lg:flex-col" : "border-slate-200")}>
            <span className={cn("grid size-11 place-items-center rounded-2xl", i % 2 ? "bg-rose-50 text-rose-600" : "bg-indigo-50 text-indigo-600")}><f.icon className="size-5" /></span>
            <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{f.text}</p>
            {i === 0 && <img src={BARBER} alt="Profissional cortando cabelo" className="mt-6 hidden min-h-40 w-full flex-1 rounded-2xl object-cover lg:block" />}
          </div>
        ))}
      </div>
    </section>
  );
}

function ClientFlow() {
  return (
    <section className="bg-slate-900 py-20 text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[1fr_1.4fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-rose-300">Para o seu cliente</p>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Agendar leva menos de um minuto</h2>
          <p className="mt-4 text-slate-300">Uma página moderna, feita para o celular, com o nome do seu salão. Os horários respeitam o seu funcionamento e a agenda de cada profissional.</p>
        </div>
        <ol className="grid gap-3 sm:grid-cols-2">
          {STEPS.map((s) => (
            <li key={s.n} className="flex items-start gap-4 rounded-2xl border border-slate-800 bg-slate-800/50 p-5">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-rose-500 font-heading font-bold">{s.n}</span>
              <div><p className="font-semibold">{s.t}</p><p className="text-sm text-slate-400">{s.d}</p></div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Plans({ plans, loading, ...d }: { plans: Plan[]; loading: boolean } & DemoProps) {
  const featuredId = plans.length > 1 ? plans[plans.length - 1].id : null;
  return (
    <section id="planos" className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">Planos</p>
        <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Escolha o plano ideal para o seu negócio</h2>
        <p className="mt-3 text-slate-600">Mensalidade simples, sem fidelidade.</p>
      </div>
      <div className="mx-auto mt-12 grid max-w-5xl gap-5 md:grid-cols-2 lg:grid-cols-3" data-testid="landing-plans">
        {loading && <p className="col-span-full text-center text-sm text-slate-500">Carregando planos…</p>}
        {!loading && plans.length === 0 && <p className="col-span-full text-center text-sm text-slate-500" data-testid="landing-plans-empty">Os planos serão divulgados em breve.</p>}
        {plans.map((p) => <PlanCard key={p.id} plan={p} hot={p.id === featuredId} {...d} />)}
      </div>
    </section>
  );
}

function PlanCard({ plan: p, hot, ...d }: { plan: Plan; hot: boolean } & DemoProps) {
  const muted = hot ? "text-slate-300" : "text-slate-500";
  return (
    <div data-testid={`landing-plan-${p.id}`} className={cn("relative flex flex-col rounded-3xl border p-7", hot ? "border-indigo-500 bg-slate-900 text-white shadow-2xl shadow-indigo-900/20" : "border-slate-200 bg-white shadow-sm")}>
      {hot && <span className="absolute -top-3 left-7 rounded-full bg-gradient-to-r from-indigo-500 to-rose-500 px-3 py-1 text-xs font-semibold text-white">Mais completo</span>}
      <p className="font-heading text-lg font-bold">{p.name}</p>
      <p className="mt-4 font-heading text-4xl font-extrabold tracking-tight" data-testid={`landing-plan-price-${p.id}`}>{brl(p.price)}<span className={cn("text-sm font-medium", muted)}>/mês</span></p>
      <p className={cn("mt-1 text-sm", muted)}>Até {p.max_professionals} profissionais</p>
      <ul className="mt-6 flex-1 space-y-2.5">
        {p.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm"><Check className={cn("mt-0.5 size-4 shrink-0", hot ? "text-emerald-300" : "text-emerald-600")} />{f}</li>
        ))}
      </ul>
      <DemoButton {...d} testId={`landing-plan-demo-${p.id}`} label="Ver na demonstração"
        className={cn("mt-8 h-12 w-full", hot ? "bg-white text-slate-900 hover:bg-slate-100" : "bg-indigo-600 text-white hover:bg-indigo-700")} />
    </div>
  );
}

function FinalCta(d: DemoProps) {
  return (
    <section className="px-5 pb-20 sm:px-8">
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-6 overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-rose-600 p-8 text-white shadow-xl sm:p-12 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold sm:text-3xl">Veja o painel funcionando agora</h2>
          <p className="mt-2 max-w-lg text-indigo-100">Abra o salão-exemplo com agenda, equipe, financeiro e QR Code já preenchidos.</p>
        </div>
        <DemoButton {...d} testId="landing-cta-demo-button" label="Abrir demonstração" className="h-13 shrink-0 bg-white px-7 text-indigo-700 hover:bg-indigo-50" />
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-slate-500 sm:flex-row sm:px-8">
        <div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-rose-500 text-white"><Scissors className="size-3.5" /></span><span className="font-heading font-bold text-slate-900">AgendaPROHair</span></div>
        <div className="flex items-center gap-5">
          <span className="flex items-center gap-1.5"><Clock className="size-4" /> Agendamento 24h</span>
          <span className="flex items-center gap-1.5"><BarChart3 className="size-4" /> Gestão completa</span>
          <span className="flex items-center gap-1.5"><CalendarCheck className="size-4" /> Feito no Brasil</span>
        </div>
        <Link to="/login" className={buttonVariants({ variant: "ghost", size: "sm" })} data-testid="landing-footer-login">Área do assinante</Link>
      </div>
    </footer>
  );
}
