import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  CalendarClock,
  DollarSign,
  Infinity as InfinityIcon,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Auction } from "@shared/api";
import { useAuctions } from "@/context/AuctionContext";
import {
  getAuctionStatus,
  formatCurrency,
  formatDateTime,
  getCurrentPrice,
} from "@/lib/auctions";
import StatusBadge from "@/components/auction/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function toLocalInputValue(date: Date) {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function chartData(auction: Auction) {
  return [
    {
      label: "Start",
      amount: auction.startingPrice,
      bidder: "Opening price",
    },
    ...auction.bids.map((bid, index) => ({
      label: `Bid ${index + 1}`,
      amount: bid.amount,
      bidder: bid.bidderName,
    })),
  ];
}

function AuctionManagementPanel({ auction, onBack }: { auction: Auction; onBack: () => void }) {
  const status = getAuctionStatus(auction);
  const participants = useMemo(() => {
    const map = new Map<string, { name: string; bids: number; highest: number }>();
    auction.bids.forEach((bid) => {
      const current = map.get(bid.bidderName) ?? { name: bid.bidderName, bids: 0, highest: 0 };
      map.set(bid.bidderName, {
        ...current,
        bids: current.bids + 1,
        highest: Math.max(current.highest, bid.amount),
      });
    });
    return [...map.values()].sort((a, b) => b.highest - a.highest);
  }, [auction.bids]);
  const bids = chartData(auction);

  return (
    <section className="mt-8 scroll-mt-24 rounded-2xl border border-border bg-card shadow-sm" aria-label={`${auction.title} management view`}>
      <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="flex items-start gap-3">
          <Button variant="outline" size="icon" onClick={onBack} aria-label="Back to all auctions">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <StatusBadge status={status} />
              <span className="text-xs text-muted-foreground">Management view</span>
            </div>
            <h2 className="font-display text-2xl font-bold text-foreground">{auction.title}</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{auction.description || "No description provided."}</p>
          </div>
        </div>
        <div className="rounded-xl bg-secondary/60 px-4 py-3 text-left sm:text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current bid</p>
          <p className="font-display text-2xl font-extrabold text-foreground">{formatCurrency(getCurrentPrice(auction))}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 border-b border-border p-5 sm:grid-cols-3 sm:p-6">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-4">
          <span className="rounded-lg bg-primary/10 p-2.5 text-primary"><Users className="h-5 w-5" /></span>
          <div><p className="text-xs text-muted-foreground">Participants</p><p className="font-display text-xl font-bold text-foreground">{participants.length}</p></div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-4">
          <span className="rounded-lg bg-orange-500/10 p-2.5 text-orange-600"><Activity className="h-5 w-5" /></span>
          <div><p className="text-xs text-muted-foreground">Total bids</p><p className="font-display text-xl font-bold text-foreground">{auction.bids.length}</p></div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-4">
          <span className="rounded-lg bg-sky-500/10 p-2.5 text-sky-600"><CalendarClock className="h-5 w-5" /></span>
          <div><p className="text-xs text-muted-foreground">Auction window</p><p className="text-sm font-semibold text-foreground">{formatDateTime(auction.startTime)} – {formatDateTime(auction.endTime)}</p></div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 p-5 sm:p-6 xl:grid-cols-[1.45fr_0.8fr]">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div><h3 className="font-display text-lg font-bold text-foreground">Live bid activity</h3><p className="text-sm text-muted-foreground">Price movement across every submitted bid.</p></div>
            <span className="hidden items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-success" /> Live data</span>
          </div>
          <div className="h-[280px] w-full rounded-xl border border-border bg-background p-3 sm:h-[330px]">
            {auction.bids.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground"><Activity className="h-8 w-8 text-primary/40" /><p className="font-medium text-foreground">No bids yet</p><p className="text-sm">The graph will populate when bidders participate.</p></div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={bids} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                  <defs><linearGradient id="bidFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.03} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} width={55} />
                  <ChartTooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} formatter={(value: number) => [formatCurrency(value), "Bid"]} labelFormatter={(label, payload) => payload[0]?.payload?.bidder ? `${label} · ${payload[0].payload.bidder}` : label} />
                  <Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={3} fill="url(#bidFill)" dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div>
          <div className="mb-4 flex items-center justify-between"><div><h3 className="font-display text-lg font-bold text-foreground">Participants</h3><p className="text-sm text-muted-foreground">Users competing in this auction.</p></div><Users className="h-5 w-5 text-muted-foreground" /></div>
          <div className="space-y-2">
            {participants.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No participating users yet.</div>
            ) : participants.map((participant, index) => (
              <div key={participant.name} className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${index === 0 ? "bg-gold/20 text-gold-foreground" : "bg-primary/10 text-primary"}`}>{initials(participant.name)}</span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-foreground">{participant.name}</p><p className="text-xs text-muted-foreground">{participant.bids} bid{participant.bids === 1 ? "" : "s"}</p></div>
                <div className="text-right"><p className="text-sm font-bold text-foreground">{formatCurrency(participant.highest)}</p>{index === 0 && <p className="text-[10px] font-semibold uppercase text-gold-foreground">Leading</p>}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border bg-secondary/30 px-5 py-4 text-sm text-muted-foreground sm:px-6">
        <span className="flex items-center gap-1.5"><DollarSign className="h-4 w-4 text-primary" /> Starting at {formatCurrency(auction.startingPrice)}</span>
        <span className="flex items-center gap-1.5"><ArrowUpRight className="h-4 w-4 text-primary" /> {auction.minPrice === null && auction.maxPrice === null ? "Unlimited bid range" : "Custom bid limits applied"}</span>
      </div>
    </section>
  );
}

export default function Admin() {
  const { auctions, createAuction, deleteAuction } = useAuctions();
  const defaultStart = useMemo(() => new Date(Date.now() + 1000 * 60 * 30), []);
  const defaultEnd = useMemo(() => new Date(Date.now() + 1000 * 60 * 60 * 24), []);
  const [selectedAuctionId, setSelectedAuctionId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState(toLocalInputValue(defaultStart));
  const [endTime, setEndTime] = useState(toLocalInputValue(defaultEnd));
  const [startingPrice, setStartingPrice] = useState("100");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const selectedAuction = auctions.find((auction) => auction.id === selectedAuctionId) ?? null;

  function resetForm() {
    setTitle(""); setDescription(""); setStartTime(toLocalInputValue(defaultStart)); setEndTime(toLocalInputValue(defaultEnd)); setStartingPrice("100"); setMinPrice(""); setMaxPrice("");
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault(); setError(null);
    if (!title.trim()) return setError("Give the auction a title.");
    if (!startTime || !endTime) return setError("Set both a start and end date/time.");
    if (new Date(endTime) <= new Date(startTime)) return setError("End date/time must be after the start date/time.");
    const parsedStarting = Number(startingPrice);
    if (!Number.isFinite(parsedStarting) || parsedStarting < 0) return setError("Enter a valid starting price.");
    const parsedMin = minPrice.trim() === "" ? null : Number(minPrice);
    const parsedMax = maxPrice.trim() === "" ? null : Number(maxPrice);
    if (parsedMin !== null && !Number.isFinite(parsedMin)) return setError("Lower limit must be a number.");
    if (parsedMax !== null && !Number.isFinite(parsedMax)) return setError("Upper limit must be a number.");
    if (parsedMin !== null && parsedMax !== null && parsedMin > parsedMax) return setError("Lower limit cannot exceed the upper limit.");
    createAuction({ title: title.trim(), description: description.trim(), startTime: new Date(startTime).toISOString(), endTime: new Date(endTime).toISOString(), startingPrice: parsedStarting, minPrice: parsedMin, maxPrice: parsedMax });
    toast.success(`Auction "${title.trim()}" created`); resetForm();
  }

  function removeAuction(id: string) {
    deleteAuction(id);
    if (selectedAuctionId === id) setSelectedAuctionId(null);
    toast("Auction removed");
  }

  return (
    <div className="container py-10 sm:py-14">
      <div className="mb-8"><h1 className="font-display text-3xl font-bold text-foreground">Admin dashboard</h1><p className="mt-1 text-muted-foreground">Open auctions, configure bid rules, and monitor participation in real time.</p></div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[380px_1fr]">
        <form onSubmit={handleSubmit} className="h-fit space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="space-y-1.5"><Label htmlFor="title">Item title</Label><Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Vintage Leica M6 Camera" /></div>
          <div className="space-y-1.5"><Label htmlFor="description">Description</Label><Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Condition, provenance, what's included..." rows={3} /></div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="startTime">Start date &amp; time</Label><Input id="startTime" type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="endTime">End date &amp; time</Label><Input id="endTime" type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div></div>
          <div className="space-y-1.5"><Label htmlFor="startingPrice">Starting price (USD)</Label><Input id="startingPrice" type="number" min={0} value={startingPrice} onChange={(e) => setStartingPrice(e.target.value)} /></div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="minPrice">Lower limit</Label><Input id="minPrice" type="number" min={0} value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="No minimum" /></div><div className="space-y-1.5"><Label htmlFor="maxPrice">Upper limit</Label><Input id="maxPrice" type="number" min={0} value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="No maximum" /></div></div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><InfinityIcon className="h-3.5 w-3.5" />Leave a limit blank to allow unlimited bids.</p>
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          <Button type="submit" className="w-full gap-1.5"><Plus className="h-4 w-4" />Open auction</Button>
        </form>

        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border p-5"><h2 className="font-display text-lg font-bold text-foreground">All auctions ({auctions.length})</h2><p className="mt-1 text-sm text-muted-foreground">Select an auction to open its management view.</p></div>
          {auctions.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No auctions yet. Create your first one.</p> : (
            <Table><TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Status</TableHead><TableHead>Window</TableHead><TableHead>Limit</TableHead><TableHead>Price</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
              {auctions.map((auction) => {
                const status = getAuctionStatus(auction); const hasLimit = auction.minPrice !== null || auction.maxPrice !== null;
                return <TableRow key={auction.id} className="cursor-pointer" onClick={() => setSelectedAuctionId(auction.id)}>
                  <TableCell className="max-w-[220px]"><p className="truncate font-medium text-foreground">{auction.title}</p><p className="text-xs text-muted-foreground">{auction.bids.length} bid{auction.bids.length === 1 ? "" : "s"}</p></TableCell>
                  <TableCell><StatusBadge status={status} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDateTime(auction.startTime)} → {formatDateTime(auction.endTime)}</TableCell>
                  <TableCell className="text-xs">{hasLimit ? <>{auction.minPrice !== null ? formatCurrency(auction.minPrice) : "∞"} – {auction.maxPrice !== null ? formatCurrency(auction.maxPrice) : "∞"}</> : <span className="text-muted-foreground">Unlimited</span>}</TableCell>
                  <TableCell className="font-semibold">{formatCurrency(getCurrentPrice(auction))}</TableCell>
                  <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={(event) => { event.stopPropagation(); removeAuction(auction.id); }} aria-label={`Delete ${auction.title}`}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                </TableRow>;
              })}
            </TableBody></Table>
          )}
        </div>
      </div>

      {selectedAuction && <AuctionManagementPanel auction={selectedAuction} onBack={() => setSelectedAuctionId(null)} />}
    </div>
  );
}
