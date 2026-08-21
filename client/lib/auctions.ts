import { Auction, AuctionStatus, Bid } from "@shared/api";
import { formatTenor } from "./currency";

export * from "./currency";

export function getAuctionStatus(auction: Auction, now = Date.now()): AuctionStatus {
  const start = new Date(auction.startTime).getTime();
  const end = new Date(auction.endTime).getTime();
  if (now < start) return "upcoming";
  if (now >= end) return "ended";
  return "live";
}

/** The best rate on the table right now. Highest offer wins a deposito auction. */
export function getCurrentRate(auction: Auction): number {
  if (auction.bids.length === 0) return auction.startingRate;
  return auction.bids.reduce((best, bid) => Math.max(best, bid.rate), auction.startingRate);
}

/** The offer currently leading, or null when nobody has bid. */
export function getLeadingBid(auction: Auction): Bid | null {
  if (auction.bids.length === 0) return null;
  return auction.bids.reduce((best, bid) => (bid.rate > best.rate ? bid : best));
}

/** Distinct banks competing on this placement. */
export function getParticipantCount(auction: Auction): number {
  return new Set(auction.bids.map((bid) => bid.institution)).size;
}

/**
 * The winning offer, or null while the auction is still open. Settlement is
 * simply the highest rate once the clock runs out.
 */
export function getWinner(auction: Auction, now = Date.now()): Bid | null {
  if (getAuctionStatus(auction, now) !== "ended") return null;
  return getLeadingBid(auction);
}

export function getDefaultTenor(auction: Auction): number {
  return auction.minTenorMonths;
}

export function formatTenorWindow(auction: Auction): string {
  if (auction.minTenorMonths === auction.maxTenorMonths) {
    return formatTenor(auction.minTenorMonths);
  }
  return `${auction.minTenorMonths}\u2013${auction.maxTenorMonths} bulan`;
}

/** Spreadsheet-style column label: A, B, ... Z, AA, AB. */
function participantLetter(index: number): string {
  let label = "";
  let n = index + 1;
  while (n > 0) {
    const remainder = (n - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

/**
 * Bidders compete blind: each bank is shown to the others only as
 * "Peserta A", "Peserta B", ... Labels are assigned by the order a bank first
 * bid, so they stay stable for the whole auction. The organiser's admin view
 * deliberately still shows real names.
 */
export function getAnonymousLabels(auction: Auction): Map<string, string> {
  const order: string[] = [];
  [...auction.bids]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .forEach((bid) => {
      if (!order.includes(bid.institution)) order.push(bid.institution);
    });
  return new Map(order.map((institution, index) => [institution, `Peserta ${participantLetter(index)}`]));
}

export interface BidderStanding {
  /** This bank has at least one offer on the table. */
  hasBid: boolean;
  /** The bank's own highest offer. */
  yourBest: Bid | null;
  /** The offer currently winning, from any bank. */
  leading: Bid | null;
  isLeading: boolean;
  /** Has bid, but somebody else is ahead — the cue to raise. */
  isOutbid: boolean;
  /** How far behind the leader, in basis points. Zero when leading. */
  behindBps: number;
}

/**
 * Where a given bank stands in an auction. Drives the "you are being outbid"
 * prompt that lets a bidder raise without hunting through the feed.
 */
export function getBidderStanding(
  auction: Auction,
  institution: string | undefined,
): BidderStanding {
  const leading = getLeadingBid(auction);
  const empty: BidderStanding = {
    hasBid: false,
    yourBest: null,
    leading,
    isLeading: false,
    isOutbid: false,
    behindBps: 0,
  };
  if (!institution) return empty;

  const own = auction.bids.filter((bid) => bid.institution === institution);
  if (own.length === 0) return empty;

  const yourBest = own.reduce((best, bid) => (bid.rate > best.rate ? bid : best));
  const currentRate = getCurrentRate(auction);
  const isLeading = yourBest.rate >= currentRate;

  return {
    hasBid: true,
    yourBest,
    leading,
    isLeading,
    isOutbid: !isLeading,
    behindBps: isLeading ? 0 : Math.round((currentRate - yourBest.rate) * 100),
  };
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Compact "2 menit lalu" style stamp for the live feed. */
export function formatRelativeTime(iso: string, now = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  if (!Number.isFinite(diff)) return "—";
  const seconds = Math.floor(Math.max(diff, 0) / 1000);
  if (seconds < 10) return "baru saja";
  if (seconds < 60) return `${seconds} dtk lalu`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} mnt lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hr lalu`;
}

export function getTimeRemaining(targetIso: string, now = Date.now()) {
  const diff = new Date(targetIso).getTime() - now;
  const clamped = Math.max(diff, 0);
  const totalSeconds = Math.floor(clamped / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { diff, days, hours, minutes, seconds };
}

export function formatCountdown(targetIso: string, now = Date.now()): string {
  const { diff, days, hours, minutes, seconds } = getTimeRemaining(targetIso, now);
  if (diff <= 0) return "00:00:00";
  if (days > 0) return `${days}h ${hours}j ${minutes}m`;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
