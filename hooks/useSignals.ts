import { useQuery } from "@tanstack/react-query";
import { fetchSignals, NetworkError, ServerError } from "@/lib/api";
import { queryOptions } from "@/lib/queryOptions";

export function useSignals() {
  return useQuery({
    queryKey: ["signals"],
    queryFn: fetchSignals,
    ...queryOptions.signal,
    retry: (failureCount, error) => {
      if (error instanceof NetworkError && failureCount < 2) return true;
      if (error instanceof ServerError && error.status >= 500 && failureCount < 2) return true;
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 10000),
  });
}
