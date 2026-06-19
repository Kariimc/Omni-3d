import { config } from "../config";
import { MemoryJobStore } from "./memory";
import { SupabaseJobStore } from "./supabase";
import type { JobStore } from "./types";

export type { JobStore } from "./types";
export { MemoryJobStore } from "./memory";
export { SupabaseJobStore } from "./supabase";

/** Pick a store from the environment: Supabase if fully configured, else in-memory. */
export function createJobStore(): JobStore {
  const { url, serviceKey } = config.supabase;
  if (url && serviceKey) return new SupabaseJobStore(url, serviceKey);
  return new MemoryJobStore();
}
