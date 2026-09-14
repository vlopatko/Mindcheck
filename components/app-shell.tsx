"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Crosshair,
  LayoutDashboard,
  CalendarCheck,
  Target,
  ChartNoAxesCombined,
} from "lucide-react";
export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="shell">
      <header>
        <Link className="brand" href="/">
          <Crosshair />
          <span>
            mindcheck<span className="brand-dot">.</span>
          </span>
        </Link>
        <span className="header-meta">COUNTER-STRIKE 2 / PLAYER JOURNAL</span>
        <span className="private">Personal workspace</span>
      </header>
      <main>
        <nav aria-label="Main navigation" className="route-nav">
          {[
            ["/", "Dashboard", LayoutDashboard],
            ["/check-in", "Check-in", CalendarCheck],
            ["/matches", "Matches", Target],
            ["/analytics", "Analytics", ChartNoAxesCombined],
          ].map(([href, label, Icon]) => {
            const I = Icon as typeof Crosshair;
            return (
              <Link
                key={href as string}
                href={href as string}
                aria-current={path === href ? "page" : undefined}
              >
                <I size={17} />
                {label as string}
              </Link>
            );
          })}
        </nav>
        {children}
      </main>
      <footer>
        MINDCHECK <span>STATE / PREPARATION / PERFORMANCE</span>
      </footer>
    </div>
  );
}
