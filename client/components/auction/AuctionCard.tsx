import { AlertTriangle, Clock, Crown, Trophy, Users, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { Auction, AuctionStatus } from "@shared/api";
import {
  formatCountdown,
  formatTenorWindow,
  getAnonymousLabels,
  getAuctionStatus,
  getBidderStanding,
  getCurrentRate,
  getParticipantCount,
  getWinner,
} from "@/lib/auctions";
import { formatCurrency, formatRateRange, formatRateShort } from "@/lib/currency";
import StatusBadge from "@/components/auction/StatusBadge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useLivePresence } from "@/hooks/use-live-presence";
import { useNow } from "@/hooks/use-now";
import { cn } from "@/lib/utils";

/** Under this much remaining time, a live auction's countdown turns urgent. */
const URGENT_MS = 5 * 60 * 1000;

/**
 * Slim top accent, colored by status. Replaces the old decorative banner,
 * whose color rotated by card position and so implied meaning it didn't have.
 */
const ACCENT: Record<AuctionStatus, string> = {
  live: "bg-success",
  upcoming: "bg-primary/70",
  ended: "bg-border",
};

export default function AuctionCard({ auction }: { auction: Auction }) {
  const { user } = useAuth();
  // Tick so the countdown runs and the card settles by itself the moment the
  // auction closes, instead of waiting for some unrelated re-render.
  const now = useNow(1000);
  const isAdmin = user?.role === "admin";
  const status = getAuctionStatus(auction, now);
  const currentRate = getCurrentRate(auction);
  const standing = getBidderStanding(auction, user?.institution);
  const winner = getWinner(auction, now);
  const youWon = winner !== null && winner.institution === user?.institution;

  // Observe-only: the card never announces itself, so the count reflects
  // people who actually opened the bidding room.
  const presence = useLivePresence(auction.id);

  const remaining = new Date(auction.endTime).getTime() - now;
  const urgent = status === "live" && remaining <= URGENT_MS;
  const rateLabel =
    status === "ended" && winner
      ? "Rate pemenang"
      : auction.bids.length > 0
        ? "Rate tertinggi"
        : "Rate pembuka";

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-lg hover:shadow-primary/5">
      <div className={cn("h-1 w-full", ACCENT[status])} aria-hidden="true" />

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={status} />
          {status === "live" && presence.total > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              <Users className="h-3 w-3" />
              {presence.total} di ruang
            </span>
          )}
          {status !== "ended" && (
            <span
              className={cn(
                "ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                urgent
                  ? "bg-destructive/10 text-destructive"
                  : "bg-secondary text-muted-foreground",
              )}
            >
              <Clock className="h-3 w-3" />
              {status === "upcoming"
                ? `Dibuka ${formatCountdown(auction.startTime, now)}`
                : formatCountdown(auction.endTime, now)}
            </span>
          )}
        </div>

        <div>
          <h3 className="font-display text-lg font-bold leading-snug text-foreground">
            {auction.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {auction.description}
          </p>
        </div>

        <div className="flex items-baseline justify-between rounded-xl bg-secondary/60 px-4 py-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {rateLabel}
            </p>
            <p className="font-display text-2xl font-extrabold tabular-nums text-foreground">
              {formatRateShort(currentRate)}
            </p>
          </div>
          <div className="text-right text-xs font-medium text-muted-foreground">
            <p className="flex items-center justify-end gap-1">
              <Users className="h-3.5 w-3.5" />
              {getParticipantCount(auction)} peserta
            </p>
            <p className="mt-0.5">{auction.bids.length} penawaran</p>
          </div>
        </div>

        <dl className="space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <dt className="flex items-center gap-1 text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" />
              Nominal
            </dt>
            <dd className="font-semibold text-foreground">
              {formatCurrency(auction.principal)}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Tenor</dt>
            <dd className="font-medium text-foreground">{formatTenorWindow(auction)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Batas rate</dt>
            <dd className="font-medium text-foreground">
              {formatRateRange(auction.minRate, auction.maxRate)}
            </dd>
          </div>
        </dl>

        {/* Settled: show the outcome instead of a now-meaningless standing. */}
        {!isAdmin && winner && (
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold",
              youWon ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground",
            )}
          >
            <Trophy className="h-3.5 w-3.5" />
            {youWon
              ? `Anda menang di ${formatRateShort(winner.rate)}`
              : `Pemenang ${getAnonymousLabels(auction).get(winner.institution) ?? "peserta"} · ${formatRateShort(winner.rate)}`}
          </div>
        )}

        {/* Standing cue so a bidder sees they are losing without opening the room. */}
        {!isAdmin && !winner && standing.hasBid && (
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold",
              standing.isOutbid
                ? "bg-destructive/10 text-destructive"
                : "bg-success/10 text-success",
            )}
          >
            {standing.isOutbid ? (
              <>
                <AlertTriangle className="h-3.5 w-3.5" />
                Tersalip {standing.behindBps} bps
              </>
            ) : (
              <>
                <Crown className="h-3.5 w-3.5" />
                Penawaran Anda memimpin
              </>
            )}
          </div>
        )}

        <div className="mt-auto pt-1">
          {isAdmin ? (
            <Button
              asChild
              className="w-full"
              variant={status === "live" ? "default" : "secondary"}
            >
              <Link to={`/admin?auction=${encodeURIComponent(auction.id)}`}>
                Kelola auction
              </Link>
            </Button>
          ) : (
            <Button
              asChild
              className="w-full"
              variant={status === "live" ? "default" : "secondary"}
            >
              <Link to={`/auction/${encodeURIComponent(auction.id)}`}>
                {status === "live" && (standing.isOutbid ? "Naikkan rate" : "Tawarkan rate")}
                {status === "upcoming" && "Lihat ruang auction"}
                {status === "ended" && "Lihat hasil"}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
