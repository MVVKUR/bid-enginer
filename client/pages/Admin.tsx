import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { Infinity as InfinityIcon, Plus, Trash2 } from "lucide-react";
import { useAuctions } from "@/context/AuctionContext";
import { getAuctionStatus, formatCurrency, formatDateTime, getCurrentPrice } from "@/lib/auctions";
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

export default function Admin() {
  const { auctions, createAuction, deleteAuction } = useAuctions();

  const defaultStart = useMemo(() => new Date(Date.now() + 1000 * 60 * 30), []);
  const defaultEnd = useMemo(() => new Date(Date.now() + 1000 * 60 * 60 * 24), []);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState(toLocalInputValue(defaultStart));
  const [endTime, setEndTime] = useState(toLocalInputValue(defaultEnd));
  const [startingPrice, setStartingPrice] = useState("100");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setTitle("");
    setDescription("");
    setStartTime(toLocalInputValue(defaultStart));
    setEndTime(toLocalInputValue(defaultEnd));
    setStartingPrice("100");
    setMinPrice("");
    setMaxPrice("");
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) return setError("Give the auction a title.");
    if (!startTime || !endTime) return setError("Set both a start and end date/time.");
    if (new Date(endTime) <= new Date(startTime)) {
      return setError("End date/time must be after the start date/time.");
    }

    const parsedStarting = Number(startingPrice);
    if (!Number.isFinite(parsedStarting) || parsedStarting < 0) {
      return setError("Enter a valid starting price.");
    }

    const parsedMin = minPrice.trim() === "" ? null : Number(minPrice);
    const parsedMax = maxPrice.trim() === "" ? null : Number(maxPrice);
    if (parsedMin !== null && !Number.isFinite(parsedMin)) return setError("Lower limit must be a number.");
    if (parsedMax !== null && !Number.isFinite(parsedMax)) return setError("Upper limit must be a number.");
    if (parsedMin !== null && parsedMax !== null && parsedMin > parsedMax) {
      return setError("Lower limit cannot exceed the upper limit.");
    }

    createAuction({
      title: title.trim(),
      description: description.trim(),
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      startingPrice: parsedStarting,
      minPrice: parsedMin,
      maxPrice: parsedMax,
    });

    toast.success(`Auction "${title.trim()}" created`);
    resetForm();
  }

  return (
    <div className="container py-10 sm:py-14">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-foreground">Admin dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Open a new auction and set its schedule and bid limits. Leave a limit blank for no
          restriction in that direction.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[380px_1fr]">
        <form
          onSubmit={handleSubmit}
          className="h-fit space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <div className="space-y-1.5">
            <Label htmlFor="title">Item title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Vintage Leica M6 Camera"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Condition, provenance, what's included..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="startTime">Start date &amp; time</Label>
              <Input
                id="startTime"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endTime">End date &amp; time</Label>
              <Input
                id="endTime"
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="startingPrice">Starting price (USD)</Label>
            <Input
              id="startingPrice"
              type="number"
              min={0}
              value={startingPrice}
              onChange={(e) => setStartingPrice(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="minPrice">Lower limit</Label>
              <Input
                id="minPrice"
                type="number"
                min={0}
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="No minimum"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="maxPrice">Upper limit</Label>
              <Input
                id="maxPrice"
                type="number"
                min={0}
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="No maximum"
              />
            </div>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <InfinityIcon className="h-3.5 w-3.5" />
            Leave a limit blank to allow unlimited bids in that direction.
          </p>

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}

          <Button type="submit" className="w-full gap-1.5">
            <Plus className="h-4 w-4" />
            Open auction
          </Button>
        </form>

        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border p-5">
            <h2 className="font-display text-lg font-bold text-foreground">
              All auctions ({auctions.length})
            </h2>
          </div>
          {auctions.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No auctions yet. Create your first one.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Window</TableHead>
                  <TableHead>Limit</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auctions.map((auction) => {
                  const status = getAuctionStatus(auction);
                  const hasLimit = auction.minPrice !== null || auction.maxPrice !== null;
                  return (
                    <TableRow key={auction.id}>
                      <TableCell className="max-w-[220px]">
                        <p className="truncate font-medium text-foreground">{auction.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {auction.bids.length} bid{auction.bids.length === 1 ? "" : "s"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(auction.startTime)} → {formatDateTime(auction.endTime)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {hasLimit ? (
                          <>
                            {auction.minPrice !== null ? formatCurrency(auction.minPrice) : "∞"} –{" "}
                            {auction.maxPrice !== null ? formatCurrency(auction.maxPrice) : "∞"}
                          </>
                        ) : (
                          <span className="text-muted-foreground">Unlimited</span>
                        )}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatCurrency(getCurrentPrice(auction))}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            deleteAuction(auction.id);
                            toast("Auction removed");
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
