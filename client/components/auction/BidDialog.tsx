import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { Auction } from "@shared/api";
import { useAuctions } from "@/context/AuctionContext";
import { formatCurrency, formatRange, getCurrentPrice } from "@/lib/auctions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function BidDialog({
  auction,
  open,
  onOpenChange,
}: {
  auction: Auction;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { placeBid } = useAuctions();
  const currentPrice = getCurrentPrice(auction);
  const [bidderName, setBidderName] = useState("");
  const [amount, setAmount] = useState(() => String(currentPrice + 10));
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!bidderName.trim()) {
      setError("Enter your name to place a bid.");
      return;
    }
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Enter a valid bid amount.");
      return;
    }

    const result = placeBid(auction.id, bidderName.trim(), numericAmount);
    if (!result.success) {
      setError(result.error ?? "Unable to place bid.");
      return;
    }

    toast.success(`Bid placed! ${formatCurrency(numericAmount)} on ${auction.title}`);
    onOpenChange(false);
    setBidderName("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Place your bid</DialogTitle>
          <DialogDescription>{auction.title}</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg bg-secondary/60 p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Current price</span>
            <span className="font-display font-bold text-foreground">
              {formatCurrency(currentPrice)}
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-muted-foreground">Allowed range</span>
            <span className="font-medium text-foreground">
              {formatRange(auction.minPrice, auction.maxPrice)}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="bidderName">Your name</Label>
            <Input
              id="bidderName"
              value={bidderName}
              onChange={(e) => setBidderName(e.target.value)}
              placeholder="Jane Doe"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="amount">Bid amount (USD)</Label>
            <Input
              id="amount"
              type="number"
              min={0}
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" className="w-full">
              Confirm bid
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
