import { describe, it, expect } from "vitest";
import { Auction, Bid } from "@shared/api";
import {
  formatTenorWindow,
  getAnonymousLabels,
  getAuctionStatus,
  getBidderStanding,
  getCurrentRate,
  getDefaultTenor,
  getLeadingBid,
  getParticipantCount,
  getWinner,
} from "./auctions";
import { isValidAuction, validateOffer } from "@/context/AuctionContext";
import {
  nextSimulatedOffer,
  getDemoCeiling,
  isDemoExhausted,
  isDemoRoom,
  DEMO_RATE_BAND,
} from "./demo-bidders";
import {
  getMinimumNextRate,
  getRateOffers,
  isCeilingReached,
  projectInterest,
  roundRate,
  formatRateShort,
  formatTenor,
} from "./currency";

const HOUR = 1000 * 60 * 60;

function bid(institution: string, rate: number, overrides: Partial<Bid> = {}): Bid {
  return {
    id: `${institution}-${rate}`,
    bidderName: `${institution} desk`,
    institution,
    rate,
    tenorMonths: 3,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function auction(overrides: Partial<Auction> = {}): Auction {
  const now = Date.now();
  return {
    id: "a1",
    title: "Deposito Berjangka",
    description: "",
    startTime: new Date(now - HOUR).toISOString(),
    endTime: new Date(now + HOUR).toISOString(),
    principal: 5_000_000_000,
    minTenorMonths: 1,
    maxTenorMonths: 6,
    payout: "maturity",
    startingRate: 6.0,
    minRate: 6.0,
    maxRate: 7.5,
    bids: [],
    createdAt: new Date(now - HOUR * 2).toISOString(),
    ...overrides,
  };
}

describe("getAuctionStatus", () => {
  const now = Date.now();
  const base = auction({
    startTime: new Date(now).toISOString(),
    endTime: new Date(now + HOUR).toISOString(),
  });

  it("is upcoming before the start", () => {
    expect(getAuctionStatus(base, now - 1)).toBe("upcoming");
  });

  it("is live at the exact start instant", () => {
    expect(getAuctionStatus(base, now)).toBe("live");
  });

  it("is ended at the exact end instant, so no bid lands on a closed lot", () => {
    expect(getAuctionStatus(base, now + HOUR)).toBe("ended");
  });
});

describe("getCurrentRate", () => {
  it("falls back to the opening rate with no bids", () => {
    expect(getCurrentRate(auction())).toBe(6.0);
  });

  it("takes the highest offer, not the most recent one", () => {
    const withBids = auction({ bids: [bid("Bank A", 6.5), bid("Bank B", 6.25)] });
    expect(getCurrentRate(withBids)).toBe(6.5);
  });

  it("never drops below the opening rate", () => {
    const withLowBid = auction({ bids: [bid("Bank A", 5.0)] });
    expect(getCurrentRate(withLowBid)).toBe(6.0);
  });
});

describe("getLeadingBid / getParticipantCount", () => {
  it("returns null when nobody has bid", () => {
    expect(getLeadingBid(auction())).toBeNull();
  });

  it("identifies the top offer", () => {
    const withBids = auction({ bids: [bid("Bank A", 6.25), bid("Bank B", 6.75)] });
    expect(getLeadingBid(withBids)?.institution).toBe("Bank B");
  });

  it("counts distinct banks, not raw bids", () => {
    const withBids = auction({
      bids: [bid("Bank A", 6.25), bid("Bank A", 6.5), bid("Bank B", 6.75)],
    });
    expect(withBids.bids).toHaveLength(3);
    expect(getParticipantCount(withBids)).toBe(2);
  });
});

describe("getBidderStanding — the outbid prompt", () => {
  it("reports nothing for a bank that has not bid", () => {
    const standing = getBidderStanding(auction({ bids: [bid("Bank A", 6.5)] }), "Bank Z");
    expect(standing.hasBid).toBe(false);
    expect(standing.isOutbid).toBe(false);
  });

  it("reports leading when the bank holds the top rate", () => {
    const withBids = auction({ bids: [bid("Bank A", 6.25), bid("Bank Z", 6.75)] });
    const standing = getBidderStanding(withBids, "Bank Z");
    expect(standing.isLeading).toBe(true);
    expect(standing.isOutbid).toBe(false);
    expect(standing.behindBps).toBe(0);
  });

  it("reports the gap in basis points when outbid", () => {
    const withBids = auction({ bids: [bid("Bank Z", 6.25), bid("Bank A", 6.75)] });
    const standing = getBidderStanding(withBids, "Bank Z");
    expect(standing.isOutbid).toBe(true);
    expect(standing.behindBps).toBe(50);
    expect(standing.yourBest?.rate).toBe(6.25);
    expect(standing.leading?.institution).toBe("Bank A");
  });

  it("measures the gap from the bank's own best offer, not its latest", () => {
    const withBids = auction({
      bids: [bid("Bank Z", 6.6), bid("Bank Z", 6.3), bid("Bank A", 6.75)],
    });
    expect(getBidderStanding(withBids, "Bank Z").behindBps).toBe(15);
  });

  it("treats an unauthenticated viewer as having no standing", () => {
    expect(getBidderStanding(auction({ bids: [bid("Bank A", 6.5)] }), undefined).hasBid).toBe(
      false,
    );
  });
});

describe("ceiling handling", () => {
  it("flags a lot whose top rate has reached the ceiling", () => {
    const capped = auction({ maxRate: 6.5, bids: [bid("Bank A", 6.5)] });
    expect(isCeilingReached(capped, getCurrentRate(capped))).toBe(true);
  });

  it("offers no quick rates once the ceiling is reached, instead of unfillable ones", () => {
    const capped = auction({ maxRate: 6.5, bids: [bid("Bank A", 6.5)] });
    expect(getRateOffers(capped, getCurrentRate(capped))).toEqual([]);
  });

  it("never proposes a rate above the ceiling", () => {
    const capped = auction({ maxRate: 6.3 });
    const offers = getRateOffers(capped, 6.0);
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.every((offer) => offer.rate <= 6.3)).toBe(true);
  });

  it("offers the ceiling itself as the final option when still reachable", () => {
    const capped = auction({ maxRate: 7.5 });
    const offers = getRateOffers(capped, 6.0);
    expect(offers[offers.length - 1]).toMatchObject({ kind: "ceiling", rate: 7.5 });
  });

  it("has no ceiling to reach when maxRate is null", () => {
    const open = auction({ maxRate: null, bids: [bid("Bank A", 99) ] });
    expect(isCeilingReached(open, getCurrentRate(open))).toBe(false);
  });
});

describe("getMinimumNextRate", () => {
  it("steps 5 bps above the current rate", () => {
    expect(getMinimumNextRate(auction(), 6.0)).toBeCloseTo(6.05, 10);
  });

  it("respects a floor that sits above the next step", () => {
    expect(getMinimumNextRate(auction({ minRate: 6.5 }), 6.0)).toBeCloseTo(6.5, 10);
  });

  it("stays free of floating-point drift across repeated steps", () => {
    let rate = 6.0;
    for (let i = 0; i < 20; i++) rate = getMinimumNextRate(auction({ minRate: null }), rate);
    expect(rate).toBeCloseTo(7.0, 10);
    expect(formatRateShort(rate)).toBe("7,00%");
  });

  it("produces quick offers that all clear the minimum", () => {
    const lot = auction({ minRate: 6.4 });
    const minimum = getMinimumNextRate(lot, 6.0);
    expect(getRateOffers(lot, 6.0).every((offer) => offer.rate >= minimum)).toBe(true);
  });
});

describe("projectInterest", () => {
  it("computes gross interest over the tenor", () => {
    // Rp 5 M at 6% for 12 months
    expect(projectInterest(5_000_000_000, 6, 12)).toBe(300_000_000);
  });

  it("prorates a partial year", () => {
    expect(projectInterest(5_000_000_000, 6, 6)).toBe(150_000_000);
  });

  it("returns zero rather than NaN for unusable input", () => {
    expect(projectInterest(Number.NaN, 6, 12)).toBe(0);
  });
});

describe("formatTenor", () => {
  it("uses months below a year", () => {
    expect(formatTenor(6)).toBe("6 bulan");
  });

  it("switches to years on whole-year tenors", () => {
    expect(formatTenor(12)).toBe("1 tahun");
    expect(formatTenor(24)).toBe("2 tahun");
  });
});

describe("anonymity in the bidder-facing feed", () => {
  it("labels banks by the order they first bid, not alphabetically", () => {
    const t0 = Date.now();
    const withBids = auction({
      bids: [
        bid("Bank Zulu", 6.1, { createdAt: new Date(t0 - 3000).toISOString() }),
        bid("Bank Alfa", 6.2, { createdAt: new Date(t0 - 2000).toISOString() }),
      ],
    });
    const labels = getAnonymousLabels(withBids);
    expect(labels.get("Bank Zulu")).toBe("Peserta A");
    expect(labels.get("Bank Alfa")).toBe("Peserta B");
  });

  it("keeps one label per bank across repeated bids", () => {
    const t0 = Date.now();
    const withBids = auction({
      bids: [
        bid("Bank Alfa", 6.1, { id: "1", createdAt: new Date(t0 - 3000).toISOString() }),
        bid("Bank Beta", 6.2, { id: "2", createdAt: new Date(t0 - 2000).toISOString() }),
        bid("Bank Alfa", 6.3, { id: "3", createdAt: new Date(t0 - 1000).toISOString() }),
      ],
    });
    const labels = getAnonymousLabels(withBids);
    expect(labels.size).toBe(2);
    expect(labels.get("Bank Alfa")).toBe("Peserta A");
  });

  it("never leaks a real bank name through the label map", () => {
    const withBids = auction({ bids: [bid("Bank Mandiri", 6.5)] });
    const labels = [...getAnonymousLabels(withBids).values()];
    expect(labels.every((label) => !label.includes("Mandiri"))).toBe(true);
  });

  it("rolls past Z for very large fields", () => {
    const t0 = Date.now();
    const many = Array.from({ length: 27 }, (_, i) =>
      bid(`Bank ${i}`, 6 + i * 0.05, {
        id: `b${i}`,
        createdAt: new Date(t0 + i * 1000).toISOString(),
      }),
    );
    const labels = getAnonymousLabels(auction({ bids: many }));
    expect(labels.get("Bank 25")).toBe("Peserta Z");
    expect(labels.get("Bank 26")).toBe("Peserta AA");
  });
});

describe("free-text tenor window", () => {
  it("defaults a bidder to the shortest allowed tenor", () => {
    expect(getDefaultTenor(auction({ minTenorMonths: 3, maxTenorMonths: 12 }))).toBe(3);
  });

  it("renders a range when min and max differ", () => {
    expect(formatTenorWindow(auction({ minTenorMonths: 1, maxTenorMonths: 6 }))).toBe(
      "1\u20136 bulan",
    );
  });

  it("renders a single tenor when the window is fixed", () => {
    expect(formatTenorWindow(auction({ minTenorMonths: 12, maxTenorMonths: 12 }))).toBe(
      "1 tahun",
    );
  });
});

describe("isValidAuction — rejecting stale persisted shapes", () => {
  it("accepts an auction in the current shape", () => {
    expect(isValidAuction(auction())).toBe(true);
  });

  it("rejects the older shape that used a tenorOptions list", () => {
    // This exact payload rendered as "undefined bulan" before the guard existed.
    const stale = { ...auction(), tenorOptions: [1, 3, 6] } as Record<string, unknown>;
    delete stale.minTenorMonths;
    delete stale.maxTenorMonths;
    expect(isValidAuction(stale)).toBe(false);
  });

  it("rejects a non-integer tenor window rather than producing NaN downstream", () => {
    expect(isValidAuction({ ...auction(), minTenorMonths: 1.5 })).toBe(false);
  });

  it("rejects junk without throwing", () => {
    expect(isValidAuction(null)).toBe(false);
    expect(isValidAuction("nope")).toBe(false);
    expect(isValidAuction({})).toBe(false);
  });
})

describe("nextSimulatedOffer — demo mode rules", () => {
  it("produces an offer that the real validator accepts", () => {
    const lot = auction();
    for (let i = 0; i < 50; i++) {
      const offer = nextSimulatedOffer(lot, "Bank Nusantara");
      expect(offer).not.toBeNull();
      expect(validateOffer(lot, offer!.rate, offer!.tenorMonths).success).toBe(true);
    }
  });

  it("never bids as the signed-in bank", () => {
    const lot = auction();
    for (let i = 0; i < 50; i++) {
      expect(nextSimulatedOffer(lot, "Bank Mandiri")?.institution).not.toBe("Bank Mandiri");
    }
  });

  it("stays inside the auction's tenor window", () => {
    const lot = auction({ minTenorMonths: 3, maxTenorMonths: 6 });
    for (let i = 0; i < 50; i++) {
      const tenor = nextSimulatedOffer(lot)!.tenorMonths;
      expect(tenor).toBeGreaterThanOrEqual(3);
      expect(tenor).toBeLessThanOrEqual(6);
      expect(Number.isInteger(tenor)).toBe(true);
    }
  });

  it("never exceeds the ceiling, and lands on it at most", () => {
    const lot = auction({ maxRate: 6.1 });
    for (let i = 0; i < 50; i++) {
      const offer = nextSimulatedOffer(lot);
      if (offer) expect(offer.rate).toBeLessThanOrEqual(6.1);
    }
  });

  it("stops once the ceiling is reached", () => {
    const capped = auction({ maxRate: 6.5, bids: [bid("Bank BNI", 6.5)] });
    expect(nextSimulatedOffer(capped)).toBeNull();
  });

  it("does not bid on an auction that is not live", () => {
    const now = Date.now();
    const ended = auction({
      startTime: new Date(now - HOUR * 3).toISOString(),
      endTime: new Date(now - HOUR).toISOString(),
    });
    const upcoming = auction({
      startTime: new Date(now + HOUR).toISOString(),
      endTime: new Date(now + HOUR * 3).toISOString(),
    });
    expect(nextSimulatedOffer(ended, undefined, now)).toBeNull();
    expect(nextSimulatedOffer(upcoming, undefined, now)).toBeNull();
  });

  it("keeps bidding well past the old fixed quota so the room stays alive", () => {
    const busy = auction({
      maxRate: null,
      bids: Array.from({ length: 20 }, (_, i) =>
        bid(`Bank ${i}`, 6 + i * 0.05, { id: `s${i}`, simulated: true }),
      ),
    });
    expect(nextSimulatedOffer(busy)).not.toBeNull();
  });

  it("stops once the demo band is exhausted, so rates stay believable", () => {
    const lot = auction({ maxRate: null, startingRate: 6 });
    const atBand = auction({
      maxRate: null,
      startingRate: 6,
      bids: [bid("Bank A", 6 + DEMO_RATE_BAND)],
    });
    expect(getDemoCeiling(lot)).toBe(9);
    expect(isDemoExhausted(atBand)).toBe(true);
    expect(nextSimulatedOffer(atBand)).toBeNull();
  });

  it("uses the auction ceiling when it binds tighter than the demo band", () => {
    expect(getDemoCeiling(auction({ startingRate: 6, maxRate: 6.5 }))).toBe(6.5);
  });

  it("always moves the rate by at least one step", () => {
    const lot = auction({ maxRate: null, bids: [bid("Bank BNI", 6.4)] });
    for (let i = 0; i < 50; i++) {
      expect(nextSimulatedOffer(lot)!.rate).toBeGreaterThanOrEqual(6.45 - 1e-9);
    }
  });
})

describe("roundRate — float drift at the ceiling", () => {
  it("lands exactly on a ceiling instead of a hair above it", () => {
    // 122 * 0.05 === 6.100000000000001 without the corrective rounding.
    expect(roundRate(6.1)).toBe(6.1);
    expect(roundRate(6.1) <= 6.1).toBe(true);
  });

  it("keeps a ceiling bid acceptable to the validator", () => {
    const capped = auction({ maxRate: 6.1, minRate: null });
    expect(validateOffer(capped, roundRate(6.1), 3).success).toBe(true);
  });

  it("snaps to the nearest 5 bps", () => {
    expect(roundRate(6.13)).toBe(6.15);
    expect(roundRate(6.11)).toBe(6.1);
  });
})

describe("getWinner — settlement", () => {
  const now = Date.now();
  const settled = (bids: Bid[]) =>
    auction({
      bids,
      startTime: new Date(now - HOUR * 2).toISOString(),
      endTime: new Date(now - HOUR).toISOString(),
    });

  it("has no winner while the auction is still live", () => {
    expect(getWinner(auction({ bids: [bid("Bank A", 6.5)] }), now)).toBeNull();
  });

  it("has no winner before the auction opens", () => {
    const upcoming = auction({
      startTime: new Date(now + HOUR).toISOString(),
      endTime: new Date(now + HOUR * 2).toISOString(),
      bids: [bid("Bank A", 6.5)],
    });
    expect(getWinner(upcoming, now)).toBeNull();
  });

  it("awards the highest rate once closed, not the last bid placed", () => {
    const winner = getWinner(
      settled([
        bid("Bank A", 6.9, { id: "1", createdAt: new Date(now - HOUR * 1.5).toISOString() }),
        bid("Bank B", 6.6, { id: "2", createdAt: new Date(now - HOUR * 1.1).toISOString() }),
      ]),
      now,
    );
    expect(winner?.institution).toBe("Bank A");
    expect(winner?.rate).toBe(6.9);
  });

  it("returns null when a closed auction drew no bids", () => {
    expect(getWinner(settled([]), now)).toBeNull();
  });

  it("keeps the winner anonymous to other bidders", () => {
    const lot = settled([bid("Bank Mandiri", 6.9)]);
    const winner = getWinner(lot, now)!;
    expect(getAnonymousLabels(lot).get(winner.institution)).toBe("Peserta A");
  });
})

describe("demo deadline control", () => {
  it("shortening an upcoming auction also opens it, not just moves the close", () => {
    // Mirrors setAuctionDeadline: the open time is pulled back to now so a
    // shortened upcoming auction is actually biddable.
    const now = Date.now();
    const upcoming = auction({
      startTime: new Date(now + HOUR).toISOString(),
      endTime: new Date(now + HOUR * 2).toISOString(),
    });
    expect(getAuctionStatus(upcoming, now)).toBe("upcoming");

    const shortened = {
      ...upcoming,
      startTime: new Date(Math.min(new Date(upcoming.startTime).getTime(), now)).toISOString(),
      endTime: new Date(now + 30_000).toISOString(),
    };
    expect(getAuctionStatus(shortened, now)).toBe("live");
    expect(getAuctionStatus(shortened, now + 31_000)).toBe("ended");
  });

  it("leaves an already-open auction's start time alone", () => {
    const now = Date.now();
    const live = auction({
      startTime: new Date(now - HOUR).toISOString(),
      endTime: new Date(now + HOUR).toISOString(),
    });
    const startsAt = Math.min(new Date(live.startTime).getTime(), now);
    expect(startsAt).toBe(new Date(live.startTime).getTime());
  });
})

describe("isDemoRoom — auto-restart eligibility", () => {
  it("reopens a room whose stored bids are simulated, even after a reload", () => {
    // The reload case: the session set is empty, but the data remembers.
    const room = auction({ bids: [bid("Bank BNI", 6.5, { simulated: true })] });
    expect(isDemoRoom(room, new Set())).toBe(true);
  });

  it("reopens a room this session bid in before any bid landed", () => {
    const fresh = auction({ id: "fresh", bids: [] });
    expect(isDemoRoom(fresh, new Set(["fresh"]))).toBe(true);
  });

  it("never resurrects an auction the demo never touched", () => {
    const real = auction({ bids: [bid("Bank BNI", 6.5)] });
    expect(isDemoRoom(real, new Set())).toBe(false);
  });

  it("leaves an untouched empty auction alone", () => {
    expect(isDemoRoom(auction({ bids: [] }), new Set())).toBe(false);
  });

  it("restarts a room stuck at its ceiling — the case that hung", () => {
    const stuck = auction({
      minRate: 6,
      maxRate: 7.5,
      startingRate: 6,
      bids: [bid("Bank BNI", 7.5, { simulated: true })],
    });
    expect(isDemoExhausted(stuck)).toBe(true);
    expect(isDemoRoom(stuck, new Set())).toBe(true);
  });
})
