import { Sidebar } from "@/components/sidebar";
import Link from "next/link";

export default function InternalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="sticky top-0 z-50 h-16 border-b border-slate-200 bg-white flex items-center px-6">
        <Link href="/" className="flex items-center gap-3">
          <img
            src="/lensically-logo-white-with-black-bg.png"
            alt="Lensically"
            className="h-16 w-16 rounded-md"
          />
          <span className="text-lg font-semibold text-slate-900">Lensically</span>
        </Link>
      </header>

      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
