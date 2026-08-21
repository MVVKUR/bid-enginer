import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Crown,
  Radio,
  TrendingUp,
  RotateCcw,
  Timer,
  Trophy,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { useAuctions, validateOffer, SPRINT_SECONDS } from "@/context/AuctionContext";
import { useAuth } from "@/context/AuthContext";
import { useLivePresence } from "@/hooks/use-live-presence";
import { useDemoSimulation } from "@/context/DemoSimulationContext";
import { useNow } from "@/hooks/use-now";
import {
  formatCountdown,
  getAuctionStatus,
  getBidderStanding,
  getAnonymousLabels,
  getCurrentRate,
  getDefaultTenor,
  getParticipantCount,
  getWinner,
} from "@/lib/auctions";
import {
  formatCurrency,
  formatRate,
  formatRateRange,
  formatRateShort,
  formatTenor,
  getMinimumNextRate,
  getRateOffers,
  isCeilingReached,
  projectInterest,
  RATE_STEP,
} from "@/lib/currency";
import LiveRateFeed from "@/components/auction/LiveRateFeed";
import DemoSimulationToggle from "@/components/auction/DemoSimulationToggle";
import StatusBadge from "@/components/auction/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Demo shortcuts for shortening a running auction so it can be watched settle. */
const DEADLINE_PRESETS: { label: string; seconds: number }[] = [
  { label: "15 dtk", seconds: 15 },
  { label: "30 dtk", seconds: 30 },
  { label: "2 mnt", seconds: 120 },
  { label: "10 mnt", seconds: 600 },
];

/**
 * Full-page bidding room for one deposito placement. While the page is open the
 * tab announces itself to the other tabs, so the participant count and the rate
 * feed both move in real time. Rival banks stay anonymous.
 */
