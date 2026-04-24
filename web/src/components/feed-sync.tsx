"use client";

// Bridges the local zustand feed store to Supabase (saved_items + read_items).
//
//   signed-out  — localStorage only (unchanged)
//   signed-in   — on login: merge local-only saves/reads up → pull server → hydrate store
//                 on sign-out: resetLocal so next user starts clean
//
// Mount once, near the root, alongside <ProfileSync />.

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { useFeedStore } from "@/store/feed";
import type { Paper, Event, Job } from "@/types";

interface SavedApiRow {
  itemId: string;
  itemKind: "paper" | "event" | "job";
  payload: unknown;
  savedAt: string;
}

interface ReadApiRow {
  itemId: string;
  readAt: string;
}

async function fetchSaved(): Promise<SavedApiRow[] | null> {
  try {
    const res = await fetch("/api/saved", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { items: SavedApiRow[] };
    return data.items ?? [];
  } catch (err) {
    console.warn("[FeedSync] GET /api/saved failed", err);
    return null;
  }
}

async function fetchRead(): Promise<ReadApiRow[] | null> {
  try {
    const res = await fetch("/api/read", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { items: ReadApiRow[] };
    return data.items ?? [];
  } catch (err) {
    console.warn("[FeedSync] GET /api/read failed", err);
    return null;
  }
}

async function pushSaved(
  itemId: string,
  itemKind: "paper" | "event" | "job",
  payload: unknown,
) {
  try {
    await fetch("/api/saved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, itemKind, payload }),
    });
  } catch (err) {
    console.warn("[FeedSync] push saved failed", err);
  }
}

async function pushRead(itemId: string) {
  try {
    await fetch("/api/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId }),
    });
  } catch (err) {
    console.warn("[FeedSync] push read failed", err);
  }
}

export function FeedSync() {
  const didInitialSyncRef = useRef(false);

  useEffect(() => {
    if (!supabase) return;

    const onSession = async (signedIn: boolean) => {
      console.info("[FeedSync] auth:", signedIn ? "signed-in" : "signed-out");
      if (!signedIn) {
        didInitialSyncRef.current = false;
        useFeedStore.getState().resetLocal();
        return;
      }
      if (didInitialSyncRef.current) return;
      didInitialSyncRef.current = true;

      // 1. Push any local-only signals up first. The cloud is source of
      //    truth from this point — but we don't want to drop anything the
      //    user saved while signed out.
      const local = useFeedStore.getState();
      const localPushes: Promise<void>[] = [];
      for (const p of local.savedPapers) localPushes.push(pushSaved(p.id, "paper", p));
      for (const e of local.savedEvents) localPushes.push(pushSaved(e.id, "event", e));
      for (const j of local.savedJobs) localPushes.push(pushSaved(j.id, "job", j));
      for (const id of Object.keys(local.readItems)) localPushes.push(pushRead(id));
      await Promise.allSettled(localPushes);

      // 2. Now pull the merged server state and hydrate.
      const [savedRows, readRows] = await Promise.all([fetchSaved(), fetchRead()]);

      const savedPapers: Paper[] = [];
      const savedEvents: Event[] = [];
      const savedJobs: Job[] = [];
      for (const row of savedRows ?? []) {
        if (row.itemKind === "paper") savedPapers.push(row.payload as Paper);
        else if (row.itemKind === "event") savedEvents.push(row.payload as Event);
        else if (row.itemKind === "job") savedJobs.push(row.payload as Job);
      }
      const readItems: Record<string, true> = {};
      for (const r of readRows ?? []) readItems[r.itemId] = true;

      useFeedStore.getState().hydrateFromRemote({
        savedPapers,
        savedEvents,
        savedJobs,
        readItems,
      });
    };

    supabase.auth.getUser().then(({ data }) => onSession(!!data.user));

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") onSession(false);
      else if (session?.user) onSession(true);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return null;
}
