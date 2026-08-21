import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { Auction } from "@shared/api";
import { getCurrentPrice } from "@/lib/auctions";

const STORAGE_KEY = "bidora:auctions";

function seedAuctions(): Auction[] {
  const now = Date.now();
  const hour = 1000 * 60 * 60;
  return [
    {
      id: crypto.randomUUID(),
      title: "Vintage Leica M6 Camera",
      description:
        "Mint-condition 35mm rangefinder camera with original leather case and lens hood.",
      startTime: new Date(now - hour * 2).toISOString(),
      endTime: new Date(now + hour * 5).toISOString(),
      startingPrice: 800,
      minPrice: 800,
      maxPrice: 3000,
      bids: [
        {
          id: crypto.randomUUID(),
          bidderName: "Amara N.",
          amount: 950,
          createdAt: new Date(now - hour).toISOString(),
        },
        {
          id: crypto.randomUUID(),
          bidderName: "Devon K.",
          amount: 1100,
          createdAt: new Date(now - hour * 0.5).toISOString(),
        },
      ],
      createdAt: new Date(now - hour * 3).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      title: "Original Abstract Oil Painting",
      description:
        "One-of-a-kind 24x36in canvas piece, signed by the artist. No reserve limit — highest bid wins.",
      startTime: new Date(now - hour).toISOString(),
      endTime: new Date(now + hour * 24).toISOString(),
      startingPrice: 200,
      minPrice: null,
      maxPrice: null,
      bids: [
        {
          id: crypto.randomUUID(),
          bidderName: "Priya S.",
          amount: 260,
          createdAt: new Date(now - hour * 0.2).toISOString(),
        },
      ],
      createdAt: new Date(now - hour * 4).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      title: "Limited Edition Sneaker Drop",
      description:
        "Deadstock pair, size US 10. Auction opens soon — set a reminder so you don't miss it.",
      startTime: new Date(now + hour * 6).toISOString(),
      endTime: new Date(now + hour * 30).toISOString(),
      startingPrice: 150,
      minPrice: 150,
      maxPrice: 600,
      bids: [],
      createdAt: new Date(now - hour * 5).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      title: "Antique Oak Writing Desk",
      description:
        "19th-century solid oak desk, recently restored. Auction has closed — see the winning bid.",
      startTime: new Date(now - hour * 30).toISOString(),
      endTime: new Date(now - hour * 2).toISOString(),
      startingPrice: 300,
      minPrice: 300,
      maxPrice: null,
      bids: [
        {
          id: crypto.randomUUID(),
          bidderName: "Marcus T.",
          amount: 420,
          createdAt: new Date(now - hour * 10).toISOString(),
        },
        {
          id: crypto.randomUUID(),
          bidderName: "Lena W.",
          amount: 510,
          createdAt: new Date(now - hour * 3).toISOString(),
        },
      ],
      createdAt: new Date(now - hour * 40).toISOString(),
    },
  ];
}

function loadAuctions(): Auction[] {
  if (typeof window === "undefined") return seedAuctions();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedAuctions();
    const parsed = JSON.parse(raw) as Auction[];
    if (!Array.isArray(parsed) || parsed.length === 0) return seedAuctions();
    return parsed;
  } catch {
    return seedAuctions();
  }
}

export interface NewAuctionInput {
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  startingPrice: number;
  minPrice: number | null;
  maxPrice: number | null;
}

export interface PlaceBidResult {
  success: boolean;
  error?: string;
}

interface AuctionContextValue {
  auctions: Auction[];
  createAuction: (input: NewAuctionInput) => void;
  deleteAuction: (id: string) => void;
  placeBid: (auctionId: string, bidderName: string, amount: number) => PlaceBidResult;
}

const AuctionContext = createContext<AuctionContextValue | null>(null);

export function AuctionProvider({ children }: { children: ReactNode }) {
  const [auctions, setAuctions] = useState<Auction[]>(() => loadAuctions());

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(auctions));
  }, [auctions]);

  const value = useMemo<AuctionContextValue>(
    () => ({
      auctions,
      createAuction: (input) => {
        const newAuction: Auction = {
          id: crypto.randomUUID(),
          title: input.title,
          description: input.description,
          startTime: input.startTime,
          endTime: input.endTime,
          startingPrice: input.startingPrice,
          minPrice: input.minPrice,
          maxPrice: input.maxPrice,
          bids: [],
          createdAt: new Date().toISOString(),
        };
        setAuctions((prev) => [newAuction, ...prev]);
      },
      deleteAuction: (id) => {
        setAuctions((prev) => prev.filter((a) => a.id !== id));
      },
      placeBid: (auctionId, bidderName, amount) => {
        let result: PlaceBidResult = { success: false, error: "Auction not found" };
        setAuctions((prev) =>
          prev.map((auction) => {
            if (auction.id !== auctionId) return auction;

            const current = getCurrentPrice(auction);
            if (amount <= current) {
              result = { success: false, error: `Bid must be higher than ${current}` };
              return auction;
            }
            if (auction.minPrice !== null && amount < auction.minPrice) {
              result = { success: false, error: `Bid must be at least ${auction.minPrice}` };
              return auction;
            }
            if (auction.maxPrice !== null && amount > auction.maxPrice) {
              result = { success: false, error: `Bid cannot exceed ${auction.maxPrice}` };
              return auction;
            }

            result = { success: true };
            return {
              ...auction,
              bids: [
                ...auction.bids,
                {
                  id: crypto.randomUUID(),
                  bidderName,
                  amount,
                  createdAt: new Date().toISOString(),
                },
              ],
            };
          }),
        );
        return result;
      },
    }),
    [auctions],
  );

  return <AuctionContext.Provider value={value}>{children}</AuctionContext.Provider>;
}

export function useAuctions() {
  const ctx = useContext(AuctionContext);
  if (!ctx) throw new Error("useAuctions must be used within AuctionProvider");
  return ctx;
}