export default function AuctionRoom() {
  const { auctionId } = useParams<{ auctionId: string }>();
  const { auctions, placeRate, relistAuction, setAuctionDeadline } = useAuctions();
  const { user } = useAuth();
  const now = useNow(1000);
  const { enabled: simulationOn, autoRestart, pendingRestarts } = useDemoSimulation();

  const auction = auctions.find((item) => item.id === auctionId) ?? null;

  const [rate, setRate] = useState("");
  const [tenor, setTenor] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const rateInputRef = useRef<HTMLInputElement>(null);

  const currentRate = auction ? getCurrentRate(auction) : 0;
  const minimumRate = auction ? getMinimumNextRate(auction, currentRate) : 0;
  const ceilingReached = auction ? isCeilingReached(auction, currentRate) : false;

  const offers = useMemo(
    () => (auction ? getRateOffers(auction, currentRate) : []),
    [auction, currentRate],
  );

  // Everyone on this page is a competitor; typing a rate means they are
  // actively preparing an offer.
  const presence = useLivePresence(auction ? auction.id : null, {
    active: Boolean(auction),
    intent: typing ? "bidding" : "watching",
  });

  // Arm the form once the auction resolves, so the prefilled rate reflects the
  // market at the moment the room was entered.
  useEffect(() => {
    if (!auction) return;
    setRate(isCeilingReached(auction, getCurrentRate(auction)) ? "" : String(minimumRate));
    setTenor(String(getDefaultTenor(auction)));
    setError(null);
    setTyping(false);
    // Keyed on identity only: re-running on every rate change would overwrite
    // what the user is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auction?.id]);

  if (!auction) {
    return (
      <div className="container py-20 text-center">
        <h1 className="font-display text-2xl font-bold text-foreground">
          Auction tidak ditemukan
        </h1>
        <p className="mt-2 text-muted-foreground">
          Auction ini mungkin sudah dihapus oleh pemberi dana.
        </p>
        <Button asChild className="mt-6 gap-1.5">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            Kembali ke daftar auction
          </Link>
        </Button>
      </div>
    );
  }

  const status = getAuctionStatus(auction, now);
  const standing = getBidderStanding(auction, user?.institution);
  const winner = getWinner(auction, now);
  const youWon = winner?.institution === user?.institution;
  const closed = status !== "live";
  const restartDueAt = pendingRestarts[auction.id];
  const restartInSeconds =
    restartDueAt === undefined ? null : Math.max(0, Math.ceil((restartDueAt - now) / 1000));

  const numericRate = Number(rate);
  const numericTenor = Number(tenor);
  const bothFilled = rate.trim() !== "" && tenor.trim() !== "";
  const preview = bothFilled ? validateOffer(auction, numericRate, numericTenor) : null;
  const projectedInterest =
    Number.isFinite(numericRate) && Number.isFinite(numericTenor)
      ? projectInterest(auction.principal, numericRate, numericTenor)
      : 0;

  function submit(nextRate: number, nextTenor = numericTenor) {
    setError(null);
    if (!user) {
      setError("Sesi berakhir. Silakan masuk kembali.");
      return;
    }
    if (!auction) return;

    const result = placeRate({
      auctionId: auction.id,
      bidderName: user.name,
      institution: user.institution,
      rate: nextRate,
      tenorMonths: nextTenor,
    });

    if (!result.success) {
      setError(result.error ?? "Penawaran gagal dikirim.");
      return;
    }

    toast.success(
      `Penawaran terkirim — ${formatRateShort(nextRate)} untuk tenor ${formatTenor(nextTenor)}`,
    );
    // Stay in the room: the bidder needs to see whether they get outbid.
    setRate(String(nextRate + RATE_STEP));
    setTyping(false);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submit(numericRate, numericTenor);
  }

  return (
    <div className="container py-8 sm:py-10">
      <Button asChild variant="ghost" size="sm" className="mb-5 -ml-2 gap-1.5">
        <Link to="/">
          <ArrowLeft className="h-4 w-4" />
          Semua auction
        </Link>
      </Button>

      {/* ── Room header ──────────────────────────────────────────────────── */}
      <header className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <StatusBadge status={status} />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            <Users className="h-3.5 w-3.5" />
            {presence.total} peserta di ruang auction
          </span>
          {presence.bidding > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-2.5 py-1 text-xs font-semibold text-gold-foreground">
              <Radio className="h-3.5 w-3.5 animate-pulse" />
              {presence.bidding} sedang menawar
            </span>
          )}
        </div>

        <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
          {auction.title}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          {auction.description}
        </p>

        <dl className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl bg-secondary/60 p-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Rate tertinggi
            </dt>
            <dd className="font-display text-2xl font-extrabold tabular-nums text-foreground">
              {formatRateShort(currentRate)}
            </dd>
            <dd className="mt-0.5 text-xs text-muted-foreground">
              Batas {formatRateRange(auction.minRate, auction.maxRate)}
            </dd>
          </div>
          <div className="rounded-xl bg-secondary/60 p-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {status === "upcoming"
                ? "Dibuka dalam"
                : status === "live"
                  ? "Sisa waktu"
                  : "Ditutup"}
            </dt>
            <dd className="font-display text-2xl font-extrabold tabular-nums text-foreground">
              {status === "ended"
                ? "—"
                : formatCountdown(
                    status === "upcoming" ? auction.startTime : auction.endTime,
                    now,
                  )}
            </dd>
            <dd className="mt-0.5 text-xs text-muted-foreground">
              Tenor {auction.minTenorMonths}–{auction.maxTenorMonths} bulan
            </dd>
            {simulationOn && (
              <dd className="mt-2 border-t border-border/70 pt-2">
                <span className="mb-1.5 flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                  <Timer className="h-3 w-3" />
                  Demo — percepat waktu
                </span>
                <div className="flex flex-wrap gap-1">
                  {DEADLINE_PRESETS.map((preset) => (
                    <button
                      key={preset.seconds}
                      type="button"
                      onClick={() => setAuctionDeadline(auction.id, preset.seconds)}
                      className="rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:border-primary hover:bg-primary/5"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </dd>
            )}
          </div>
          <div className="rounded-xl bg-secondary/60 p-4">
            <dt className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" />
              Nominal
            </dt>
            <dd className="font-display text-lg font-bold text-foreground">
              {formatCurrency(auction.principal)}
            </dd>
            <dd className="mt-0.5 text-xs text-muted-foreground">
              Bunga {auction.payout === "monthly" ? "bulanan" : "saat jatuh tempo"}
            </dd>
          </div>
          <div className="rounded-xl bg-secondary/60 p-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Peserta
            </dt>
            <dd className="font-display text-lg font-bold text-foreground">
              {getParticipantCount(auction)} bank
            </dd>
            <dd className="mt-0.5 text-xs text-muted-foreground">
              {auction.bids.length} penawaran masuk
            </dd>
          </div>
        </dl>
      </header>

      <DemoSimulationToggle className="mt-4" />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        {/* ── Offer form ─────────────────────────────────────────────────── */}
        <section className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <h2 className="font-display text-lg font-bold text-foreground">
            Tawarkan rate Anda
          </h2>

          {standing.isOutbid && !closed && !ceilingReached && (
            <div
              role="alert"
              className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Penawaran Anda tersalip {standing.behindBps} bps
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Rate Anda {formatRateShort(standing.yourBest?.rate ?? 0)} · tertinggi
                    sekarang {formatRateShort(currentRate)}. Naikkan agar tetap bersaing.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={() => submit(minimumRate, standing.yourBest?.tenorMonths ?? numericTenor)}
              >
                <Zap className="h-3.5 w-3.5" />
                Naikkan ke {formatRateShort(minimumRate)}
              </Button>
            </div>
          )}

          {standing.isLeading && !closed && (
            <div className="flex items-center gap-2.5 rounded-xl border border-success/30 bg-success/5 p-4">
              <Crown className="h-4 w-4 shrink-0 text-success" />
              <p className="text-sm font-medium text-foreground">
                Penawaran Anda memimpin di {formatRateShort(standing.yourBest?.rate ?? 0)} untuk
                tenor {formatTenor(standing.yourBest?.tenorMonths ?? 0)}.
              </p>
            </div>
          )}

          {ceilingReached && (
            <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-border bg-secondary/60 p-4">
              <TrendingUp className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">
                  Rate sudah mencapai batas atas {formatRateShort(auction.maxRate ?? 0)}. Tidak ada
                  penawaran lebih tinggi yang dapat diterima.
                </p>
                {simulationOn && autoRestart && (
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {restartInSeconds === null
                      ? "Ronde baru akan dibuka otomatis."
                      : `Ronde baru dibuka dalam ${restartInSeconds} detik…`}
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="ml-auto shrink-0 gap-1.5"
                onClick={() => relistAuction(auction.id, SPRINT_SECONDS)}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Mulai ronde baru
              </Button>
            </div>
          )}

          {closed ? (
            status === "upcoming" ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Auction belum dibuka. Anda dapat memantau ruang ini sampai auction dimulai.
              </div>
            ) : (
              <div className="space-y-4">
                {winner ? (
                  <div
                    className={cn(
                      "rounded-xl border p-5 text-center",
                      youWon
                        ? "border-success/40 bg-success/5"
                        : "border-border bg-secondary/50",
                    )}
                  >
                    <Trophy
                      className={cn(
                        "mx-auto h-8 w-8",
                        youWon ? "text-success" : "text-muted-foreground",
                      )}
                    />
                    <p className="mt-2 text-sm text-muted-foreground">
                      {youWon ? "Selamat — penawaran Anda menang" : "Auction dimenangkan oleh"}
                    </p>
                    <p className="font-display text-2xl font-extrabold text-foreground">
                      {youWon
                        ? "Bank Anda"
                        : (getAnonymousLabels(auction).get(winner.institution) ?? "Peserta")}
                    </p>
                    <p className="mt-1 font-display text-3xl font-extrabold tabular-nums text-foreground">
                      {formatRateShort(winner.rate)}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Tenor {formatTenor(winner.tenorMonths)} · bunga{" "}
                      {formatCurrency(
                        projectInterest(auction.principal, winner.rate, winner.tenorMonths),
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    Auction ditutup tanpa satu pun penawaran.
                  </div>
                )}

                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-1.5"
                  onClick={() => relistAuction(auction.id, SPRINT_SECONDS)}
                >
                  <RotateCcw className="h-4 w-4" />
                  Ulangi ronde {SPRINT_SECONDS} detik (demo)
                </Button>
              </div>
            )
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {offers.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Tawarkan rate cepat
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {offers.map((offer) => (
                      <button
                        key={offer.id}
                        type="button"
                        onClick={() => {
                          setRate(String(offer.rate));
                          setError(null);
                          rateInputRef.current?.focus();
                        }}
                        className={cn(
                          "rounded-xl border p-2.5 text-left transition-colors hover:border-primary hover:bg-primary/5",
                          Number(rate) === offer.rate
                            ? "border-primary bg-primary/5"
                            : "border-border bg-background",
                        )}
                      >
                        <span className="block font-display text-sm font-bold tabular-nums text-foreground">
                          {formatRateShort(offer.rate)}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          {offer.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="rate">Rate penawaran (% p.a.)</Label>
                  <Input
                    id="rate"
                    ref={rateInputRef}
                    type="number"
                    inputMode="decimal"
                    step={RATE_STEP}
                    min={0}
                    value={rate}
                    onChange={(event) => {
                      setRate(event.target.value);
                      setTyping(true);
                      setError(null);
                    }}
                    onBlur={() => setTyping(false)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimal {formatRate(minimumRate)} · kelipatan 5 bps
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tenor">Tenor (bulan)</Label>
                  <Input
                    id="tenor"
                    type="number"
                    inputMode="numeric"
                    step={1}
                    min={auction.minTenorMonths}
                    max={auction.maxTenorMonths}
                    value={tenor}
                    onChange={(event) => {
                      setTenor(event.target.value);
                      setError(null);
                    }}
                    placeholder={String(auction.minTenorMonths)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {auction.minTenorMonths}–{auction.maxTenorMonths} bulan
                    {Number.isInteger(numericTenor) && numericTenor > 0
                      ? ` · ${formatTenor(numericTenor)}`
                      : ""}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-secondary/40 p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Estimasi bunga bruto</span>
                  <span className="font-display text-xl font-bold tabular-nums text-foreground">
                    {formatCurrency(projectedInterest)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatCurrency(auction.principal)} × {formatRateShort(numericRate || 0)} ×{" "}
                  {Number.isInteger(numericTenor) && numericTenor > 0
                    ? formatTenor(numericTenor)
                    : "—"}
                  , sebelum pajak
                </p>
              </div>

              {(error || (preview && !preview.success)) && (
                <p role="alert" className="text-sm font-medium text-destructive">
                  {error ?? preview?.error}
                </p>
              )}

              <Button
                type="submit"
                className="w-full gap-1.5"
                disabled={!preview || !preview.success}
              >
                <Zap className="h-4 w-4" />
                Kirim penawaran
              </Button>
            </form>
          )}
        </section>

        {/* ── Live feed ──────────────────────────────────────────────────── */}
        <aside className="h-fit space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-foreground">
              Penawaran langsung
            </h2>
            {status === "live" && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                </span>
                Live
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Identitas bank peserta dirahasiakan selama auction berlangsung.
            {simulationOn && " Sebagian penawaran di bawah dihasilkan oleh simulasi demo."}
          </p>
          <div className="max-h-[520px] overflow-y-auto pr-1" aria-live="polite">
            <LiveRateFeed auction={auction} now={now} youInstitution={user?.institution} />
          </div>
        </aside>
      </div>
    </div>
  );
}
