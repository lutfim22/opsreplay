"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useRef, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const options = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

const subscribe = () => () => {};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const selectedTheme = mounted && options.some((option) => option.value === theme) ? theme : "system";

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex rounded-lg border border-border bg-muted p-0.5"
    >
      {options.map(({ value, label, icon: Icon }, index) => {
        const active = mounted && selectedTheme === value;
        const tabbable = selectedTheme === value;
        return (
          <button
            key={value}
            ref={(button) => { buttons.current[index] = button; }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            tabIndex={tabbable ? 0 : -1}
            title={label}
            onClick={() => setTheme(value)}
            onKeyDown={(event) => {
              let nextIndex: number;
              if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % options.length;
              else if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (index + options.length - 1) % options.length;
              else if (event.key === "Home") nextIndex = 0;
              else if (event.key === "End") nextIndex = options.length - 1;
              else return;
              const next = options[nextIndex];
              if (!next) return;
              event.preventDefault();
              setTheme(next.value);
              buttons.current[nextIndex]?.focus();
            }}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground",
              active && "bg-card text-foreground shadow-sm",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
