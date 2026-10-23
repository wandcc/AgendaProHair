// Hand-written mirrors of backend/models/schemas.py — keep in sync.

export type SalonStatus = "ativo" | "suspenso" | "inadimplente";
export type ApptStatus = "confirmado" | "finalizado" | "cancelado" | "ausente";
export type SalonRole = "owner" | "staff";

export interface UserOut {
  id: string;
  email: string;
  name: string;
  platform_role: string | null;
  salon_id: string | null;
  salon_role: string | null;
  salon_name: string | null;
  salon_slug: string | null;
  salon_status: string | null;
  is_demo: boolean;
}

export interface PlanIn {
  name: string;
  price: number;
  max_professionals: number;
  features: string[];
  active: boolean;
}
export interface Plan extends PlanIn {
  id: string;
}

export interface Salon {
  id: string;
  name: string;
  slug: string;
  phone: string;
  address: string;
  plan_id: string;
  status: SalonStatus;
  open_time: string;
  close_time: string;
  work_days: number[];
  slot_interval: number;
  is_demo: boolean;
  created_at: string;
}

export interface SalonAdminRow extends Salon {
  plan_name: string;
  plan_price: number;
  owner_name: string;
  owner_email: string;
  professionals_count: number;
  users_count: number;
}

export interface SalonAdminUpdateIn {
  name: string;
  slug: string;
  phone: string;
  address: string;
  plan_id: string;
  status: SalonStatus;
  owner_name: string;
  owner_email: string;
  owner_password: string | null;
}

export interface SalonCreateIn {
  name: string;
  slug: string;
  phone: string;
  plan_id: string;
  owner_name: string;
  owner_email: string;
  owner_password: string;
}

export interface SalonPatchIn {
  status?: SalonStatus;
  plan_id?: string;
}

export interface SalonUserIn {
  name: string;
  email: string;
  password: string;
  salon_role: SalonRole;
}
export interface SalonUserOut {
  id: string;
  name: string;
  email: string;
  salon_role: string;
}

export interface PlanBreakdown {
  plan_name: string;
  count: number;
  revenue: number;
}
export interface AdminMetrics {
  total_salons: number;
  active: number;
  suspended: number;
  delinquent: number;
  total_professionals: number;
  total_users: number;
  mrr: number;
  plans: PlanBreakdown[];
}

export interface SalonSettingsIn {
  name: string;
  phone: string;
  address: string;
  open_time: string;
  close_time: string;
  work_days: number[];
  slot_interval: number;
}

export interface ServiceIn {
  name: string;
  category: string;
  duration: number;
  price: number;
  active: boolean;
}
export interface Service extends ServiceIn {
  id: string;
  salon_id: string;
}

export interface ProfessionalIn {
  name: string;
  specialty: string;
  phone: string;
  commission_pct: number;
  active: boolean;
}
export interface Professional extends ProfessionalIn {
  id: string;
  salon_id: string;
}

export interface AppointmentIn {
  service_id: string;
  professional_id: string | null;
  client_name: string;
  client_phone: string;
  date: string;
  start: string;
  notes: string;
}

export interface Appointment {
  id: string;
  salon_id: string;
  service_id: string;
  service_name: string;
  professional_id: string;
  professional_name: string;
  client_name: string;
  client_phone: string;
  date: string;
  start: string;
  end: string;
  price: number;
  commission_pct: number;
  status: ApptStatus;
  notes: string;
  source: "online" | "interno";
  commission_paid: boolean;
  created_at: string;
}

export interface Availability {
  date: string;
  open: boolean;
  slots: string[];
}

export interface ExpenseIn {
  description: string;
  category: string;
  amount: number;
  date: string;
}
export interface Expense extends ExpenseIn {
  id: string;
  salon_id: string;
}

export interface ProfessionalCommission {
  professional_id: string;
  name: string;
  commission_pct: number;
  appointments: number;
  revenue: number;
  commission: number;
  paid: number;
  pending: number;
}
export interface DailyPoint {
  date: string;
  revenue: number;
  expenses: number;
}
export interface FinanceOut {
  month: string;
  revenue: number;
  expenses_total: number;
  commissions_total: number;
  profit: number;
  by_professional: ProfessionalCommission[];
  expenses: Expense[];
  entries: Appointment[];
  daily: DailyPoint[];
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  created_at: string;
}
export interface DashboardOut {
  today: string;
  revenue_today: number;
  revenue_month: number;
  forecast_month: number;
  appointments_today_count: number;
  pending_today: number;
  commissions_pending: number;
  appointments_today: Appointment[];
  notifications: Notification[];
}

export interface PublicProfessional {
  id: string;
  name: string;
  specialty: string;
}
export interface PublicService {
  id: string;
  name: string;
  category: string;
  duration: number;
  price: number;
}
export interface PublicSalon {
  name: string;
  slug: string;
  phone: string;
  address: string;
  open_time: string;
  close_time: string;
  work_days: number[];
  today: string;
  services: PublicService[];
  professionals: PublicProfessional[];
}
export interface PublicBookingOut {
  id: string;
  salon_name: string;
  salon_phone: string;
  service_name: string;
  professional_name: string;
  client_name: string;
  date: string;
  start: string;
  end: string;
  price: number;
}
