import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import type { UserOut } from "@/lib/types";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => apiGet<UserOut>("/auth/me"),
    retry: false,
    staleTime: 60_000,
  });
}

export function homeFor(u: UserOut): string {
  return u.platform_role === "superadmin" ? "/admin" : "/app";
}
