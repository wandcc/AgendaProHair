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

/** True in the demo salon: the panel is view-only (the backend also refuses every write). */
export function useReadOnly(): boolean {
  return !!useMe().data?.is_demo;
}

export function homeFor(u: UserOut): string {
  return u.platform_role === "superadmin" ? "/admin" : "/app";
}
