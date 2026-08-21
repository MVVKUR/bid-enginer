import { Auction } from "@shared/api";

/**
 * Money in this app is Indonesian Rupiah (IDR); rates are annual percentages.
 * Rupiah has no practical minor unit, so every amount is a whole number.
 */

const IDR = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const IDR_COMPACT = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  notation: "compact",
  maximumFractionDigits: 1,
});

const RATE = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return IDR.format(Math.round(value));
}

/** Short form for chart axes and tight spaces, e.g. "Rp 5 M". */
export function formatCurrencyCompact(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return IDR_COMPACT.format(Math.round(value));
}

/** e.g. 6.25 -> "6,25% p.a." */
export function formatRate(rate: number): string {
  if (!Number.isFinite(rate)) return "—";
  return `${RATE.format(rate)}% p.a.`;
}

/** Bare percentage without the p.a. suffix, for dense tables and axes. */
export function formatRateShort(rate: number): string {
  if (!Number.isFinite(rate)) return "—";
  return `${RATE.format(rate)}%`;
}

export function formatRateRange(min: number | null, max: number | null): string {
  if (min === null && max === null) return "Tanpa batas";
  if (min !== null && max !== null)
    return `${formatRateShort(min)} – ${formatRateShort(max)}`;
  if (min !== null) return `Min ${formatRateShort(min)}`;
  return `Maks ${formatRateShort(max as number)}`;
}

export function formatTenor(months: number): string {
  if (months % 12 === 0 && months >= 12) {
    const years = months / 12;
    return `${years} tahun`;
  }
  return `${months} bulan`;
}

/** Rates move in basis points; 5 bps is the standard step for deposito. */
export const RATE_STEP = 0.05;

/**
 * Rounds to the nearest basis-point step. The trailing round to 2 decimals is
 * load-bearing: `122 * 0.05` is 6.100000000000001 in binary floating point,
 * which would sit just above a 6.10 ceiling and make it unreachable.
 */
export function roundRate(rate: number): number {
  return Math.round((Math.round(rate / RATE_STEP) * RATE_STEP) * 100) / 100;
}

function roundUpRate(rate: number): number {
  return Math.round(Math.ceil(rate / RATE_STEP) * RATE_STEP * 100) / 100;
}

/** Gross interest earned over the full tenor, before tax. */
export function projectInterest(
  principal: number,
  rate: number,
  tenorMonths: number,
): number {
  if (![principal, rate, tenorMonths].every(Number.isFinite)) return 0;
  return principal * (rate / 100) * (tenorMonths / 12);
}

/** The lowest rate that would currently be accepted as an offer. */
export function getMinimumNextRate(auction: Auction, current: number): number {
  const floor = Math.max(current + RATE_STEP, auction.minRate ?? 0);
  return roundUpRate(floor);
}

/** True when the ceiling is reached and no higher offer can ever qualify. */
export function isCeilingReached(auction: Auction, current: number): boolean {
  return auction.maxRate !== null && current >= auction.maxRate;
}

export interface RateOffer {
  id: string;
  label: string;
  /** How far above the current rate this sits, for display. */
  hint: string;
  rate: number;
  kind: "minimum" | "step" | "ceiling";
}

/**
 * Ready-made rates a bank can offer with one tap, lowest first. Anything above
 * the ceiling is dropped; if the ceiling itself is still reachable it is
 * offered as the final "take it" option.
 */
export function getRateOffers(auction: Auction, current: number): RateOffer[] {
  if (isCeilingReached(auction, current)) return [];

  const minimum = getMinimumNextRate(auction, current);
  const ceiling = auction.maxRate;

  const candidates: RateOffer[] = [
    {
      id: "minimum",
      label: "Naik minimum",
      hint: "+5 bps",
      rate: minimum,
      kind: "minimum",
    },
    ...[0.1, 0.25, 0.5].map((delta) => ({
      id: `bps-${delta}`,
      label: `+${Math.round(delta * 100)} bps`,
      hint: formatRateShort(roundRate(current + delta)),
      rate: Math.max(roundUpRate(current + delta), minimum),
      kind: "step" as const,
    })),
  ];

  const seen = new Set<number>();
  const offers = candidates.filter((offer) => {
    if (offer.rate < minimum) return false;
    if (ceiling !== null && offer.rate > ceiling) return false;
    if (seen.has(offer.rate)) return false;
    seen.add(offer.rate);
    return true;
  });

  if (ceiling !== null && ceiling >= minimum && !seen.has(ceiling)) {
    offers.push({
      id: "ceiling",
      label: "Batas atas",
      hint: "Langsung ke maksimum",
      rate: ceiling,
      kind: "ceiling",
    });
  }

  return offers;
}
