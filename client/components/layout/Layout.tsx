import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Gavel, LayoutDashboard, Gauge, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/", label: "Browse Auctions", icon: Gauge },
  { to: "/admin", label: "Admin", icon: LayoutDashboard },
];

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-lg">
        <div className="container flex h-16 items-center justify-between gap-3">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-teal-700 text-primary-foreground shadow-sm shadow-primary/30">
              <Gavel className="h-4.5 w-4.5" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight text-foreground">NEW Bestie BPJS</span>
          </Link>

          <nav className="flex items-center gap-1 rounded-full border border-border bg-secondary/60 p-1">
            {navItems.map((item) => {
              if (item.to === "/admin" && user?.role !== "admin") return null;
              const isActive = location.pathname === item.to;
              return (
                <Link key={item.to} to={item.to} className={cn("flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors sm:px-4", isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                  <item.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden max-w-28 truncate text-xs font-medium text-muted-foreground sm:block">{user?.name}</span>
            <Button variant="ghost" size="icon" onClick={logout} aria-label="Sign out" title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border/70 py-8">
        <div className="container flex flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2"><Gavel className="h-4 w-4 text-primary" /><span className="font-display font-semibold text-foreground">NEW Bestie BPJS</span></div>
          <p>Secure digital services, made simpler.</p>
        </div>
      </footer>
    </div>
  );
}
