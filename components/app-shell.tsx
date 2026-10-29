"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Crosshair,
  LayoutDashboard,
  CalendarCheck,
  Target,
  ChartNoAxesCombined,
  FileSearch,
} from "lucide-react";
export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<{ authenticated: boolean; displayName?: string } | null>(null);
  useEffect(() => {
    void fetch("/api/auth/me", { cache: "no-store" }).then((r) => r.json()).then(setProfile);
  }, [path]);
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    router.push("/login");
    router.refresh();
  }
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
        {profile?.authenticated ? (
          <button className="private" onClick={() => void logout()} title="Sign out">
            {profile.displayName ?? "Steam player"} · Sign out
          </button>
        ) : (
          <Link className="private" href="/login">Sign in with Steam</Link>
        )}
      </header>
      <main>
        {path !== "/login" && <nav aria-label="Main navigation" className="route-nav">
          {[
            ["/", "Dashboard", LayoutDashboard],
            ["/check-in", "Check-in", CalendarCheck],
            ["/matches", "Matches", Target],
            ["/demo-parser", "DemoParser", FileSearch],
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
        </nav>}
        {children}
      </main>
      <footer>
        MINDCHECK <span>STATE / PREPARATION / PERFORMANCE</span>
      </footer>
    </div>
  );
}
