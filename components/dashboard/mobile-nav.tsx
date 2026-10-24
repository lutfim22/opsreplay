"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { NavLinks } from "@/components/dashboard/nav-links";

export function MobileNav() {
  const [openPath, setOpenPath] = useState<string | null>(null);
  const pathname = usePathname();
  const open = openPath === pathname;
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenPath(null);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        onClick={() => setOpenPath(open ? null : pathname)}
        className="inline-flex size-9 items-center justify-center rounded-lg border border-border hover:bg-muted"
      >
        {open ? <X className="size-4" aria-hidden="true" /> : <Menu className="size-4" aria-hidden="true" />}
      </button>
      {open && (
        <div
          id="mobile-nav-panel"
          className="absolute inset-x-0 top-14 z-30 border-b border-border bg-card p-3 shadow-lg"
        >
          <NavLinks />
        </div>
      )}
    </div>
  );
}
