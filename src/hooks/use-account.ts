import { useQuery } from "@tanstack/react-query";
import { getAccountContext } from "@/lib/account-context";
export function useAccount() {
  return useQuery({ queryKey: ["account-context"], queryFn: getAccountContext });
}