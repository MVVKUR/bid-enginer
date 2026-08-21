import { useState } from "react";
import { Clock, Gavel, TrendingUp } from "lucide-react";
import { Auction } from "@shared/api";
import { getAuctionStatus, getCurrentPrice, formatCurrency, formatRange } from "@/lib/auctions";
import StatusBadge from "@/components/auction/StatusBadge";
import CountdownTimer from "@/components/auction/CountdownTimer";
import BidDialog from "@/components/auction/BidDialog";
import { Button } from "@/components/ui/button";

const banners = [
  "from-teal-700 via-teal-500 to-cyan-400",
  "from-amber-400 via-orange-400 to-rose-400",
  "from-cyan-600 via-teal-500 to-emerald-400",
  "from-emerald-500 via-teal-500 to-cyan-400",
];

export default function AuctionCard({ auction, index }: { auction: Auction; index: number }) {
  const [bidOpen, setBidOpen] = useState(false);
  const status = getAuctionStatus(auction);
  const currentPrice = getCurrentPrice(auction);
  const banner = banners[index % banners.length];

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-lg hover:shadow-primary/5">
      <div className={`relative h-32 bg-gradient-to-br ${banner}`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_60%)]" />
        <div className="absolute left-4 top-4">
          <StatusBadge status={status} />
        </div>
        <Gavel className="absolute -bottom-4 -right-4 h-20 w-20 rotate-12 text-white/15" />
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div>
          <h3 className="font-display text-lg font-bold text-foreground">{auction.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{auction.description}</p>
        </div>

        <div className="flex items-baseline justify-between rounded-xl bg-secondary/60 px-4 py-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {auction.bids.length > 0 ? "Current bid" : "Starting price"}
            </p>
            <p className="font-display text-xl font-extrabold text-foreground">
              {formatCurrency(currentPrice)}
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" />
            {auction.bids.length} bid{auction.bids.length === 1 ? "" : "s"}
          </div>
        </div>

        <dl className="space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Limit</dt>
            <dd className="font-medium text-foreground">
              {formatRange(auction.minPrice, auction.maxPrice)}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {status === "upcoming" ? "Starts in" : status === "live" ? "Ends in" : "Closed"}
            </dt>
            <dd className="font-semibold text-foreground">
              {status === "ended" ? (
                "—"
              ) : (
                <CountdownTimer target={status === "upcoming" ? auction.startTime : auction.endTime} />
              )}
            </dd>
          </div>
        </dl>

        <div className="mt-auto pt-1">
          <Button
            className="w-full"
            disabled={status !== "live"}
            variant={status === "live" ? "default" : "secondary"}
            onClick={() => setBidOpen(true)}
          >
            {status === "live" && "Place bid"}
            {status === "upcoming" && "Not open yet"}
            {status === "ended" && "Auction closed"}
          </Button>
        </div>
      </div>

      <BidDialog auction={auction} open={bidOpen} onOpenChange={setBidOpen} />
    </div>
  );
}
