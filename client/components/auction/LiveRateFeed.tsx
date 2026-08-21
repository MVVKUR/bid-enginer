import { ArrowUp, Crown, Gavel } from "lucide-react";
import { Auction } from "@shared/api";
import { formatRateShort, formatRate, formatTenor } from "@/lib/currency";
import { formatRelativeTime, getAnonymousLabels } from "@/lib/auctions";
import { cn } from "@/lib/utils";

/**
 * The running log of rate offers, newest first, so a bidder can watch the
 * competition move in real time. Rival banks stay anonymous — a bidder sees
 * "Peserta A", never who they are actually bidding against.
 */
export default function LiveRateFeed({
  auction,
  now,
  youInstitution,
}: {
  auction: Auction;
  now: number;
  youInstitution?: string;
}) {
  const ordered = [...auction.bids].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const leadingRate = ordered.reduce(
    (best, bid) => Math.max(best, bid.rate),
    auction.startingRate,
  );
  const labels = getAnonymousLabels(auction);

  if (ordered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-10 text-center">
        <Gavel className="h-7 w-7 text-primary/40" />
        <p className="text-sm font-medium text-foreground">Belum ada penawaran</p>
        <p className="text-xs text-muted-foreground">
          Rate pembuka {formatRate(auction.startingRate)}. Jadilah yang pertama menawar.
        </p>
      </div>
    );
  }

  return (
    <ol className="space-y-2" aria-label="Riwayat penawaran rate">
      {ordered.map((bid, index) => {
        const isLeading = bid.rate === leadingRate;
        const isYou = youInstitution !== undefined && bid.institution === youInstitution;
        const previous = ordered[index + 1];
        const delta = bid.rate - (previous ? previous.rate : auction.startingRate);
        const anonymous = labels.get(bid.institution) ?? "Peserta";
        const displayName = isYou ? "Penawaran Anda" : anonymous;
        // Never render the bank's real identity to a competing bidder.
        const badge = isYou ? "AN" : anonymous.replace("Peserta ", "");

        return (
          <li
            key={bid.id}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-3 transition-colors",
              isLeading ? "border-success/40 bg-success/5" : "border-border bg-background",
            )}
          >
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                isLeading ? "bg-success/15 text-success" : "bg-primary/10 text-primary",
              )}
              aria-hidden="true"
            >
              {badge}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-semibold text-foreground">
                  {displayName}
                </p>
                {isYou && (
                  <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                    Anda
                  </span>
                )}
                {isLeading && (
                  <Crown
                    className="h-3.5 w-3.5 shrink-0 text-success"
                    aria-label="Penawaran tertinggi"
                  />
                )}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                Tenor {formatTenor(bid.tenorMonths)} · {formatRelativeTime(bid.createdAt, now)}
              </p>
            </div>

            <div className="shrink-0 text-right">
              <p
                className={cn(
                  "font-display text-base font-bold tabular-nums",
                  isLeading ? "text-success" : "text-foreground",
                )}
              >
                {formatRateShort(bid.rate)}
              </p>
              {delta > 0 && (
                <p className="flex items-center justify-end gap-0.5 text-[11px] font-medium text-muted-foreground">
                  <ArrowUp className="h-3 w-3" />
                  {Math.round(delta * 100)} bps
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
