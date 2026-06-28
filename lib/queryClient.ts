import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,   // 1 min — overridden per hook via queryOptions.*
      gcTime: 5 * 60_000,  // 5 min garbage-collect unused cache entries
      retry: 2,
      refetchOnWindowFocus: false, // opt-in per category instead of global default
    },
  },
});
