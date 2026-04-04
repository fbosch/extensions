import { QueryCache, QueryClient } from "@tanstack/react-query";
import type {
  PersistedClient,
  Persister,
} from "@tanstack/react-query-persist-client";
import { Cache, showToast, Toast } from "@vicinae/api";
import { CACHE_MAX_AGE_MS, QUERY_PERSIST_KEY } from "./constants";

const cache = new Cache();

export const persister = {
  persistClient: async (client: PersistedClient) => {
    cache.set(QUERY_PERSIST_KEY, JSON.stringify(client));
  },
  restoreClient: async () => {
    const cached = cache.get(QUERY_PERSIST_KEY);
    if (!cached) {
      return undefined;
    }

    try {
      return JSON.parse(cached) as PersistedClient;
    } catch {
      cache.remove(QUERY_PERSIST_KEY);
      return undefined;
    }
  },
  removeClient: async () => {
    cache.remove(QUERY_PERSIST_KEY);
  },
} satisfies Persister;

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Unknown error";
      showToast({
        style: Toast.Style.Failure,
        title: "Wowhead search failed",
        message,
      });
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: CACHE_MAX_AGE_MS,
      gcTime: CACHE_MAX_AGE_MS,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
