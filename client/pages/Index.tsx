import { useMemo, useState } from "react";
import { Gavel, ShieldCheck, Timer, TrendingUp } from "lucide-react";
import { useAuctions } from "@/context/AuctionContext";
import { getAuctionStatus } from "@/lib/auctions";
import { AuctionStatus } from "@shared/api";
import AuctionCard from "@/components/auction/AuctionCard";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const filters: { value: "all" | AuctionStatus; label: string }[] = [
  { value: "all", label: "All auctions" },
  { value: "live", label: "Live" },
  { value: "upcoming", label: "Upcoming" },
  { value: "ended", label: "Ended" },
];

export default function Index() {
  const { auctions } = useAuctions();
  const [filter, setFilter] = useState<"all" | AuctionStatus>("all");

  const counts = useMemo(() => {
    const result = { all: auctions.length, live: 0, upcoming: 0, ended: 0 };
    auctions.forEach((a) => {
      result[getAuctionStatus(a)]++;
    });
    return result;
  }, [auctions]);

  const visible = useMemo(() => {
    const sorted = [...auctions].sort((a, b) => {
      const order: Record<AuctionStatus, number> = { live: 0, upcoming: 1, ended: 2 };
      return order[getAuctionStatus(a)] - order[getAuctionStatus(b)];
    });
    if (filter === "all") return sorted;
    return sorted.filter((a) => getAuctionStatus(a) === filter);
  }, [auctions, filter]);

  return (
    <div>
      <section className="relative overflow-hidden border-b border-border/70 bg-gradient-to-b from-secondary/60 to-background">
        <div className="absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.16),transparent_65%)]" />
        <div className="container flex flex-col items-center gap-6 py-16 text-center sm:py-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
            <Gavel className="h-4 w-4" />
            Real-time bidding, transparent limits
          </span>
          <h1 className="max-w-2xl text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Win it before the clock runs out.
          </h1>
          <p className="max-w-xl text-balance text-muted-foreground sm:text-lg">
            Browse open auctions, watch prices move live, and place bids within
            the limits each auction sets — or with no limit at all.
          </p>

          <div className="mt-2 grid w-full max-w-xl grid-cols-3 gap-3 text-left sm:gap-4">
            <div className="rounded-xl border border-border bg-card/60 p-4">
              <TrendingUp className="mb-2 h-5 w-5 text-primary" />
              <p className="text-xs text-muted-foreground">Live auctions</p>
              <p className="font-display text-xl font-bold text-foreground">{counts.live}</p>
            </div>
            <div className="rounded-xl border border-border bg-card/60 p-4">
              <Timer className="mb-2 h-5 w-5 text-primary" />
              <p className="text-xs text-muted-foreground">Upcoming</p>
              <p className="font-display text-xl font-bold text-foreground">{counts.upcoming}</p>
            </div>
            <div className="rounded-xl border border-border bg-card/60 p-4">
              <ShieldCheck className="mb-2 h-5 w-5 text-primary" />
              <p className="text-xs text-muted-foreground">Fair-limit bids</p>
              <p className="font-display text-xl font-bold text-foreground">100%</p>
            </div>
          </div>
        </div>
      </section>

      <section className="container py-10 sm:py-14">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-2xl font-bold text-foreground">Open auctions</h2>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList>
              {filters.map((f) => (
                <TabsTrigger key={f.value} value={f.value}>
                  {f.label}
                  <span className="ml-1.5 text-xs text-muted-foreground">({counts[f.value]})</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-20 text-center text-muted-foreground">
            No auctions in this category yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((auction, i) => (
              <AuctionCard key={auction.id} auction={auction} index={i} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
