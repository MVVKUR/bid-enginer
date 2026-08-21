/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

/**
 * Example response type for /api/demo
 */
export interface DemoResponse {
  message: string;
}

/** How the interest on a placement is paid out. */
export type PayoutMode = "maturity" | "monthly";

/**
 * A rate offer from one bank on a deposito placement.
 * The bank proposes both the annual interest rate and the tenor it wants;
 * the highest rate leads.
 */
export interface Bid {
  id: string;
  /** Person who submitted the offer. */
  bidderName: string;
  /** Bank the offer is made on behalf of. */
  institution: string;
  /** Annual interest rate offered, in percent (e.g. 6.25). */
  rate: number;
  /** Placement term the bank is offering, in months. */
  tenorMonths: number;
  /** True for offers produced by demo mode rather than a real bidder. */
  simulated?: boolean;
  createdAt: string;
}

/**
 * A deposito placement put out to auction. The placing institution fixes the
 * principal and the acceptable tenors; competing banks bid rate and tenor.
 */
export interface Auction {
  id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  /** Nominal amount placed, in IDR. */
  principal: number;
  /** Shortest term a bidder may offer, in months. */
  minTenorMonths: number;
  /** Longest term a bidder may offer, in months. */
  maxTenorMonths: number;
  payout: PayoutMode;
  /** Opening rate the auction starts from, in percent p.a. */
  startingRate: number;
  /** Lowest rate an offer may carry. Null means no floor. */
  minRate: number | null;
  /** Highest rate an offer may carry. Null means no ceiling. */
  maxRate: number | null;
  bids: Bid[];
  createdAt: string;
}

export type AuctionStatus = "upcoming" | "live" | "ended";
