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

export interface Bid {
  id: string;
  bidderName: string;
  amount: number;
  createdAt: string;
}

export interface Auction {
  id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  startingPrice: number;
  /** Lower bound a bid must meet or exceed. Null means no floor. */
  minPrice: number | null;
  /** Upper bound a bid cannot exceed. Null means no ceiling. */
  maxPrice: number | null;
  bids: Bid[];
  createdAt: string;
}

export type AuctionStatus = "upcoming" | "live" | "ended";
