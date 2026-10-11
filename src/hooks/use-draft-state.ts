import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

/**
 * useState that survives the browser discarding/reloading the tab (common on
 * mobile when switching to another app like WhatsApp). The value is kept in
 * localStorage while it differs from the initial value and removed as soon as
 * it goes back to the initial value (e.g. after saving or cancelling).
 *
 * Only use in client-only routes (under _authenticated, ssr: false).
 */
const PREFIX = "propz:draft:";
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 3; // 3 days

function read<T>(key: string): { found: boolean; value?: T } {
  if (typeof window === "undefined") return { found: false };
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return { found: false };
    const parsed = JSON.parse(raw) as { v: T; t: number };
    if (!parsed || typeof parsed.t !== "number" || Date.now() - parsed.t > MAX_AGE_MS) {
      window.localStorage.removeItem(PREFIX + key);
      return { found: false };
    }
    return { found: true, value: parsed.v };
  } catch {
    return { found: false };
  }
}

export function hasDraft(key: string): boolean {
  return read(key).found;
}

export function clearDrafts(keyPrefix: string) {
  if (typeof window === "undefined") return;
  try {
    const full = PREFIX + keyPrefix;
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(full)) toRemove.push(k);
    }
    toRemove.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

export function useDraftState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const initialJson = useRef(JSON.stringify(initial));
  const [value, setValue] = useState<T>(() => {
    const r = read<T>(key);
    return r.found ? (r.value as T) : initial;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const json = JSON.stringify(value);
      if (json === initialJson.current) {
        window.localStorage.removeItem(PREFIX + key);
      } else {
        window.localStorage.setItem(PREFIX + key, JSON.stringify({ v: value, t: Date.now() }));
      }
    } catch {
      /* storage full or unavailable: keep working in memory */
    }
  }, [key, value]);

  const set = useCallback<Dispatch<SetStateAction<T>>>((v) => setValue(v), []);
  return [value, set];
}
