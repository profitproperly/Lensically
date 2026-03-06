import Link from "next/link";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/insights", label: "Insights" },
  { href: "/schedule", label: "Schedule Posts" },
  { href: "/search", label: "Keyword Search" },
  { href: "/discovery", label: "Profile Discovery" },
];

export function Sidebar() {
  return (
    <aside className="w-64 shrink-0 border-r border-slate-200 bg-white p-6">
      <div className="mb-8 text-lg font-semibold text-slate-900">Lensically</div>
      <nav className="space-y-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
