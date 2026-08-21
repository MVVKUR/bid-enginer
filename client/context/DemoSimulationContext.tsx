import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuctions } from "@/context/AuctionContext";
import { useAuth } from "@/context/AuthContext";
import { getAuctionStatus } from "@/lib/auctions";
import { isDemoExhausted, isDemoRoom } from "@/lib/demo-bidders";
import { nextSimulatedOffer } from "@/lib/demo-bidders";

/**
 * Demo mode: synthetic banks bid against the signed-in user so the auction
 * room visibly moves. Offers are stored with `simulated: true` and the UI
 * labels the mode, so demo activity is never mistaken for real bidding.
 */

const ENABLED_KEY = "bestie:demo-sim";
const LEADER_KEY = "bestie:demo-sim-leader";
const AUTO_RESTART_KEY = "bestie:demo-autorestart";
const SPEED_KEY = "bestie:demo-speed";
const TAB_KEY = "bestie:tab";

export type DemoSpeed = "santai" | "normal" | "ramai";

/** Tick interval and per-auction bid chance for each pace. */
const SPEED_SETTINGS: Record<DemoSpeed, { tickMs: number; chance: number }> = {
  santai: { tickMs: 6000, chance: 0.35 },
  normal: { tickMs: 3000, chance: 0.45 },
  ramai: { tickMs: 1200, chance: 0.7 },
};

/** How long an exhausted or finished room waits before the next round opens. */
const RESTART_DELAY_MS = 5000;
/** Length of an auto-started round: long enough to watch, short enough to settle. */
const RESTART_ROUND_SECONDS = 120;
/** A leader claim older than this is considered abandoned. */
const LEADER_STALE_MS = 8000;

function getTabId(): string {
  if (typeof window === "undefined") return "server";
  let id = window.sessionStorage.getItem(TAB_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.sessionStorage.setItem(TAB_KEY, id);
  }
  return id;
}

/**
 * On by default so a fresh demo visibly moves, but the choice is remembered:
 * once the user turns it off it stays off.
 */
function readStored<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(key) as T | null;
    return stored && allowed.includes(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
}

function readAutoRestart(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = window.localStorage.getItem(AUTO_RESTART_KEY);
    return stored === null ? true : stored === "1";
  } catch {
    return false;
  }
}

function readEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = window.localStorage.getItem(ENABLED_KEY);
    return stored === null ? true : stored === "1";
  } catch {
    return false;
  }
}

/**
 * Exactly one tab drives the simulation. Without this, three open tabs would
 * each inject offers and the rate would triple-step.
 */
function claimLeadership(tabId: string, now: number): boolean {
  try {
    const raw = window.localStorage.getItem(LEADER_KEY);
    if (raw) {
      const claim = JSON.parse(raw) as { tabId: string; at: number };
      const fresh = now - claim.at < LEADER_STALE_MS;
      if (fresh && claim.tabId !== tabId) return false;
    }
    window.localStorage.setItem(LEADER_KEY, JSON.stringify({ tabId, at: now }));
    return true;
  } catch {
    return false;
  }
}

interface DemoSimulationValue {
  enabled: boolean;
  setEnabled: (next: boolean) => void;
  /** Reopens a room automatically once it settles, so activity never stops. */
  autoRestart: boolean;
  setAutoRestart: (next: boolean) => void;
  speed: DemoSpeed;
  setSpeed: (next: DemoSpeed) => void;
  /** True when this tab is the one driving offers. */
  isDriver: boolean;
  /** auctionId -> timestamp when its next round opens. */
  pendingRestarts: Record<string, number>;
  /** Places one synthetic offer immediately, for a manual demo nudge. */
  injectOnce: () => void;
}

const SPEEDS = ["santai", "normal", "ramai"] as const;

const DemoSimulationContext = createContext<DemoSimulationValue | null>(null);

