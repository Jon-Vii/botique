import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { ChartBar, ClockCounterClockwise, Sliders, Storefront, SquaresFour, Trophy } from "@phosphor-icons/react";
import { NavLink, Outlet } from "react-router-dom";
import { SimBar } from "./SimBar";

const NAV_ITEMS = [
  { to: "/", icon: SquaresFour, label: "Observatory", end: true },
  { to: "/marketplace", icon: Storefront, label: "Marketplace" },
  { to: "/runs", icon: ClockCounterClockwise, label: "Runs" },
  { to: "/benchmarks", icon: ChartBar, label: "Benchmarks" },
  { to: "/tournaments", icon: Trophy, label: "Tournaments" },
  { to: "/operator", icon: Sliders, label: "Operator" },
] as const;

function NavItem({
  to,
  icon: Icon,
  label,
  end,
}: {
  to: string;
  icon: PhosphorIcon;
  label: string;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium transition-all duration-200 border ${
          isActive
            ? "border-orange/20 bg-orange-50 text-orange"
            : "border-transparent text-muted hover:text-ink hover:bg-warm-50"
        }`
      }
    >
      <Icon size={16} weight="duotone" />
      {label}
    </NavLink>
  );
}

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-rule bg-cream/85 backdrop-blur-xl">
        <div className="mx-auto max-w-[1400px] flex items-center gap-6 px-6 h-13">
          {/* Logo — pixel font! */}
          <NavLink
            to="/"
            className="flex items-center gap-2.5 shrink-0 group"
          >
            <div className="w-8 h-8 bg-orange flex items-center justify-center group-hover:shadow-[0_0_16px_rgba(255,112,0,0.3)] transition-shadow">
              <span className="text-white font-pixel text-sm leading-none">
                b
              </span>
            </div>
            <span className="font-pixel text-lg text-ink tracking-wide">
              botique
            </span>
          </NavLink>

          {/* Separator */}
          <div className="w-px h-5 bg-rule" />

          {/* Nav */}
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Sim bar */}
          <SimBar />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 mx-auto max-w-[1400px] w-full px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
