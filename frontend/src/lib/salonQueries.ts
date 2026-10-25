import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import type { DashboardOut, Professional, Salon, Service } from "@/lib/types";

// Shared salon-panel queries (all keys under ["salon"], invalidated together after mutations).
export const useSalon = () => useQuery({ queryKey: ["salon", "me"], queryFn: () => apiGet<Salon>("/salon/me") });
export const useServices = () => useQuery({ queryKey: ["salon", "services"], queryFn: () => apiGet<Service[]>("/salon/services") });
export const usePros = () => useQuery({ queryKey: ["salon", "professionals"], queryFn: () => apiGet<Professional[]>("/salon/professionals") });
export const useDashboard = () => useQuery({ queryKey: ["salon", "dashboard"], queryFn: () => apiGet<DashboardOut>("/salon/dashboard") });
