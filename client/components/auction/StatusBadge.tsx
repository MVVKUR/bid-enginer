import { AuctionStatus } from "@shared/api";
import { cn } from "@/lib/utils";

const config: Record<AuctionStatus, { label: string; className: string }> = {
  live: {
    label: "Live now",
    className: "bg-success/10 text-success ring-1 ring-inset ring-success/30",
  },
  upcoming: {
    label: "Upcoming",
    className: "bg-primary/10 text-primary ring-1 ring-inset ring-primary/30",
  },
  ended: {
    label: "Ended",
    className: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
  },
};

export default function StatusBadge({ status }: { status: AuctionStatus }) {
  const { label, className } = config[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        className,
      )}
    >
      {status === "live" && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
        </span>
      )}
      {label}
    </span>
  );
}
