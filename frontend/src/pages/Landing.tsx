import { Link, useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();

  const handlePanelClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token) {
      if (user) {
        navigate(homeFor(user));
      } else {
        navigate('/app');
      }
    } else {
      navigate('/login');
    }
  };

  return (
    <header className="absolute inset-x-0 top-0 z-30">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Brand />
        <nav className="flex items-center gap-2 sm:gap-3">
          <a href="#planos" className="hidden px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:text-white sm:block" data-testid="landing-nav-plans">Planos</a>
          <a href="#recursos" className="hidden px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:text-white sm:block" data-testid="landing-nav-features">Recursos</a>
          {user ? (
            <button onClick={handlePanelClick} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100" data-testid="landing-nav-panel">Ir para o painel</button>
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
          <div key={f.title} data-testid
