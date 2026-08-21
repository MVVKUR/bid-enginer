import { Auction, AuctionStatus } from "@shared/api";

export function getAuctionStatus(auction: Auction, now = Date.now()): AuctionStatus {
  const start = new Date(auction.startTime).getTime();
  const end = new Date(auction.endTime).getTime();
  if (now < start) return "upcoming";
  if (now > end) return "ended";
  return "live";
}

export function getCurrentPrice(auction: Auction): number {
  if (auction.bids.length === 0) return auction.startingPrice;
  return auction.bids.reduce((max, bid) => Math.max(max, bid.amount), auction.startingPrice);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatRange(min: number | null, max: number | null): string {
  if (min === null && max === null) return "No limit";
  if (min !== null && max !== null) return `${formatCurrency(min)} – ${formatCurrency(max)}`;
  if (min !== null) return `From ${formatCurrency(min)}`;
  return `Up to ${formatCurrency(max as number)}`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
