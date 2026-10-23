import { useRef } from "react";
import { Copy, Download, ExternalLink, MessageCircle, QrCode } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import { useMe } from "@/lib/useMe";
import { PageHeader, Panel } from "@/components/common";
import { Button } from "@/components/ui/button";

export default function BookingLink() {
  const me = useMe();
  const slug = me.data?.salon_slug ?? "";
  const url = `${window.location.origin}/agendar/${slug}`;
  const wrap = useRef<HTMLDivElement>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie manualmente.");
    }
  };
  const download = () => {
    const canvas = wrap.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `qrcode-${slug}.png`;
    a.click();
    toast.success("QR Code baixado");
  };
  const share = `https://wa.me/?text=${encodeURIComponent(`Agende seu horário no ${me.data?.salon_name ?? "salão"} pelo link: ${url}`)}`;

  return (
    <>
      <PageHeader title="Link de Agendamento" subtitle="Compartilhe com seus clientes no Instagram, WhatsApp e na recepção." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel title="Seu link público" testId="panel-public-link">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex min-w-0 flex-1 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm text-slate-800" data-testid="public-booking-url">
              <span className="truncate">{url}</span>
            </div>
            <Button onClick={copy} className="h-auto py-3" data-testid="btn-copy-public-booking-url"><Copy className="size-4" /> Copiar link</Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={`/agendar/${slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50" data-testid="btn-open-public-page">
              <ExternalLink className="size-4" /> Abrir página
            </a>
            <a href={share} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90" data-testid="btn-share-whatsapp">
              <MessageCircle className="size-4" /> Compartilhar no WhatsApp
            </a>
          </div>
          <div className="mt-6 rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-rose-900 p-5 text-white">
            <p className="font-heading font-semibold">Dica</p>
            <p className="mt-1 text-sm text-slate-200">Coloque o link na bio do Instagram e imprima o QR Code para deixar no balcão e no espelho. Seus clientes agendam sozinhos, 24h por dia.</p>
          </div>
        </Panel>

        <Panel title="QR Code" testId="panel-qr-code">
          <div className="flex flex-col items-center">
            <div ref={wrap} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="qr-code-canvas">
              {slug ? <QRCodeCanvas value={url} size={220} level="M" marginSize={1} fgColor="#0F172A" /> : <QrCode className="size-40 text-slate-200" />}
            </div>
            <p className="mt-3 text-center text-sm font-semibold text-slate-900">{me.data?.salon_name}</p>
            <p className="text-center text-xs text-slate-500">Aponte a câmera para agendar</p>
            <Button variant="outline" className="mt-4" onClick={download} data-testid="btn-download-qr-code"><Download className="size-4" /> Baixar PNG</Button>
          </div>
        </Panel>
      </div>
    </>
  );
}
