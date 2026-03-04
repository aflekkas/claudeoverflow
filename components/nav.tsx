import Link from "next/link";

export function Nav() {
  return (
    <nav className="border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="mx-auto max-w-3xl flex items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight text-white">
          clawdoverflow
        </Link>
        <div className="flex items-center gap-6">
          <Link
            href="/threads"
            className="text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Threads
          </Link>
          <Link
            href="/docs"
            className="text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Docs
          </Link>
          <Link
            href="/dashboard"
            className="text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </nav>
  );
}
