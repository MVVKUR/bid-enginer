import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";
import { Auction, PayoutMode } from "@shared/api";
import { getAuctionStatus, getCurrentRate } from "@/lib/auctions";
import { isCeilingReached, RATE_STEP, roundRate } from "@/lib/currency";

/** Bumped when the auction shape changes so stale local data is discarded. */
const STORAGE_KEY = "bestie:deposito:v2";

const MILIAR = 1_000_000_000;

/** Demo sprint round: short enough to watch open, run, and settle. */
export const SPRINT_SECONDS = 30;

function seedAuctions(): Auction[] {
  const now = Date.now();
  const hour = 1000 * 60 * 60;
  return [
    {
      id: crypto.randomUUID(),
      title: "Deposito Kilat — Ronde Demo 30 Detik",
      description:
        "Ronde singkat untuk demo: auction ditutup 30 detik setelah dibuka, lalu pemenangnya langsung terlihat. Dapat diulang kapan saja.",
      startTime: new Date(now).toISOString(),
      endTime: new Date(now + SPRINT_SECONDS * 1000).toISOString(),
      principal: 1 * MILIAR,
      minTenorMonths: 1,
      maxTenorMonths: 3,
      payout: "maturity",
      startingRate: 5.75,
      minRate: 5.75,
      maxRate: 7.0,
      bids: [],
      createdAt: new Date(now).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      title: "Deposito Berjangka — Dana Kelolaan JHT",
      description:
        "Penempatan dana kelolaan jangka pendek. Bank menawarkan rate dan mengisi tenor sendiri dalam rentang yang ditentukan. Bunga dibayar saat jatuh tempo.",
      startTime: new Date(now - hour * 2).toISOString(),
      endTime: new Date(now + hour * 5).toISOString(),
      principal: 5 * MILIAR,
      minTenorMonths: 1,
      maxTenorMonths: 6,
      payout: "maturity",
      startingRate: 6.0,
      minRate: 6.0,
      maxRate: 7.5,
      bids: [
        {
          id: crypto.randomUUID(),
          bidderName: "Amara Nasution",
          institution: "Bank Mandiri",
          rate: 6.25,
          tenorMonths: 3,
          createdAt: new Date(now - hour).toISOString(),
        },
        {
          id: crypto.randomUUID(),
          bidderName: "Devon Kusuma",
          institution: "Bank BNI",
          rate: 6.4,
          tenorMonths: 6,
          createdAt: new Date(now - hour * 0.5).toISOString(),
        },
      ],
      createdAt: new Date(now - hour * 3).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      title: "Deposito On Call — Likuiditas Harian",
      description:
        "Penempatan likuiditas jangka sangat pendek, dapat ditarik dengan notifikasi 1 hari kerja. Tanpa batas atas rate — penawaran tertinggi menang.",
      startTime: new Date(now - hour).toISOString(),
      endTime: new Date(now + hour * 24).toISOString(),
      principal: 2.5 * MILIAR,
      minTenorMonths: 1,
      maxTenorMonths: 2,
      payout: "maturity",
      startingRate: 5.25,
      minRate: null,
      maxRate: null,
      bids: [
        {
          id: crypto.randomUUID(),
          bidderName: "Priya Salim",
          institution: "Bank BCA",
          rate: 5.6,
          tenorMonths: 1,
          createdAt: new Date(now - hour * 0.2).toISOString(),
        },
      ],
      createdAt: new Date(now - hour * 4).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      title: "Deposito Berjangka — Dana Jaminan Pensiun",
      description:
        "Penempatan dana jaminan sosial dengan bunga dibayar bulanan. Auction dibuka sebentar lagi — siapkan penawaran rate dan tenor Anda.",
      startTime: new Date(now + hour * 6).toISOString(),
      endTime: new Date(now + hour * 30).toISOString(),
      principal: 10 * MILIAR,
      minTenorMonths: 3,
      maxTenorMonths: 12,
      payout: "monthly",
      startingRate: 6.5,
      minRate: 6.5,
      maxRate: 8.0,
      bids: [],
      createdAt: new Date(now - hour * 5).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      title: "Deposito Berjangka — Dana Cadangan Teknis",
      description:
        "Penempatan jangka panjang, bunga dibayar saat jatuh tempo. Auction telah ditutup — lihat rate pemenang.",
      startTime: new Date(now - hour * 30).toISOString(),
      endTime: new Date(now - hour * 2).toISOString(),
      principal: 7.5 * MILIAR,
      minTenorMonths: 6,
      maxTenorMonths: 24,
      payout: "maturity",
      startingRate: 6.75,
      minRate: 6.75,
      maxRate: null,
      bids: [
        {
          id: crypto.randomUUID(),
          bidderName: "Marcus Tanuwijaya",
          institution: "Bank BRI",
          rate: 7.1,
          tenorMonths: 12,
          createdAt: new Date(now - hour * 10).toISOString(),
        },
        {
          id: crypto.randomUUID(),
          bidderName: "Lena Wijaya",
          institution: "Bank Danamon",
          rate: 7.35,
          tenorMonths: 24,
          createdAt: new Date(now - hour * 3).toISOString(),
        },
      ],
      createdAt: new Date(now - hour * 40).toISOString(),
    },
  ];
}

