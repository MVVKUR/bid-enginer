import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  CalendarClock,
  Infinity as InfinityIcon,
  Landmark,
  Plus,
  Trash2,
  Users,
  Wallet,
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
import { Auction, PayoutMode } from "@shared/api";
import { useAuctions } from "@/context/AuctionContext";
import {
  getAuctionStatus,
  getCurrentRate,
  getLeadingBid,
  getParticipantCount,
  formatDateTime,
  formatTenorWindow,
} from "@/lib/auctions";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatRate,
  formatRateRange,
  formatRateShort,
  formatTenor,
  projectInterest,
  RATE_STEP,
} from "@/lib/currency";
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
import { cn } from "@/lib/utils";

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
    { label: "Buka", rate: auction.startingRate, bidder: "Rate pembuka" },
    ...auction.bids
      .slice()
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((bid, index) => ({
        label: `#${index + 1}`,
        rate: bid.rate,
        bidder: `${bid.institution} · ${formatTenor(bid.tenorMonths)}`,
      })),
  ];
}

function AuctionManagementPanel({
  auction,
  onBack,
}: {
  auction: Auction;
  onBack: () => void;
}) {
  const status = getAuctionStatus(auction);
  const currentRate = getCurrentRate(auction);
  const leading = getLeadingBid(auction);

  const participants = useMemo(() => {
    const map = new Map<
      string,
      { institution: string; person: string; bids: number; best: number; tenor: number }
    >();
    auction.bids.forEach((bid) => {
      const existing = map.get(bid.institution);
      const better = !existing || bid.rate > existing.best;
      map.set(bid.institution, {
        institution: bid.institution,
        person: better ? bid.bidderName : (existing?.person ?? bid.bidderName),
        bids: (existing?.bids ?? 0) + 1,
        best: Math.max(existing?.best ?? 0, bid.rate),
        tenor: better ? bid.tenorMonths : (existing?.tenor ?? bid.tenorMonths),
      });
    });
    return [...map.values()].sort((a, b) => b.best - a.best);
  }, [auction.bids]);

  const series = chartData(auction);
  const cost = leading
    ? projectInterest(auction.principal, leading.rate, leading.tenorMonths)
    : 0;

  return (
    <section
      className="mt-8 scroll-mt-24 rounded-2xl border border-border bg-card shadow-sm"
      aria-label={`Tampilan pengelolaan ${auction.title}`}
    >
      <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="flex items-start gap-3">
          <Button variant="outline" size="icon" onClick={onBack} aria-label="Kembali ke daftar auction">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <StatusBadge status={status} />
              <span className="text-xs text-muted-foreground">Tampilan pengelolaan</span>
            </div>
            <h2 className="font-display text-2xl font-bold text-foreground">{auction.title}</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {auction.description || "Tidak ada deskripsi."}
            </p>
          </div>
        </div>
        <div className="rounded-xl bg-secondary/60 px-4 py-3 text-left sm:text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Rate tertinggi
          </p>
          <p className="font-display text-2xl font-extrabold tabular-nums text-foreground">
            {formatRateShort(currentRate)}
          </p>
          {leading && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {leading.institution} · {formatTenor(leading.tenorMonths)}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 border-b border-border p-5 sm:grid-cols-4 sm:p-6">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-4">
          <span className="rounded-lg bg-primary/10 p-2.5 text-primary">
            <Wallet className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">Nominal</p>
            <p className="font-display text-lg font-bold text-foreground">
              {formatCurrencyCompact(auction.principal)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-4">
          <span className="rounded-lg bg-teal-500/10 p-2.5 text-teal-600">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">Bank peserta</p>
            <p className="font-display text-lg font-bold text-foreground">
              {getParticipantCount(auction)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-4">
          <span className="rounded-lg bg-orange-500/10 p-2.5 text-orange-600">
            <Activity className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">Total penawaran</p>
            <p className="font-display text-lg font-bold text-foreground">
              {auction.bids.length}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-4">
          <span className="rounded-lg bg-sky-500/10 p-2.5 text-sky-600">
            <CalendarClock className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">Bunga pada rate tertinggi</p>
            <p className="font-display text-lg font-bold text-foreground">
              {leading ? formatCurrencyCompact(cost) : "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 p-5 sm:p-6 xl:grid-cols-[1.45fr_0.8fr]">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-bold text-foreground">
                Pergerakan rate
              </h3>
              <p className="text-sm text-muted-foreground">
                Setiap penawaran yang masuk, berurutan.
              </p>
            </div>
            <span className="hidden items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> Data langsung
            </span>
          </div>
          <div className="h-[280px] w-full rounded-xl border border-border bg-background p-3 sm:h-[330px]">
            {auction.bids.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                <Activity className="h-8 w-8 text-primary/40" />
                <p className="font-medium text-foreground">Belum ada penawaran</p>
                <p className="text-sm">Grafik terisi saat bank mulai menawar.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rateFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={["dataMin - 0.25", "dataMax + 0.25"]}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value: number) => `${value.toFixed(2)}%`}
                    width={58}
                  />
                  <ChartTooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--card))",
                    }}
                    formatter={(value: number) => [formatRate(value), "Rate"]}
                    labelFormatter={(label, payload) =>
                      payload?.[0]?.payload?.bidder
                        ? `${label} · ${payload[0].payload.bidder}`
                        : label
                    }
                  />
                  <Area
                    type="stepAfter"
                    dataKey="rate"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    fill="url(#rateFill)"
                    dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-bold text-foreground">Bank peserta</h3>
              <p className="text-sm text-muted-foreground">Penawaran terbaik tiap bank.</p>
            </div>
            <Users className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            {participants.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Belum ada bank yang menawar.
              </div>
            ) : (
              participants.map((participant, index) => (
                <div
                  key={participant.institution}
                  className="flex items-center gap-3 rounded-xl border border-border bg-background p-3"
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      index === 0 ? "bg-gold/20 text-gold-foreground" : "bg-primary/10 text-primary",
                    )}
                  >
                    {initials(participant.institution)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {participant.institution}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {participant.bids} penawaran · tenor {formatTenor(participant.tenor)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold tabular-nums text-foreground">
                      {formatRateShort(participant.best)}
                    </p>
                    {index === 0 && (
                      <p className="text-[10px] font-semibold uppercase text-gold-foreground">
                        Memimpin
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border bg-secondary/30 px-5 py-4 text-sm text-muted-foreground sm:px-6">
        <span className="flex items-center gap-1.5">
          <Landmark className="h-4 w-4 text-primary" /> Rate pembuka{" "}
          {formatRate(auction.startingRate)}
        </span>
        <span className="flex items-center gap-1.5">
          <ArrowUpRight className="h-4 w-4 text-primary" />
          {auction.minRate === null && auction.maxRate === null
            ? "Rate tanpa batas"
            : `Batas ${formatRateRange(auction.minRate, auction.maxRate)}`}
        </span>
        <span className="flex items-center gap-1.5">
          <CalendarClock className="h-4 w-4 text-primary" />
          {formatDateTime(auction.startTime)} – {formatDateTime(auction.endTime)}
        </span>
      </div>
    </section>
  );
}

export default function Admin() {
  const { auctions, createAuction, deleteAuction } = useAuctions();
  const defaultStart = useMemo(() => new Date(Date.now() + 1000 * 60 * 30), []);
  const defaultEnd = useMemo(() => new Date(Date.now() + 1000 * 60 * 60 * 24), []);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedAuctionId, setSelectedAuctionId] = useState<string | null>(() =>
    searchParams.get("auction"),
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState(toLocalInputValue(defaultStart));
  const [endTime, setEndTime] = useState(toLocalInputValue(defaultEnd));
  const [principal, setPrincipal] = useState("1000000000");
  const [minTenor, setMinTenor] = useState("3");
  const [maxTenor, setMaxTenor] = useState("6");
  const [payout, setPayout] = useState<PayoutMode>("maturity");
  const [startingRate, setStartingRate] = useState("6.00");
  const [minRate, setMinRate] = useState("");
  const [maxRate, setMaxRate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selectedAuction = auctions.find((auction) => auction.id === selectedAuctionId) ?? null;

  function resetForm() {
    setTitle("");
    setDescription("");
    setStartTime(toLocalInputValue(defaultStart));
    setEndTime(toLocalInputValue(defaultEnd));
    setPrincipal("1000000000");
    setMinTenor("3");
    setMaxTenor("6");
    setPayout("maturity");
    setStartingRate("6.00");
    setMinRate("");
    setMaxRate("");
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!title.trim()) return setError("Beri nama penempatan ini.");
    if (!startTime || !endTime) return setError("Tentukan waktu buka dan tutup auction.");
    if (new Date(endTime) <= new Date(startTime))
      return setError("Waktu tutup harus setelah waktu buka.");
    const parsedMinTenor = Number(minTenor);
    const parsedMaxTenor = Number(maxTenor);
    if (!Number.isInteger(parsedMinTenor) || parsedMinTenor <= 0)
      return setError("Tenor minimum harus bilangan bulat bulan.");
    if (!Number.isInteger(parsedMaxTenor) || parsedMaxTenor <= 0)
      return setError("Tenor maksimum harus bilangan bulat bulan.");
    if (parsedMinTenor > parsedMaxTenor)
      return setError("Tenor minimum tidak boleh melebihi tenor maksimum.");

    const parsedPrincipal = Number(principal);
    if (!Number.isFinite(parsedPrincipal) || parsedPrincipal <= 0)
      return setError("Masukkan nominal penempatan yang valid.");

    const parsedStarting = Number(startingRate);
    if (!Number.isFinite(parsedStarting) || parsedStarting <= 0)
      return setError("Masukkan rate pembuka yang valid.");

    const parsedMin = minRate.trim() === "" ? null : Number(minRate);
    const parsedMax = maxRate.trim() === "" ? null : Number(maxRate);
    if (parsedMin !== null && !Number.isFinite(parsedMin))
      return setError("Batas bawah harus berupa angka.");
    if (parsedMax !== null && !Number.isFinite(parsedMax))
      return setError("Batas atas harus berupa angka.");
    if (parsedMin !== null && parsedMax !== null && parsedMin > parsedMax)
      return setError("Batas bawah tidak boleh melebihi batas atas.");
    if (parsedMax !== null && parsedStarting > parsedMax)
      return setError("Rate pembuka tidak boleh melebihi batas atas.");

    createAuction({
      title: title.trim(),
      description: description.trim(),
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      principal: parsedPrincipal,
      minTenorMonths: parsedMinTenor,
      maxTenorMonths: parsedMaxTenor,
      payout,
      startingRate: parsedStarting,
      minRate: parsedMin,
      maxRate: parsedMax,
    });

    toast.success(`Auction "${title.trim()}" dibuka`);
    resetForm();
  }

  function selectAuction(id: string) {
    setSelectedAuctionId(id);
    setSearchParams({ auction: id });
  }

  function removeAuction(id: string) {
    deleteAuction(id);
    if (selectedAuctionId === id) {
      setSelectedAuctionId(null);
      setSearchParams({});
    }
    toast("Auction dihapus");
  }

  return (
    <div className="container py-10 sm:py-14">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-foreground">Dashboard admin</h1>
        <p className="mt-1 text-muted-foreground">
          Buka penempatan deposito, atur batas rate, dan pantau persaingan bank secara real-time.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[400px_1fr]">
        <form
          onSubmit={handleSubmit}
          className="h-fit space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <div className="space-y-1.5">
            <Label htmlFor="title">Nama penempatan</Label>
            <Input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Deposito Berjangka — Dana Kelolaan"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Keterangan</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Sumber dana, ketentuan pencairan, catatan lain..."
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="principal">Nominal penempatan (IDR)</Label>
            <Input
              id="principal"
              type="number"
              min={0}
              step={1000000}
              value={principal}
              onChange={(event) => setPrincipal(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {formatCurrency(Number(principal) || 0)}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Rentang tenor (bulan)</Label>
            <div className="grid grid-cols-2 gap-4">
              <Input
                aria-label="Tenor minimum dalam bulan"
                type="number"
                min={1}
                step={1}
                value={minTenor}
                onChange={(event) => setMinTenor(event.target.value)}
                placeholder="Min"
              />
              <Input
                aria-label="Tenor maksimum dalam bulan"
                type="number"
                min={1}
                step={1}
                value={maxTenor}
                onChange={(event) => setMaxTenor(event.target.value)}
                placeholder="Maks"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Bank mengisi tenor bebas dalam rentang ini.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Pembayaran bunga</Label>
            <div className="flex gap-2">
              {(
                [
                  { value: "maturity", label: "Saat jatuh tempo" },
                  { value: "monthly", label: "Bulanan" },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={payout === option.value}
                  onClick={() => setPayout(option.value)}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    payout === option.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:border-primary",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="startTime">Buka auction</Label>
              <Input
                id="startTime"
                type="datetime-local"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endTime">Tutup auction</Label>
              <Input
                id="endTime"
                type="datetime-local"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="startingRate">Rate pembuka (% p.a.)</Label>
            <Input
              id="startingRate"
              type="number"
              min={0}
              step={RATE_STEP}
              value={startingRate}
              onChange={(event) => setStartingRate(event.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="minRate">Batas bawah (%)</Label>
              <Input
                id="minRate"
                type="number"
                min={0}
                step={RATE_STEP}
                value={minRate}
                onChange={(event) => setMinRate(event.target.value)}
                placeholder="Tanpa batas"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="maxRate">Batas atas (%)</Label>
              <Input
                id="maxRate"
                type="number"
                min={0}
                step={RATE_STEP}
                value={maxRate}
                onChange={(event) => setMaxRate(event.target.value)}
                placeholder="Tanpa batas"
              />
            </div>
          </div>

          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <InfinityIcon className="h-3.5 w-3.5" />
            Kosongkan batas untuk membiarkan rate bebas.
          </p>

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}

          <Button type="submit" className="w-full gap-1.5">
            <Plus className="h-4 w-4" />
            Buka auction
          </Button>
        </form>

        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border p-5">
            <h2 className="font-display text-lg font-bold text-foreground">
              Semua auction ({auctions.length})
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pilih satu auction untuk membuka tampilan pengelolaan.
            </p>
          </div>
          {auctions.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Belum ada auction. Buat yang pertama.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Penempatan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Nominal</TableHead>
                    <TableHead>Tenor</TableHead>
                    <TableHead>Batas rate</TableHead>
                    <TableHead>Tertinggi</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auctions.map((auction) => {
                    const status = getAuctionStatus(auction);
                    return (
                      <TableRow
                        key={auction.id}
                        className="cursor-pointer"
                        onClick={() => selectAuction(auction.id)}
                      >
                        <TableCell className="max-w-[220px]">
                          <p className="truncate font-medium text-foreground">{auction.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {auction.bids.length} penawaran ·{" "}
                            {getParticipantCount(auction)} bank
                          </p>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={status} />
                        </TableCell>
                        <TableCell className="text-xs font-medium">
                          {formatCurrencyCompact(auction.principal)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatTenorWindow(auction)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatRateRange(auction.minRate, auction.maxRate)}
                        </TableCell>
                        <TableCell className="font-semibold tabular-nums">
                          {formatRateShort(getCurrentRate(auction))}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(event) => {
                              event.stopPropagation();
                              removeAuction(auction.id);
                            }}
                            aria-label={`Hapus ${auction.title}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {selectedAuction && (
        <AuctionManagementPanel
          auction={selectedAuction}
          onBack={() => {
            setSelectedAuctionId(null);
            setSearchParams({});
          }}
        />
      )}
    </div>
  );
}
