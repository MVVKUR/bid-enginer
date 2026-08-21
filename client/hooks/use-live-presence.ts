import { useEffect, useMemo, useState } from "react";

/**
 * Cross-tab presence for an auction room.
 *
 * Every tab writes a heartbeat into localStorage under the auction's key and
 * prunes entries that have gone stale. Because localStorage is shared across
 * tabs of the same origin, opening the app in a second tab genuinely shows up
 * as a second bidder — nothing here is simulated.
 */

const PRESENCE_PREFIX = "bestie:presence:";
const TAB_KEY = "bestie:tab";
const HEARTBEAT_MS = 2000;
const STALE_AFTER_MS = 6000;

export type PresenceIntent = "watching" | "bidding";

/**
 * Deliberately carries no identity: bidders compete blind, so presence records
 * only that *someone* is in the room and what they are doing.
 */
export interface PresenceEntry {
  tabId: string;
  intent: PresenceIntent;
  at: number;
}

type PresenceMap = Record<string, Omit<PresenceEntry, "tabId">>;

function presenceKey(auctionId: string) {
  return `${PRESENCE_PREFIX}${auctionId}`;
}

/** Stable per-tab id. sessionStorage is per-tab, so two tabs never collide. */
function getTabId(): string {
  if (typeof window === "undefined") return "server";
  let id = window.sessionStorage.getItem(TAB_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.sessionStorage.setItem(TAB_KEY, id);
  }
  return id;
}

function readPresence(auctionId: string): PresenceMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(presenceKey(auctionId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PresenceMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function prune(map: PresenceMap, now: number): PresenceMap {
  const next: PresenceMap = {};
  for (const [tabId, entry] of Object.entries(map)) {
    if (entry && now - entry.at < STALE_AFTER_MS) next[tabId] = entry;
  }
  return next;
}

function toEntries(map: PresenceMap): PresenceEntry[] {
  return Object.entries(map)
    .map(([tabId, entry]) => ({ tabId, ...entry }))
    .sort((a, b) => b.at - a.at);
}

export interface LivePresence {
  /** Everyone currently in the room. */
  entries: PresenceEntry[];
  /** Total people present. */
  total: number;
  /** People with the bid form actually open. */
  bidding: number;
  /** Present, excluding this tab. */
  others: number;
}

const EMPTY: LivePresence = { entries: [], total: 0, bidding: 0, others: 0 };

export interface UseLivePresenceOptions {
  /** When false the hook only observes and never announces this tab. */
  active?: boolean;
  intent?: PresenceIntent;
}

export function useLivePresence(
  auctionId: string | null,
  { active = false, intent = "watching" }: UseLivePresenceOptions = {},
): LivePresence {
  const [map, setMap] = useState<PresenceMap>({});
  const tabId = useMemo(() => getTabId(), []);

  useEffect(() => {
    if (!auctionId || typeof window === "undefined") {
      setMap({});
      return;
    }

    const key = presenceKey(auctionId);

    const sync = () => {
      const now = Date.now();
      const pruned = prune(readPresence(auctionId), now);

      if (active) {
        pruned[tabId] = { intent, at: now };
      } else {
        delete pruned[tabId];
      }

      try {
        if (Object.keys(pruned).length === 0) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, JSON.stringify(pruned));
      } catch {
        /* quota or private mode — presence is best-effort */
      }
      setMap(pruned);
    };

    sync();
    const timer = window.setInterval(sync, HEARTBEAT_MS);

    // Another tab joined, bid, or left — reflect it immediately.
    const onStorage = (event: StorageEvent) => {
      if (event.key === key) setMap(prune(readPresence(auctionId), Date.now()));
    };
    window.addEventListener("storage", onStorage);

    // Leave the room cleanly instead of waiting for the entry to go stale.
    const leave = () => {
      const remaining = prune(readPresence(auctionId), Date.now());
      delete remaining[tabId];
      try {
        if (Object.keys(remaining).length === 0) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, JSON.stringify(remaining));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("pagehide", leave);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pagehide", leave);
      if (active) leave();
    };
  }, [auctionId, active, intent, tabId]);

  return useMemo(() => {
    if (!auctionId) return EMPTY;
    const entries = toEntries(map);
    return {
      entries,
      total: entries.length,
      bidding: entries.filter((e) => e.intent === "bidding").length,
      others: entries.filter((e) => e.tabId !== tabId).length,
    };
  }, [auctionId, map, tabId]);
}