/**
 * Stored data is only trusted if it still matches the current Auction shape.
 * Without this, an older persisted shape renders as "undefined bulan" instead
 * of failing loudly, and every downstream calculation silently produces NaN.
 */
export function isValidAuction(value: unknown): value is Auction {
  if (!value || typeof value !== "object") return false;
  const auction = value as Partial<Auction>;
  return (
    typeof auction.id === "string" &&
    typeof auction.title === "string" &&
    typeof auction.startTime === "string" &&
    typeof auction.endTime === "string" &&
    Number.isFinite(auction.principal) &&
    Number.isInteger(auction.minTenorMonths) &&
    Number.isInteger(auction.maxTenorMonths) &&
    Number.isFinite(auction.startingRate) &&
    Array.isArray(auction.bids)
  );
}

function parseStored(raw: string | null): Auction[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    // One bad record means the whole payload is from an older shape.
    return parsed.every(isValidAuction) ? (parsed as Auction[]) : null;
  } catch {
    return null;
  }
}

function loadAuctions(): Auction[] {
  if (typeof window === "undefined") return seedAuctions();
  // A missing key means a first visit; an empty array means the admin deleted
  // everything, which must not be quietly re-seeded.
  const stored = parseStored(window.localStorage.getItem(STORAGE_KEY));
  return stored ?? seedAuctions();
}

export interface NewAuctionInput {
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  principal: number;
  minTenorMonths: number;
  maxTenorMonths: number;
  payout: PayoutMode;
  startingRate: number;
  minRate: number | null;
  maxRate: number | null;
}

export interface PlaceRateInput {
  auctionId: string;
  bidderName: string;
  institution: string;
  rate: number;
  tenorMonths: number;
  /** Set by demo mode so synthetic offers stay distinguishable in the data. */
  simulated?: boolean;
}

export interface PlaceRateResult {
  success: boolean;
  error?: string;
}

interface AuctionContextValue {
  auctions: Auction[];
  createAuction: (input: NewAuctionInput) => void;
  deleteAuction: (id: string) => void;
  placeRate: (input: PlaceRateInput) => PlaceRateResult;
  /** Reopens an auction for another round, clearing its bids. Demo affordance. */
  relistAuction: (id: string, durationSeconds?: number) => void;
  /** Moves an auction's close time without touching its bids. Demo affordance. */
  setAuctionDeadline: (id: string, secondsFromNow: number) => void;
}

const AuctionContext = createContext<AuctionContextValue | null>(null);

/**
 * Validates a rate + tenor offer against the auction's rules. Pure, so the
 * dialog can preview the verdict while the user types and the writer can
 * enforce the same rule at commit time.
 */
export function validateOffer(
  auction: Auction,
  rate: number,
  tenorMonths: number,
): PlaceRateResult {
  const status = getAuctionStatus(auction);
  if (status === "upcoming") return { success: false, error: "Auction belum dibuka." };
  if (status === "ended") return { success: false, error: "Auction sudah ditutup." };

  if (!Number.isInteger(tenorMonths) || tenorMonths <= 0) {
    return { success: false, error: "Tenor harus berupa bilangan bulat bulan." };
  }
  if (tenorMonths < auction.minTenorMonths || tenorMonths > auction.maxTenorMonths) {
    return {
      success: false,
      error: `Tenor harus antara ${auction.minTenorMonths} dan ${auction.maxTenorMonths} bulan.`,
    };
  }

  if (!Number.isFinite(rate) || rate <= 0) {
    return { success: false, error: "Masukkan rate yang valid." };
  }

  const current = getCurrentRate(auction);

  if (isCeilingReached(auction, current)) {
    return {
      success: false,
      error: `Rate sudah menyentuh batas atas ${auction.maxRate}% — tidak ada penawaran lebih tinggi yang mungkin.`,
    };
  }
  if (auction.maxRate !== null && rate > auction.maxRate) {
    return { success: false, error: `Rate tidak boleh melebihi ${auction.maxRate}%.` };
  }
  if (auction.minRate !== null && rate < auction.minRate) {
    return { success: false, error: `Rate minimal ${auction.minRate}%.` };
  }
  if (rate <= current) {
    return { success: false, error: `Rate harus lebih tinggi dari ${current}%.` };
  }
  if (Math.abs(roundRate(rate) - rate) > 1e-9) {
    return { success: false, error: `Rate harus kelipatan ${RATE_STEP}% (5 bps).` };
  }

  return { success: true };
}