export function DemoSimulationProvider({ children }: { children: ReactNode }) {
  const { auctions, placeRate, relistAuction } = useAuctions();
  const { user } = useAuth();
  const [enabled, setEnabledState] = useState<boolean>(readEnabled);
  const [autoRestart, setAutoRestartState] = useState<boolean>(readAutoRestart);
  const [speed, setSpeedState] = useState<DemoSpeed>(() =>
    readStored<DemoSpeed>(SPEED_KEY, "normal", SPEEDS),
  );
  const [isDriver, setIsDriver] = useState(false);
  // Rooms this driver has bid in during this session. Combined with the
  // persisted `simulated` flag below, so a reload does not strand a room.
  const touched = useRef<Set<string>>(new Set());
  const restartAt = useRef<Map<string, number>>(new Map());
  // Exposed so the UI can say when the next round opens.
  const [pendingRestarts, setPendingRestarts] = useState<Record<string, number>>({});
  const tabId = useMemo(() => getTabId(), []);

  // The ticker reads these through a ref so it never restarts mid-auction just
  // because the auction list changed.
  const latest = useRef({
    auctions,
    placeRate,
    relistAuction,
    autoRestart,
    institution: user?.institution,
  });
  latest.current = {
    auctions,
    placeRate,
    relistAuction,
    autoRestart,
    institution: user?.institution,
  };

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    try {
      window.localStorage.setItem(ENABLED_KEY, next ? "1" : "0");
    } catch {
      /* best effort */
    }
  }, []);

  const setAutoRestart = useCallback((next: boolean) => {
    setAutoRestartState(next);
    try {
      window.localStorage.setItem(AUTO_RESTART_KEY, next ? "1" : "0");
    } catch {
      /* best effort */
    }
  }, []);

  const setSpeed = useCallback((next: DemoSpeed) => {
    setSpeedState(next);
    try {
      window.localStorage.setItem(SPEED_KEY, next);
    } catch {
      /* best effort */
    }
  }, []);

  const placeOne = useCallback((auctionId: string) => {
    const { auctions: list, placeRate: place, institution } = latest.current;
    const auction = list.find((item) => item.id === auctionId);
    if (!auction) return false;

    const offer = nextSimulatedOffer(auction, institution);
    if (!offer) return false;

    const result = place({
      auctionId: auction.id,
      bidderName: offer.bidderName,
      institution: offer.institution,
      rate: offer.rate,
      tenorMonths: offer.tenorMonths,
      simulated: true,
    });
    if (result.success) touched.current.add(auction.id);
    return result.success;
  }, []);

  const injectOnce = useCallback(() => {
    const live = latest.current.auctions.filter(
      (auction) => getAuctionStatus(auction) === "live",
    );
    for (const auction of live) {
      if (placeOne(auction.id)) return;
    }
  }, [placeOne]);

  // Keep the toggle in sync when another tab flips it.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === ENABLED_KEY) setEnabledState(event.newValue === "1");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setIsDriver(false);
      restartAt.current.clear();
      setPendingRestarts({});
      return;
    }

    const { tickMs, chance } = SPEED_SETTINGS[speed];

    const tick = () => {
      const now = Date.now();
      const leading = claimLeadership(tabId, now);
      setIsDriver(leading);
      if (!leading) return;

      const { auctions: list, relistAuction: relist, autoRestart: restartOn } = latest.current;

      list.forEach((auction) => {
        if (getAuctionStatus(auction, now) === "live") {
          if (Math.random() < chance) placeOne(auction.id);
        }

        if (!restartOn || !isDemoRoom(auction, touched.current)) return;

        // A room the demo was running has settled or hit its band — reopen it
        // after a beat so competitors visibly come back for another round.
        if (isDemoExhausted(auction, now)) {
          const due = restartAt.current.get(auction.id);
          if (due === undefined) {
            restartAt.current.set(auction.id, now + RESTART_DELAY_MS);
          } else if (now >= due) {
            restartAt.current.delete(auction.id);
            relist(auction.id, RESTART_ROUND_SECONDS);
          }
        } else {
          restartAt.current.delete(auction.id);
        }
      });

      setPendingRestarts(Object.fromEntries(restartAt.current));
    };

    tick();
    const timer = window.setInterval(tick, tickMs);

    const release = () => {
      try {
        const raw = window.localStorage.getItem(LEADER_KEY);
        if (!raw) return;
        const claim = JSON.parse(raw) as { tabId: string };
        if (claim.tabId === tabId) window.localStorage.removeItem(LEADER_KEY);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("pagehide", release);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pagehide", release);
      release();
    };
  }, [enabled, speed, tabId, placeOne]);

  const value = useMemo<DemoSimulationValue>(
    () => ({
      enabled,
      setEnabled,
      autoRestart,
      setAutoRestart,
      speed,
      setSpeed,
      isDriver,
      pendingRestarts,
      injectOnce,
    }),
    [
      enabled,
      setEnabled,
      autoRestart,
      setAutoRestart,
      speed,
      setSpeed,
      isDriver,
      pendingRestarts,
      injectOnce,
    ],
  );

  return (
    <DemoSimulationContext.Provider value={value}>
      {children}
    </DemoSimulationContext.Provider>
  );
}

export function useDemoSimulation() {
  const ctx = useContext(DemoSimulationContext);
  if (!ctx)
    throw new Error("useDemoSimulation must be used within DemoSimulationProvider");
  return ctx;
}
