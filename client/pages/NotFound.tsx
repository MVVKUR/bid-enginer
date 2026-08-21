import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Gavel } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Gavel className="h-7 w-7" />
      </span>
      <h1 className="font-display text-4xl font-extrabold text-foreground">404</h1>
      <p className="max-w-sm text-muted-foreground">
        This lot doesn't exist, or the auction has already been taken down.
      </p>
      <Button asChild>
        <Link to="/">Back to auctions</Link>
      </Button>
    </div>
  );
};

export default NotFound;
