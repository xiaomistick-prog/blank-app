"use client";

import { useSyncExternalStore } from "react";
import { decodeWatchlist, WATCHLIST_KEY } from "./watchlist";

interface WatchlistState { ids: string[]; error: boolean }
const EMPTY: WatchlistState = { ids: [], error: false };
let state = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function getSnapshot(): WatchlistState {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    try { state = { ids: decodeWatchlist(localStorage.getItem(WATCHLIST_KEY)), error: false }; }
    catch { state = { ids: [], error: true }; }
  }
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === WATCHLIST_KEY || event.key === null) {
      loaded = false;
      getSnapshot();
      for (const notify of listeners) notify();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(listener); window.removeEventListener("storage", onStorage); };
}

function toggle(companyId: string) {
  const current = getSnapshot();
  const ids = current.ids.includes(companyId) ? current.ids.filter(id => id !== companyId) : [...current.ids, companyId];
  try {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify({ version: 1, companyIds: ids }));
    state = { ids, error: false };
  } catch { state = { ...current, error: true }; }
  for (const listener of listeners) listener();
}

export function useWatchlist() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
  return { ...snapshot, toggle };
}
