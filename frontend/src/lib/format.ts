import { ApiError } from "@/lib/api";
import type { ApptStatus } from "@/lib/types";

const brlFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const brl = (n: number) => brlFmt.format(n || 0);

export const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Parse YYYY-MM-DD as a local calendar date (no timezone shift). */
export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function toIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function addDays(iso: string, n: number): string {
  const d = parseDate(iso);
  d.setDate(d.getDate() + n);
  return toIso(d);
}
export function startOfWeek(iso: string): string {
  const d = parseDate(iso);
  const diff = (d.getDay() + 6) % 7; // Monday start
  return addDays(iso, -diff);
}
export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}
export function longDate(iso: string): string {
  const d = parseDate(iso);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}
export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS[m - 1]} de ${y}`;
}
export function shiftMonth(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function formatPhone(digits: string): string {
  const d = digits.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return digits;
}
/** Input mask (DD) 9XXXX-XXXX */
export function maskPhone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** wa.me click-to-chat link. Brazilian numbers are normalized to 55 + DDD + number. */
export function waLink(phone: string, text: string): string {
  let d = phone.replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

export const STATUS_META: Record<ApptStatus, { label: string; cls: string; dot: string }> = {
  confirmado: { label: "Confirmado", cls: "bg-indigo-50 text-indigo-700 border-indigo-200", dot: "bg-indigo-500" },
  finalizado: { label: "Finalizado", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  cancelado: { label: "Cancelado", cls: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" },
  ausente: { label: "Ausente", cls: "bg-slate-100 text-slate-700 border-slate-300", dot: "bg-slate-400" },
};

export function errMsg(e: unknown, fallback = "Algo deu errado. Tente novamente."): string {
  if (e instanceof ApiError) {
    const b = e.body as { detail?: unknown } | null;
    if (typeof b?.detail === "string") return b.detail;
    if (Array.isArray(b?.detail)) return "Verifique os campos preenchidos.";
  }
  return fallback;
}
