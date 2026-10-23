import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, CalendarCheck, Eye, Loader2, QrCode, Wallet } from "lucide-react";
import { toast } from "sonner";
import { apiPost } from "@/lib/api";
import { errMsg } from "@/lib/format";
import { homeFor, useMe } from "@/lib/useMe";
import { useDemoLogin, useSignedIn } from "@/lib/useDemo";
import type { UserOut } from "@/lib/types";
import { Brand } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const HERO = "https://images.unsplash.com/photo-1790009419857-51fa0a2d9354?crop=entropy&cs=srgb&fm=jpg&q=80&w=1600";

export default function Login() {
  const me = useMe();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const onSuccess = useSignedIn();
  const login = useMutation({
    mutationFn: () => apiPost<UserOut>("/auth/login", { email, password }),
    onSuccess,
    onError: (e) => toast.error(errMsg(e, "Não foi possível entrar")),
  });
  const demo = useDemoLogin();

  if (me.data) return <Navigate to={homeFor(me.data)} replace />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate();
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Showcase */}
      <div className="relative hidden overflow-hidden lg:block">
        <img src={HERO} alt="Interior de salão de beleza" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(15,23,42,0.92) 0%, rgba(30,27,75,0.88) 60%, rgba(136,19,55,0.75) 100%)" }} />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Brand />
          <div className="max-w-lg animate-fade-up">
            <p className="mb-4 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">Para salões, barbearias e estética</p>
            <h1 className="text-5xl font-extrabold leading-[1.05]">Sua agenda cheia, <span className="text-rose-300">sem complicação.</span></h1>
            <p className="mt-5 text-lg text-slate-200">Agendamento online 24h, controle financeiro, comissões da equipe e confirmação por WhatsApp — tudo num só lugar.</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: CalendarCheck, t: "Agenda diária e semanal" },
              { icon: Wallet, t: "Financeiro e comissões" },
              { icon: QrCode, t: "Link e QR Code" },
            ].map(({ icon: I, t }, i) => (
              <div key={t} className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md animate-float-slow" style={{ animationDelay: `${i * 0.6}s` }}>
                <I className="mb-2 size-5 text-indigo-200" />
                <p className="text-sm font-medium">{t}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="flex flex-col justify-center bg-white px-6 py-10 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-10 lg:hidden"><Brand dark={false} /></div>
          <h2 className="text-3xl font-bold text-slate-900">Entrar</h2>
          <p className="mt-2 text-sm text-slate-500">Acesse o painel do seu salão ou o painel administrativo.</p>

          <form onSubmit={submit} className="mt-8 space-y-4" data-testid="login-form">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@seusalao.com.br" data-testid="login-email-input" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" data-testid="login-password-input" className="h-11" />
            </div>
            <Button type="submit" className="h-11 w-full text-sm" disabled={login.isPending} data-testid="login-submit-button">
              {login.isPending ? <Loader2 className="size-4 animate-spin" /> : <>Entrar <ArrowRight className="size-4" /></>}
            </Button>
          </form>

          <div className="my-8 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" /> ou <span className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-rose-50 p-5">
            <p className="font-heading font-semibold text-slate-900">Quer ver como funciona?</p>
            <p className="mt-1 text-sm text-slate-600">Abra um salão-exemplo com serviços, equipe e agendamentos do dia já preenchidos.</p>
            <Button variant="outline" className="mt-4 h-11 w-full border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50" onClick={() => demo.mutate()} disabled={demo.isPending} data-testid="btn-view-demo">
              {demo.isPending ? <Loader2 className="size-4 animate-spin" /> : <><Eye className="size-4" /> Ver demonstração do Painel do Salão</>}
            </Button>
          </div>
          <p className="mt-6 text-center text-xs text-slate-400">O acesso de salões é criado pelo administrador da plataforma.</p>
        </div>
      </div>
    </div>
  );
}
