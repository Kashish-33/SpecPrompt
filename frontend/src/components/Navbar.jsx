import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { FlaskConical } from "lucide-react";
import { getHealth } from "../api/client";

const links = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/suites", label: "Suites", end: true },
];

export default function Navbar() {
  const [connected, setConnected] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function ping() {
      const ok = await getHealth();
      if (!cancelled) {
        setConnected(ok);
      }
    }

    ping();
    const id = setInterval(ping, 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const statusLabel =
    connected === null ? "Checking…" : connected ? "Backend connected" : "Backend offline";
  const statusColor =
    connected === null ? "bg-amber-400" : connected ? "bg-emerald-400" : "bg-rose-400";

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <NavLink to="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30">
            <FlaskConical className="h-5 w-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight text-slate-50">SpecPrompt</span>
        </NavLink>

        <nav className="flex items-center gap-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-zinc-800 text-slate-50"
                    : "text-slate-400 hover:bg-zinc-900 hover:text-slate-200"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/70 px-3 py-1.5">
          <span className={`h-2 w-2 rounded-full ${statusColor} ${connected ? "animate-pulse" : ""}`} />
          <span className="hidden text-xs font-medium text-slate-300 sm:inline">{statusLabel}</span>
        </div>
      </div>
    </header>
  );
}
