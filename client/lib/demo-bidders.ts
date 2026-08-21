import { Auction } from "@shared/api";
import { getAuctionStatus, getCurrentRate } from "./auctions";
import { getMinimumNextRate, isCeilingReached, RATE_STEP, roundRate } from "./currency";

/**
 * Synthetic counterparties for demo mode.
 *
 * Every offer these produce is flagged `simulated: true` in the stored data and
 * surfaced in the UI as demo activity — nothing here is presented as a real bid.
 */
export const DEMO_BANKS: { institution: string; person: string }[] = [
  { institution: "Bank Mandiri", person: "Amara Nasution" },
  { institution: "Bank BNI", person: "Devon Kusuma" },
  { institution: "Bank BCA", person: "Priya Salim" },
  { institution: "Bank BRI", person: "Marcus Tanuwijaya" },
  { institution: "Bank Danamon", person: "Lena Wijaya" },
  { institution: "Bank Permata", person: "Sinta Halim" },
  { institution: "Bank CIMB Niaga", person: "Rangga Wibowo" },
  { institution: "Bank OCBC", person: "Maya Kurniawan" },
];

/**
 * How far above the opening rate demo bidding will push, in percentage points.
 * Without a band the simulation would climb forever on an auction that has no
 * ceiling of its own; with it, a room stays believable while still alive.
 */
export const DEMO_RATE_BAND = 3;

/**
 * The highest rate demo bidding will reach: the auction's own ceiling, or the
 * demo band, whichever binds first.
 */
export function getDemoCeiling(auction: Auction): number {
  const band = auction.startingRate + DEMO_RATE_BAND;
  return auction.maxRate === null ? band : Math.min(auction.maxRate, band);
}

/** True when demo bidding has taken this auction as far as it will go. */
export function isDemoExhausted(auction: Auction, now = Date.now()): boolean {
  if (getAuctionStatus(auction, now) !== "live") return true;
  return getCurrentRate(auction) >= getDemoCeiling(auction);
}

/**
 * Whether auto-restart may reopen this room.
 *
 * The persisted `simulated` flag is the durable half: a session-only record of
 * which rooms this tab bid in resets on reload, which would strand an already
 * exhausted room as permanently dead.
 */
export function isDemoRoom(auction: Auction, touchedThisSession: Set<string>): boolean {
  return (
    touchedThisSession.has(auction.id) || auction.bids.some((bid) => bid.simulated)
  );
}

/** Rate jumps, weighted toward small moves so the ladder climbs believably. */
const STEP_CHOICES = [0.05, 0.05, 0.05, 0.1, 0.1, 0.15, 0.25];

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export interface SimulatedOffer {
  institution: string;
  bidderName: string;
  rate: number;
  tenorMonths: number;
}

/**
 * Proposes the next synthetic offer for an auction, or null when one would be
 * inappropriate — auction not live, ceiling reached, or the demo quota spent.
 * `excludeInstitution` keeps the simulation from bidding as the signed-in bank.
 */
export function nextSimulatedOffer(
  auction: Auction,
  excludeInstitution?: string,
  now = Date.now(),
): SimulatedOffer | null {
  if (getAuctionStatus(auction, now) !== "live") return null;

  const current = getCurrentRate(auction);
  if (isCeilingReached(auction, current)) return null;

  // Bidding continues for as long as the room is live and the band allows, so
  // participants keep visibly competing rather than going quiet after N bids.
  const demoCeiling = getDemoCeiling(auction);
  if (current >= demoCeiling) return null;

  const candidates = DEMO_BANKS.filter(
    (bank) => bank.institution !== excludeInstitution,
  );
  if (candidates.length === 0) return null;
  const bank = pick(candidates);

  const floor = getMinimumNextRate(auction, current);
  const proposed = roundRate(Math.max(current + pick(STEP_CHOICES), floor));

  // Respect whichever ceiling binds; land exactly on it rather than overshoot.
  const rate = Math.min(proposed, demoCeiling);
  if (rate < floor) return null;
  // A move smaller than one step is not a real move.
  if (rate - current < RATE_STEP - 1e-9) return null;

  return {
    institution: bank.institution,
    bidderName: bank.person,
    rate: roundRate(rate),
    tenorMonths: randomInt(auction.minTenorMonths, auction.maxTenorMonths),
  };
}
