import { useEffect, useState } from "react";
import { formatCountdown } from "@/lib/auctions";

export default function CountdownTimer({ target }: { target: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return <span className="tabular-nums">{formatCountdown(target, now)}</span>;
}
