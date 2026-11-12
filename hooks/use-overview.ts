"use client";
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/api-client";
import type { Home } from "@/lib/overview";

const MIN_REFETCH_MS = 15000;
const DEFAULT_POLL_MS = 30000;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const b = body as { error?: string; code?: string; detail?: string };
    throw new ApiError(b.error || `Request failed (${res.status})`, res.status, b.code, b.detail);
  }
  return body as T;
}

/**
 * The cross-project overview, refetched on the app's poll interval but never
 * faster than every 15 seconds (each refresh runs two bd reads per project).
 */
export function useOverview() {
  const config = useQuery({
    queryKey: ["config"],
    queryFn: () => getJson<{ pollIntervalMs?: number }>("/api/config"),
    staleTime: 60000,
  });
  const pollMs = config.data?.pollIntervalMs ?? DEFAULT_POLL_MS;
  return useQuery({
    queryKey: ["overview"],
    queryFn: () => getJson<Home>("/api/overview"),
    refetchInterval: Math.max(pollMs, MIN_REFETCH_MS),
  });
}