export function AuctionProvider({ children }: { children: ReactNode }) {
  const [auctions, setAuctions] = useState<Auction[]>(() => loadAuctions());
  // Set while applying an update that arrived from another tab, so the persist
  // effect does not echo it straight back out.
  const applyingRemote = useRef(false);

  useEffect(() => {
    if (applyingRemote.current) {
      applyingRemote.current = false;
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(auctions));
    } catch {
      /* quota exceeded or private mode — keep the in-memory state usable */
    }
  }, [auctions]);

  // Another tab bid: reflect it here so the room is genuinely live.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const next = parseStored(event.newValue);
      if (!next) return;
      applyingRemote.current = true;
      setAuctions(next);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const createAuction = useCallback((input: NewAuctionInput) => {
    const newAuction: Auction = {
      id: crypto.randomUUID(),
      ...input,
      bids: [],
      createdAt: new Date().toISOString(),
    };
    setAuctions((prev) => [newAuction, ...prev]);
  }, []);

  const deleteAuction = useCallback((id: string) => {
    setAuctions((prev) => prev.filter((auction) => auction.id !== id));
  }, []);

  const placeRate = useCallback(
    ({ auctionId, bidderName, institution, rate, tenorMonths, simulated }: PlaceRateInput): PlaceRateResult => {
      // Validate against committed state first so the verdict never depends on
      // when React chooses to run the updater.
      const target = auctions.find((auction) => auction.id === auctionId);
      if (!target) return { success: false, error: "Auction tidak ditemukan." };

      const verdict = validateOffer(target, rate, tenorMonths);
      if (!verdict.success) return verdict;

      setAuctions((prev) =>
        prev.map((auction) => {
          if (auction.id !== auctionId) return auction;
          // Re-check against the freshest state: another tab may have outbid
          // us between render and commit.
          if (!validateOffer(auction, rate, tenorMonths).success) return auction;
          return {
            ...auction,
            bids: [
              ...auction.bids,
              {
                id: crypto.randomUUID(),
                bidderName,
                institution,
                rate,
                tenorMonths,
                ...(simulated ? { simulated: true } : {}),
                createdAt: new Date().toISOString(),
              },
            ],
          };
        }),
      );

      return { success: true };
    },
    [auctions],
  );

  const relistAuction = useCallback((id: string, durationSeconds = SPRINT_SECONDS) => {
    const startedAt = Date.now();
    setAuctions((prev) =>
      prev.map((auction) =>
        auction.id === id
          ? {
              ...auction,
              startTime: new Date(startedAt).toISOString(),
              endTime: new Date(startedAt + durationSeconds * 1000).toISOString(),
              bids: [],
            }
          : auction,
      ),
    );
  }, []);

  const setAuctionDeadline = useCallback((id: string, secondsFromNow: number) => {
    const now = Date.now();
    setAuctions((prev) =>
      prev.map((auction) => {
        if (auction.id !== id) return auction;
        // Pull the open time back too, so shortening an upcoming auction
        // actually starts it rather than leaving it un-openable.
        const startsAt = Math.min(new Date(auction.startTime).getTime(), now);
        return {
          ...auction,
          startTime: new Date(startsAt).toISOString(),
          endTime: new Date(now + secondsFromNow * 1000).toISOString(),
        };
      }),
    );
  }, []);

  const value = useMemo<AuctionContextValue>(
    () => ({
      auctions,
      createAuction,
      deleteAuction,
      placeRate,
      relistAuction,
      setAuctionDeadline,
    }),
    [auctions, createAuction, deleteAuction, placeRate, relistAuction, setAuctionDeadline],
  );

  return <AuctionContext.Provider value={value}>{children}</AuctionContext.Provider>;
}

export function useAuctions() {
  const ctx = useContext(AuctionContext);
  if (!ctx) throw new Error("useAuctions must be used within AuctionProvider");
  return ctx;
}
