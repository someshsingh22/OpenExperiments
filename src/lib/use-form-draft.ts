"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type DraftStatus = "idle" | "restored" | "saved";

function readDraft(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeDraft(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function removeDraft(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage unavailable (private mode, quota, disabled); nothing to clear.
  }
}

interface UseFormDraftOptions<T extends Record<string, unknown>> {
  key: string;
  values: T;
  /** When true, nothing worth keeping has been entered; any stored draft is removed. */
  isEmpty: boolean;
  /** Called once on mount with the stored draft. Must only call state setters. */
  onRestore: (draft: Partial<T>) => void;
  /** Skip restoring (e.g. when the URL already pre-fills the form). Saving still works. */
  restore?: boolean;
  delayMs?: number;
}

/**
 * Autosaves form values to localStorage (debounced) and restores them on mount.
 * Drafts survive reloads and the OAuth redirect; call `clear()` after a successful submit.
 */
export function useFormDraft<T extends Record<string, unknown>>({
  key,
  values,
  isEmpty,
  onRestore,
  restore = true,
  delayMs = 400,
}: UseFormDraftOptions<T>) {
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<DraftStatus>("idle");
  const onRestoreRef = useRef(onRestore);
  const baselineRef = useRef<string | undefined>(undefined);
  const pendingRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentRef = useRef("");

  const serialized = JSON.stringify(values);

  useEffect(() => {
    currentRef.current = serialized;
  }, [serialized]);

  useEffect(() => {
    if (restore) {
      const raw = readDraft(key);
      if (raw) {
        try {
          const parsed: unknown = JSON.parse(raw);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            onRestoreRef.current(parsed as Partial<T>);
            setStatus("restored");
          } else {
            removeDraft(key);
          }
        } catch {
          removeDraft(key);
        }
      }
    }
    setHydrated(true);
  }, [key, restore]);

  useEffect(() => {
    if (!hydrated) return;
    // The first render after hydration holds restored/pre-filled values: treat as the baseline.
    if (baselineRef.current === undefined) {
      baselineRef.current = serialized;
      return;
    }
    if (serialized === baselineRef.current) return;

    if (isEmpty) {
      pendingRef.current = null;
      baselineRef.current = serialized;
      removeDraft(key);
      setStatus("idle");
      return;
    }

    pendingRef.current = serialized;
    const timer = setTimeout(() => {
      timerRef.current = null;
      pendingRef.current = null;
      baselineRef.current = serialized;
      if (writeDraft(key, serialized)) setStatus("saved");
    }, delayMs);
    timerRef.current = timer;
    return () => {
      clearTimeout(timer);
      if (timerRef.current === timer) timerRef.current = null;
    };
  }, [hydrated, serialized, isEmpty, key, delayMs]);

  // Flush a pending save if the page is hidden or the component unmounts mid-debounce.
  useEffect(() => {
    const flush = () => {
      if (pendingRef.current) {
        writeDraft(key, pendingRef.current);
        baselineRef.current = pendingRef.current;
        pendingRef.current = null;
      }
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [key]);

  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    pendingRef.current = null;
    baselineRef.current = currentRef.current;
    removeDraft(key);
    setStatus("idle");
  }, [key]);

  return { status, clear };
}

export function draftStatusText(status: DraftStatus): string {
  if (status === "saved") return "Draft saved on this device";
  if (status === "restored") return "Restored your saved draft";
  return "";
}
