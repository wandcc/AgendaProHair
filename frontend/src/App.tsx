import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import {
  CalendarDays, DollarSign, Layers, LayoutDashboard, QrCode, Scissors, Settings, ShieldCheck, Store, Users,
} from "lucide-react";
import { AppShell, type NavItem } from "@/components/AppShell";
import { DemoBanner } from "@/components/DemoBanner";
import { Toaster } from "@/components/ui/sonner";
import Login from "@/pages/Login";
import Landing from "@/pages/Landing";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminSalons from "@/pages/admin/AdminSalons";
import AdminPlans from "@/pages/admin/AdminPlans";
import SalonDashboard from "@/pages/salon/SalonDashboard";
import Agenda from "@/pages/salon/Agenda";
import Services from "@/pages/salon/Services";
import Team from "@/pages/salon/Team";
import Finance from "@/pages/salon/Finance";
import BookingLink from "@/pages/salon/BookingLink";
import SalonSettings from "@/pages/salon/SalonSettings";
import PublicBooking from "@/pages/PublicBooking";

const ADMIN_NAV: NavItem[] = [
  { label: "Visão Geral", short: "Início", path: "/admin", icon: ShieldCheck, testId: "superadmin", end: true, mobile: true },
  { label: "Assinantes", path: "/admin/assinantes", icon: Store, testId: "assinantes", mobile: true },
  { label: "Planos de Licença", short: "Planos", path: "/admin/planos", icon: Layers, testId: "planos", mobile: true },
];

const SALON_NAV: NavItem[] = [
  { label: "Dashboard", short: "Início", path: "/app", icon: LayoutDashboard, testId: "dashboard", end: true, mobile: true },
  { label: "Agenda", path: "/app/agenda", icon: CalendarDays, testId: "agenda", mobile: true },
  { label: "Serviços", path: "/app/servicos", icon: Scissors, testId: "servicos" },
  { label: "Equipe", path: "/app/equipe", icon: Users, testId: "profissionais" },
  { label: "Financeiro", path: "/app/financeiro", icon: DollarSign, testId: "financeiro", mobile: true },
  { label: "Link & QR Code", short: "Link", path: "/app/link", icon: QrCode, testId: "link", mobile: true },
  { label: "Configurações", path: "/app/configuracoes", icon: Settings, testId: "configuracoes" },
];

// Componente para proteger rotas privadas (redireciona para /login se não houver token)
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/agendar/:slug" element={<PublicBooking />} />
        
        {/* Rotas de Admin */}
        <Route path="/admin" element={<PrivateRoute><AppShell scope="admin" nav={ADMIN_NAV} /></PrivateRoute>}>
          <Route index element={<AdminDashboard />} />
          <Route path="assinantes" element={<AdminSalons />} />
          <Route path="planos" element={<AdminPlans />} />
        </Route>

        {/* Rotas do Salão */}
        <Route path="/app" element={<PrivateRoute><AppShell scope="salon" nav={SALON_NAV} banner={<DemoBanner />} /></PrivateRoute>}>
          <Route index element={<SalonDashboard />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="servicos" element={<Services />} />
          <Route path="equipe" element={<Team />} />
          <Route path="financeiro" element={<Finance />} />
          <Route path="link" element={<BookingLink />} />
          <Route path="configuracoes" element={<SalonSettings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster richColors mobileOffset={{ bottom: 80 }} />
    </>
  );
}
