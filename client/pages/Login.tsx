import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, KeyRound, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEMO_USERS, useAuth, UserRole } from "@/context/AuthContext";

const roleDetails: Record<UserRole, { label: string; description: string; icon: typeof ShieldCheck }> = {
  admin: {
    label: "Demo Admin",
    description: "Buka penempatan deposito, atur tenor dan batas rate, pantau persaingan bank.",
    icon: ShieldCheck,
  },
  bidder: {
    label: "Demo Bank Peserta",
    description: "Masuk ruang auction, tawarkan rate dan tenor, naikkan saat tersalip.",
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
      setError("Kredensial demo tidak cocok. Coba salah satu akun di bawah.");
      return;
    }
    toast.success("Selamat datang di NEW Bestie BPJS");
    navigate(destination, { replace: true });
  }

  function handleDemoLogin(role: UserRole) {
    loginAsDemo(role);
    toast.success(`Masuk sebagai ${roleDetails[role].label}`);
    navigate(role === "admin" ? "/admin" : "/", { replace: true });
  }

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-background">
      {/* Photo backdrop. The scrim below is load-bearing: the source image is a
          bright outdoor shot, and the heading sits directly on it. */}
      <div aria-hidden="true" className="absolute inset-0">
        <img
          src="/login-bg.jpg"
          alt=""
          className="h-full w-full object-cover object-center"
        />
        {/* Heavier at the top-left where the copy sits, lighter bottom-right so
            the building and signage stay visible. Theme tokens keep it working
            in dark mode. */}
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background/85 to-background/55" />
        {/* Lifts the lower band, where the photo's own signage would otherwise
            compete with the demo hint text. */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(0,133,124,0.18),transparent_35%),radial-gradient(circle_at_85%_80%,rgba(245,130,32,0.14),transparent_30%)]" />
      </div>
      <div className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-6 py-10 lg:grid-cols-[0.9fr_1.1fr] lg:px-10">
        <div className="mx-auto w-full max-w-md lg:mx-0">
          <Link to="/login" className="mb-12 inline-flex items-center gap-2">
            <img
              src="/bpjs-mark.svg"
              alt=""
              aria-hidden="true"
              className="h-11 w-11 shrink-0"
            />
            <span className="font-display text-xl font-bold tracking-tight">NEW Bestie BPJS</span>
          </Link>

          <div className="mb-8">
            <p className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
              <Sparkles className="h-4 w-4" />
              Selamat datang
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Portal auction deposito Anda.</h1>
            <p className="mt-3 text-muted-foreground">
              Masuk untuk mengikuti auction penempatan deposito dan menawarkan rate secara real-time.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-border bg-card/85 p-6 shadow-xl shadow-primary/5 backdrop-blur-sm">
            <div className="space-y-1.5">
              <Label htmlFor="email">Alamat email</Label>
              <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Kata sandi</Label>
              <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Masukkan kata sandi" autoComplete="current-password" />
            </div>
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            <Button type="submit" className="h-11 w-full gap-2">
              Masuk <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <p className="mt-5 text-center text-xs text-muted-foreground">
            Ini lingkungan demo. Gunakan salah satu akun di bawah.
          </p>
        </div>

        <div className="relative hidden min-h-[560px] items-center justify-center lg:flex">
          <div className="absolute h-[430px] w-[430px] rounded-full border border-primary/10 bg-primary/5" />
          <div className="absolute h-[330px] w-[330px] rounded-full border border-primary/15 bg-primary/5" />
          <div className="relative w-full max-w-md rounded-3xl border border-white/60 bg-white/70 p-7 shadow-2xl shadow-primary/15 backdrop-blur-xl dark:border-white/10 dark:bg-card/80">
            <div className="mb-8 flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Akses demo</p>
                <h2 className="mt-1 font-display text-2xl font-bold">Pilih peran Anda</h2>
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
                      <span className="mt-1.5 block text-[11px] font-medium text-foreground/70">{demoUser.institution}</span>
                      <span className="mt-1 block font-mono text-[11px] text-primary/80">{demoUser.email} · {demoUser.password}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                  </button>
                );
              })}
            </div>
            <div className="mt-7 flex items-center gap-2 border-t border-border pt-5 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-success" />
              Kredensial demo hanya untuk pratinjau.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
