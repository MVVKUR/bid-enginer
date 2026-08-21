import { FlaskConical, RefreshCw, Zap } from "lucide-react";
import { DemoSpeed, useDemoSimulation } from "@/context/DemoSimulationContext";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SPEED_OPTIONS: { value: DemoSpeed; label: string }[] = [
  { value: "santai", label: "Santai" },
  { value: "normal", label: "Normal" },
  { value: "ramai", label: "Ramai" },
];

/**
 * Compact control strip for demo mode. Stays visibly amber while on — the
 * feed contains machine-generated offers and that must be glanceable — but
 * as a single slim row so it never outweighs the auctions themselves.
 */
export default function DemoSimulationToggle({ className }: { className?: string }) {
  const { enabled, setEnabled, autoRestart, setAutoRestart, speed, setSpeed, injectOnce } =
    useDemoSimulation();

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border px-3.5 py-2.5 transition-colors",
        enabled ? "border-gold/40 bg-gold/10" : "border-border bg-card",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <FlaskConical
          className={cn(
            "h-4 w-4 shrink-0",
            enabled ? "text-gold-foreground" : "text-muted-foreground",
          )}
        />
        <label
          htmlFor="demo-sim"
          className="cursor-pointer text-sm font-semibold text-foreground"
        >
          Simulasi bank pesaing
        </label>
        <Switch
          id="demo-sim"
          checked={enabled}
          onCheckedChange={setEnabled}
          aria-label="Aktifkan simulasi bank pesaing"
        />
      </div>

      {enabled ? (
        <>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Intensitas</span>
            <div role="radiogroup" aria-label="Intensitas simulasi" className="flex gap-1">
              {SPEED_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={speed === option.value}
                  onClick={() => setSpeed(option.value)}
                  className={cn(
                    "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                    speed === option.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
            <label
              htmlFor="demo-autorestart"
              className="cursor-pointer text-xs font-medium text-muted-foreground"
            >
              Ulang otomatis
            </label>
            <Switch
              id="demo-autorestart"
              checked={autoRestart}
              onCheckedChange={setAutoRestart}
              aria-label="Ulang ronde otomatis saat auction selesai"
            />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto h-7 gap-1.5 px-2.5 text-xs"
            onClick={injectOnce}
          >
            <Zap className="h-3.5 w-3.5" />
            Tawar sekarang
          </Button>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          Nonaktif — hanya penawaran nyata yang tampil.
        </p>
      )}
    </div>
  );
}
