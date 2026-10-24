import { Activity } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { NavLinks } from "@/components/dashboard/nav-links";
import { ThemeToggle } from "@/components/theme-toggle";

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
      <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Activity className="size-4" aria-hidden="true" />
      </span>
      OpsReplay
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[15rem_1fr]">
      <aside className="hidden border-r border-border bg-card md:block">
        <div className="sticky top-0 flex h-screen flex-col gap-6 p-4">
          <Brand />
          <NavLinks />
          <p className="mt-auto text-xs text-muted-foreground">Mock data · UI preview</p>
        </div>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="relative sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border bg-card/90 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <MobileNav />
            <div className="md:hidden">
              <Brand />
            </div>
          </div>
          <ThemeToggle />
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
