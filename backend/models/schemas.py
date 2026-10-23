"""Pydantic models for AgendaPROHair. Each has a hand-written TS mirror in frontend/src/lib/types.ts."""

import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, Field

SalonStatus = Literal["ativo", "suspenso", "inadimplente"]
ApptStatus = Literal["confirmado", "finalizado", "cancelado", "ausente"]
SalonRole = Literal["owner", "staff"]

HHMM = r"^([01]\d|2[0-3]):[0-5]\d$"
DATE = r"^\d{4}-\d{2}-\d{2}$"


def _id() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------- auth ----------
class LoginIn(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    platform_role: Optional[str] = None
    salon_id: Optional[str] = None
    salon_role: Optional[str] = None
    salon_name: Optional[str] = None
    salon_slug: Optional[str] = None
    salon_status: Optional[str] = None
    is_demo: bool = False


# ---------- plans ----------
class PlanIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    price: float = Field(ge=0)
    max_professionals: int = Field(ge=1, le=500)
    features: list[str] = []
    active: bool = True


class Plan(PlanIn):
    id: str = Field(default_factory=_id)


# ---------- salons ----------
class Salon(BaseModel):
    id: str = Field(default_factory=_id)
    name: str
    slug: str
    phone: str = ""
    address: str = ""
    plan_id: str
    status: SalonStatus = "ativo"
    open_time: str = "09:00"
    close_time: str = "19:00"
    work_days: list[int] = [1, 2, 3, 4, 5, 6]  # 0=Domingo ... 6=Sábado
    slot_interval: int = 30
    is_demo: bool = False
    created_at: datetime = Field(default_factory=_now)


class SalonAdminRow(Salon):
    plan_name: str = ""
    plan_price: float = 0
    owner_name: str = ""
    owner_email: str = ""
    professionals_count: int = 0
    users_count: int = 0


class SalonAdminUpdateIn(BaseModel):
    """Full subscriber registration edit by the Super Admin (salon data + owner access)."""
    name: str = Field(min_length=2, max_length=80)
    slug: str = Field(min_length=3, max_length=60, pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$")
    phone: str = ""
    address: str = Field(default="", max_length=160)
    plan_id: str
    status: SalonStatus
    owner_name: str = Field(min_length=2)
    owner_email: str = Field(min_length=5)
    owner_password: Optional[str] = Field(default=None, min_length=6)  # only when resetting


class SalonCreateIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    slug: str = Field(min_length=3, max_length=60, pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$")
    phone: str = ""
    plan_id: str
    owner_name: str = Field(min_length=2)
    owner_email: str = Field(min_length=5)
    owner_password: str = Field(min_length=6)


class SalonPatchIn(BaseModel):
    status: Optional[SalonStatus] = None
    plan_id: Optional[str] = None


class SalonUserIn(BaseModel):
    name: str = Field(min_length=2)
    email: str = Field(min_length=5)
    password: str = Field(min_length=6)
    salon_role: SalonRole = "staff"


class SalonUserOut(BaseModel):
    id: str
    name: str
    email: str
    salon_role: str


class PlanBreakdown(BaseModel):
    plan_name: str
    count: int
    revenue: float


class AdminMetrics(BaseModel):
    total_salons: int
    active: int
    suspended: int
    delinquent: int
    total_professionals: int
    total_users: int
    mrr: float
    plans: list[PlanBreakdown]


class SalonSettingsIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    phone: str = ""
    address: str = ""
    open_time: str = Field(pattern=HHMM)
    close_time: str = Field(pattern=HHMM)
    work_days: list[int]
    slot_interval: int = Field(ge=10, le=120)


# ---------- services / team ----------
class ServiceIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    category: str = "Cabelo"
    duration: int = Field(ge=5, le=600)
    price: float = Field(ge=0)
    active: bool = True


class Service(ServiceIn):
    id: str = Field(default_factory=_id)
    salon_id: str


class ProfessionalIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    specialty: str = ""
    phone: str = ""
    commission_pct: float = Field(ge=0, le=100, default=40)
    active: bool = True


class Professional(ProfessionalIn):
    id: str = Field(default_factory=_id)
    salon_id: str


# ---------- appointments ----------
class AppointmentIn(BaseModel):
    service_id: str
    professional_id: Optional[str] = None  # None = qualquer disponível
    client_name: str = Field(min_length=2, max_length=80)
    client_phone: str = Field(min_length=10, max_length=20)
    date: str = Field(pattern=DATE)
    start: str = Field(pattern=HHMM)
    notes: str = Field(default="", max_length=300)


class Appointment(BaseModel):
    id: str = Field(default_factory=_id)
    salon_id: str
    service_id: str
    service_name: str
    professional_id: str
    professional_name: str
    client_name: str
    client_phone: str
    date: str
    start: str
    end: str
    price: float
    commission_pct: float
    status: ApptStatus = "confirmado"
    notes: str = ""
    source: Literal["online", "interno"] = "interno"
    commission_paid: bool = False
    created_at: datetime = Field(default_factory=_now)


class AppointmentPatch(BaseModel):
    status: ApptStatus


class Availability(BaseModel):
    date: str
    open: bool
    slots: list[str]


# ---------- finance ----------
class ExpenseIn(BaseModel):
    description: str = Field(min_length=2, max_length=120)
    category: str = "Outros"
    amount: float = Field(gt=0)
    date: str = Field(pattern=DATE)


class Expense(ExpenseIn):
    id: str = Field(default_factory=_id)
    salon_id: str


class ProfessionalCommission(BaseModel):
    professional_id: str
    name: str
    commission_pct: float
    appointments: int
    revenue: float
    commission: float
    paid: float
    pending: float


class DailyPoint(BaseModel):
    date: str
    revenue: float
    expenses: float


class FinanceOut(BaseModel):
    month: str
    revenue: float
    expenses_total: float
    commissions_total: float
    profit: float
    by_professional: list[ProfessionalCommission]
    expenses: list[Expense]
    entries: list[Appointment]
    daily: list[DailyPoint]


class PayCommissionIn(BaseModel):
    professional_id: str
    month: str = Field(pattern=r"^\d{4}-\d{2}$")


class Notification(BaseModel):
    id: str
    title: str
    message: str
    created_at: datetime


class DashboardOut(BaseModel):
    today: str
    revenue_today: float
    revenue_month: float
    forecast_month: float
    appointments_today_count: int
    pending_today: int
    commissions_pending: float
    appointments_today: list[Appointment]
    notifications: list[Notification]


# ---------- public ----------
class PublicProfessional(BaseModel):
    id: str
    name: str
    specialty: str


class PublicService(BaseModel):
    id: str
    name: str
    category: str
    duration: int
    price: float


class PublicSalon(BaseModel):
    name: str
    slug: str
    phone: str
    address: str
    open_time: str
    close_time: str
    work_days: list[int]
    today: str
    services: list[PublicService]
    professionals: list[PublicProfessional]


class PublicBookingOut(BaseModel):
    id: str
    salon_name: str
    salon_phone: str
    service_name: str
    professional_name: str
    client_name: str
    date: str
    start: str
    end: str
    price: float
