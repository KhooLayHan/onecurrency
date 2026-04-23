import { useQuery } from "@tanstack/react-query";
import { orpcClient } from "@/lib/api";

const WALLET_QUERY_KEY = "user-primary-wallet";
const WALLET_STALE_TIME_MINUTES = 5;
const MS_PER_MINUTE = 60_000;
const WALLET_STALE_TIME_MS = WALLET_STALE_TIME_MINUTES * MS_PER_MINUTE;

type UserWallet = {
  walletId: number;
  address: string;
  networkId: number;
};

export function useUserWallet(): {
  walletId: number | undefined;
  address: string | undefined;
  networkId: number | undefined;
  isLoading: boolean;
  error: Error | null;
} {
  const { data, isLoading, error } = useQuery<UserWallet>({
    queryKey: [WALLET_QUERY_KEY],
    // orpcClient is a dynamic Proxy — procedures are resolved at runtime
    // queryFn: () => orpcClient.users.getPrimaryWallet({}),
    queryFn: () =>
      (
        orpcClient as unknown as {
          users: {
            getPrimaryWallet: (
              input: Record<string, never>
            ) => Promise<UserWallet>;
          };
        }
      ).users.getPrimaryWallet({}),
    retry: false,
    staleTime: WALLET_STALE_TIME_MS,
  });

  return {
    walletId: data?.walletId,
    address: data?.address,
    networkId: data?.networkId,
    isLoading,
    error,
  };
}
