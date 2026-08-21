import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Gavel, KeyRound, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEMO_USERS, useAuth, UserRole } from "@/context/AuthContext";

const roleDetails: Record<UserRole, { label: string; description: string; icon: typeof ShieldCheck }> = {
  admin: {
    label: "Admin demo",
    description: "Create auctions, set schedules, and manage bid limits.",
    icon: ShieldCheck,
  },
  bidder: {
    label: "Bidder demo",
    description: "Browse live lots and place bids within their rules.",
    icon: UserRound,
  },
};

export default function Login() {
  const { user, login, loginAsDemo } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const destination = (location.state as { from?: string } | null)?.from ?? "/";

  useEffect(() => {
    if (user) {
      navigate(user.role === "admin" && destination === "/" ? "/admin" : destination, { replace: true });
    }
  }, [destination, navigate, user]);

  if (user) return null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!login(email, password)) {
      setError("Those demo credentials don't match. Try one of the accounts below.");
      return;
    }
    toast.success("Welcome to Bidora");
    navigate(destination, { replace: true });
  }

  function handleDemoLogin(role: UserRole) {
    loginAsDemo(role);
    toast.success(`Signed in as ${roleDetails[role].label}`);
    navigate(role === "admin" ? "/admin" : "/", { replace: true });
  }

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(124,58,237,0.18),transparent_35%),radial-gradient(circle_at_85%_80%,rgba(245,158,11,0.12),transparent_30%)]" />
      <div className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-6 py-10 lg:grid-cols-[0.9fr_1.1fr] lg:px-10">
        <div className="mx-auto w-full max-w-md lg:mx-0">
          <Link to="/login" className="mb-12 inline-flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-purple-500 text-primary-foreground shadow-lg shadow-primary/25">
              <Gavel className="h-5 w-5" />
            </span>
            <span className="font-display text-xl font-bold tracking-tight">Bidora</span>
          </Link>

          <div className="mb-8">
            <p className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
              <Sparkles className="h-4 w-4" />
              Welcome back
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Step into the auction.</h1>
            <p className="mt-3 text-muted-foreground">
              Sign in to discover live lots, place your next winning bid, or manage auctions as an admin.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-border bg-card/85 p-6 shadow-xl shadow-primary/5 backdrop-blur-sm">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" autoComplete="current-password" />
            </div>
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            <Button type="submit" className="h-11 w-full gap-2">
              Sign in <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <p className="mt-5 text-center text-xs text-muted-foreground">
            This is a demo environment. Use one of the demo accounts below.
          </p>
        </div>

        <div className="relative hidden min-h-[560px] items-center justify-center lg:flex">
          <div className="absolute h-[430px] w-[430px] rounded-full border border-primary/10 bg-primary/5" />
          <div className="absolute h-[330px] w-[330px] rounded-full border border-primary/15 bg-primary/5" />
          <div className="relative w-full max-w-md rounded-3xl border border-white/60 bg-white/70 p-7 shadow-2xl shadow-primary/15 backdrop-blur-xl dark:border-white/10 dark:bg-card/80">
            <div className="mb-8 flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Demo access</p>
                <h2 className="mt-1 font-display text-2xl font-bold">Choose your role</h2>
              </div>
              <span className="rounded-xl bg-gold/15 p-3 text-gold-foreground"><KeyRound className="h-5 w-5" /></span>
            </div>
            <div className="space-y-3">
              {DEMO_USERS.map((demoUser) => {
                const details = roleDetails[demoUser.role];
                const Icon = details.icon;
                return (
                  <button
                    key={demoUser.role}
                    type="button"
                    onClick={() => handleDemoLogin(demoUser.role)}
                    className="group flex w-full items-center gap-4 rounded-2xl border border-border bg-background/75 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display font-bold text-foreground">{details.label}</span>
                      <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{details.description}</span>
                      <span className="mt-2 block font-mono text-[11px] text-primary/80">{demoUser.email} · {demoUser.password}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                  </button>
                );
              })}
            </div>
            <div className="mt-7 flex items-center gap-2 border-t border-border pt-5 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-success" />
              Demo credentials are available for preview only.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
