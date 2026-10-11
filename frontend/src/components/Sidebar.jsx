import { NavLink } from "react-router-dom";

const navLinks = [
  { to: "/", label: "Dashboard", icon: "📊" },
  { to: "/brands", label: "Brands", icon: "🏷️" },
  { to: "/analytics", label: "Analytics", icon: "📈" },
  { to: "/mentions", label: "Mentions", icon: "💬" },
  { to: "/comparison", label: "Comparison", icon: "⚔️" },
  { to: "/settings", label: "System Status", icon: "⚙️" },
];

export default function Sidebar() {
  return (
    <aside className="flex h-screen w-64 flex-col border-r border-border bg-surface px-4 py-6">
      {/* App Logo */}
      <div className="mb-8 flex items-center gap-3 px-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand font-bold text-white shadow-md">
          RL
        </div>
        <div>
          <span className="font-display text-lg font-bold tracking-tight text-text-primary">
            RivalLens
          </span>
          <p className="text-[11px] font-medium text-text-muted">Competitor Intelligence</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex flex-1 flex-col gap-1.5">
        {navLinks.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? "bg-brand/20 text-brand-hover font-semibold border-l-2 border-brand"
                  : "text-text-muted hover:bg-surface-hover hover:text-text-primary"
              }`
            }
          >
            <span className="text-base">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* College Project Badge Footer */}
      <div className="rounded-lg border border-border bg-ink/60 p-3 text-xs text-text-muted">
        <p className="font-semibold text-text-primary">🎓 Project Demo</p>
        <p className="mt-0.5 text-[11px] text-text-muted">FastAPI + SQLite + React</p>
      </div>
    </aside>
  );
}