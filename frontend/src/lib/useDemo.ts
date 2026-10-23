import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { apiPost } from "@/lib/api";
import { beginSession } from "@/lib/session";
import { errMsg } from "@/lib/format";
import { homeFor } from "@/lib/useMe";
import { queryClient } from "@/lib/queryClient";
import type { UserOut } from "@/lib/types";

/** Shared sign-in success handler: reset cache, prime "me", go to the right panel. */
export function useSignedIn() {
  const nav = useNavigate();
  return (u: UserOut) => {
    beginSession();
    queryClient.setQueryData(["me"], u);
    toast.success(`Bem-vindo(a), ${u.name}!`);
    nav(homeFor(u), { replace: true });
  };
}

/** Opens the view-only demo salon panel. */
export function useDemoLogin() {
  const onSuccess = useSignedIn();
  return useMutation({
    mutationFn: () => apiPost<UserOut>("/auth/demo"),
    onSuccess,
    onError: (e) => toast.error(errMsg(e, "Demonstração indisponível no momento")),
  });
}
