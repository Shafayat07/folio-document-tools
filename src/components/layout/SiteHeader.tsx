"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { cn } from "@/lib/core/utils";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/tools/image-to-pdf", label: "Image to PDF" },
  { href: "/pdf-tools", label: "PDF Tools" },
  { href: "/converters", label: "Converters" },
  { href: "/about", label: "About" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur-[2px]">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-3 sm:px-5">
        <Link href="/" className="shrink-0 rounded" aria-label="Folio home">
          <Logo />
        </Link>

        <nav className="ml-4 hidden flex-1 items-center gap-0.5 lg:flex" aria-label="Main">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                isActive(item.href) ? "bg-[#EDEEF0] text-ink" : "text-ink-500 hover:bg-[#F2F3F5] hover:text-ink",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/"
            className="hidden h-9 items-center rounded border border-ink bg-ink px-3.5 text-sm font-medium text-white transition-colors hover:bg-ink-700 sm:inline-flex"
          >
            Create PDF
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="inline-flex h-9 w-9 items-center justify-center rounded border border-line-strong text-ink-500 hover:bg-subtle lg:hidden"
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <nav className="border-t border-line bg-surface px-3 py-2 lg:hidden" aria-label="Mobile">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "block rounded px-3 py-2.5 text-sm font-medium",
                isActive(item.href) ? "bg-[#EDEEF0] text-ink" : "text-ink-500 hover:bg-[#F2F3F5]",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
