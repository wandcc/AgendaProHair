import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useMe } from "@/lib/useMe";
import { endSession } from "@/lib/session";

export function DemoBanner() {
  const me = useMe();
  if (me.data?.is_demo) {
    return (
      <div data-testid="demo-banner" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-gradient-to-r from-indigo-600 via-indigo-500 to-rose-500 px-4 py-2 text-center text-xs font-medium text-white sm:text-sm">
        <Sparkles className="size-4" />
        Você está no modo demonstração — os dados são de exemplo e se renovam diariamente.
        <button onClick={() => endSession("/login")} className="underline underline-offset-2" data-testid="demo-banner-exit">Sair da demonstração</button>
      </div>
    );
  }
  if (me.data?.salon_status === "inadimplente") {
    return (
      <div data-testid="billing-banner" className="bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-900">
        Pagamento da assinatura em atraso. Regularize para evitar a suspensão. <Link to="/app/configuracoes" className="underline">Ver detalhes</Link>
      </div>
    );
  }
  return null;
}
