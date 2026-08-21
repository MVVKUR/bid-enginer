import { useMemo, useState } from "react";
import { CalendarClock, Radio, Wallet } from "lucide-react";
import { useAuctions } from "@/context/AuctionContext";
import { useAuth } from "@/context/AuthContext";
import { getAuctionStatus } from "@/lib/auctions";
import { formatCurrencyCompact } from "@/lib/currency";
import { AuctionStatus } from "@shared/api";
import AuctionCard from "@/components/auction/AuctionCard";
import DemoSimulationToggle from "@/components/auction/DemoSimulationToggle";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const filters: { value: "all" | AuctionStatus; label: string }[] = [
  { value: "all", label: "Semua auction" },
  { value: "live", label: "Berlangsung" },
  { value: "upcoming", label: "Akan dibuka" },
  { value: "ended", label: "Selesai" },
];

/**
 * The auction floor. Everyone here is signed in, so this is a working
 * dashboard, not a landing page: compact header, stats inline, and the
 * auctions themselves visible without scrolling.
 */
export default function Index() {
  const { auctions } = useAuctions();
  const { user } = useAuth();
  const [filter, setFilter] = useState<"all" | AuctionStatus>("all");

  const counts = useMemo(() => {
    const result = { all: auctions.length, live: 0, upcoming: 0, ended: 0 };
    auctions.forEach((auction) => {
      result[getAuctionStatus(auction)]++;
    });
    return result;
  }, [auctions]);

  const liveValue = useMemo(
    () =>
      auctions
        .filter((auction) => getAuctionStatus(auction) === "live")
        .reduce((total, auction) => total + auction.principal, 0),
    [auctions],
  );

  const visible = useMemo(() => {
    const sorted = [...auctions].sort((a, b) => {
      const order: Record<AuctionStatus, number> = { live: 0, upcoming: 1, ended: 2 };
      return order[getAuctionStatus(a)] - order[getAuctionStatus(b)];
    });
    if (filter === "all") return sorted;
    return sorted.filter((auction) => getAuctionStatus(auction) === filter);
  }, [auctions, filter]);

  return (
    <div>
      <section className="border-b border-border/70 bg-gradient-to-b from-secondary/50 to-background">
        <div className="container flex flex-col gap-5 py-7 sm:py-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Penempatan deposito
            </h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              {user?.role === "admin"
                ? "Pantau seluruh penempatan dan persaingan rate antar bank secara real-time."
                : "Tawarkan rate dan tenor untuk setiap penempatan — Anda langsung tahu saat tersalip."}
            </p>
          </div>

          <dl className="grid w-full grid-cols-3 divide-x divide-border rounded-xl border border-border bg-card shadow-sm lg:w-auto">
            <div className="px-4 py-3 sm:px-6">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Radio className="h-3.5 w-3.5 text-success" />
                Berlangsung
              </dt>
              <dd className="mt-0.5 font-display text-xl font-bold text-foreground">
                {counts.live}
              </dd>
            </div>
            <div className="px-4 py-3 sm:px-6">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5 text-primary" />
                Akan dibuka
              </dt>
              <dd className="mt-0.5 font-display text-xl font-bold text-foreground">
                {counts.upcoming}
              </dd>
            </div>
            <div className="px-4 py-3 sm:px-6">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Wallet className="h-3.5 w-3.5 text-primary" />
                Dana berjalan
              </dt>
              <dd className="mt-0.5 font-display text-xl font-bold text-foreground">
                {formatCurrencyCompact(liveValue)}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="container py-6 sm:py-8">
        <DemoSimulationToggle className="mb-5" />

        {/* Scrolls within itself on narrow screens — the nowrap triggers must
            never be the thing that widens the page. */}
        <div className="mb-5 overflow-x-auto pb-1">
          <Tabs value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
            <TabsList className="w-max">
              {filters.map((item) => (
                <TabsTrigger key={item.value} value={item.value}>
                  {item.label}
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    ({counts[item.value]})
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-20 text-center text-muted-foreground">
            Belum ada auction pada kategori ini.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((auction) => (
              <AuctionCard key={auction.id} auction={auction} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
