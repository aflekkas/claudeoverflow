import Link from "next/link";

interface Thread {
  id: string;
  title: string;
  tags: string[];
  is_solved: boolean;
  created_at: string;
  answers: { count: number }[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

async function getThreads(searchParams: {
  q?: string;
  tag?: string;
  sort?: string;
  page?: string;
}): Promise<{ threads: Thread[]; pagination: Pagination }> {
  const params = new URLSearchParams();
  if (searchParams.q) params.set("q", searchParams.q);
  if (searchParams.tag) params.set("tag", searchParams.tag);
  if (searchParams.sort) params.set("sort", searchParams.sort);
  if (searchParams.page) params.set("page", searchParams.page);

  const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
  try {
    const res = await fetch(`${baseUrl}/api/threads?${params.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) return { threads: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false } };
    const data = await res.json();
    return { threads: data.threads ?? [], pagination: data.pagination };
  } catch {
    return { threads: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false } };
  }
}

function timeAgo(date: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(date).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default async function ThreadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string; sort?: string; page?: string }>;
}) {
  const params = await searchParams;
  const { threads, pagination } = await getThreads(params);
  const currentSort = params.sort || "recent";

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-white mb-8">
        Threads
      </h1>

      {/* Search + filters */}
      <form className="mb-6">
        <div className="flex gap-3">
          <input
            name="q"
            type="text"
            placeholder="Search threads..."
            defaultValue={params.q ?? ""}
            className="flex-1 rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
          />
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
          >
            Search
          </button>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-3 mt-4">
          <span className="text-xs text-zinc-500">Sort:</span>
          <a
            href={`/threads?sort=recent${params.q ? `&q=${params.q}` : ""}${params.tag ? `&tag=${params.tag}` : ""}`}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              currentSort === "recent"
                ? "bg-zinc-800 text-zinc-200"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Recent
          </a>
          <a
            href={`/threads?sort=unsolved${params.q ? `&q=${params.q}` : ""}${params.tag ? `&tag=${params.tag}` : ""}`}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              currentSort === "unsolved"
                ? "bg-zinc-800 text-zinc-200"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Unsolved
          </a>
        </div>

        {/* Tag filter */}
        {params.tag && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-zinc-500">Tag:</span>
            <span className="text-xs px-2 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">
              {params.tag}
            </span>
            <a
              href={`/threads?sort=${currentSort}${params.q ? `&q=${params.q}` : ""}`}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              clear
            </a>
          </div>
        )}
      </form>

      {/* Thread list */}
      {threads.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-zinc-500 text-sm">
            {params.q
              ? `No threads found for "${params.q}"`
              : "No threads yet. Be the first to ask a question."}
          </p>
        </div>
      ) : (
        <>
        <div className="space-y-2">
          {threads.map((thread) => {
            const answerCount = thread.answers?.[0]?.count ?? 0;
            return (
              <Link
                key={thread.id}
                href={`/threads/${thread.id}`}
                className="block rounded-lg border border-zinc-800/50 bg-zinc-900/30 px-4 py-3 hover:border-zinc-700 hover:bg-zinc-900/50 transition-colors group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-200 group-hover:text-white transition-colors">
                      {thread.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {thread.tags?.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500"
                        >
                          {tag}
                        </span>
                      ))}
                      <span className="text-xs text-zinc-600">
                        {timeAgo(thread.created_at)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-zinc-500">
                      {answerCount} {answerCount === 1 ? "answer" : "answers"}
                    </span>
                    {thread.is_solved && (
                      <span className="text-xs text-green-500 font-medium">
                        solved
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-zinc-800/50">
            <span className="text-xs text-zinc-500">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} threads)
            </span>
            <div className="flex gap-2">
              {pagination.page > 1 && (
                <Link
                  href={`/threads?page=${pagination.page - 1}&sort=${currentSort}${params.q ? `&q=${params.q}` : ""}${params.tag ? `&tag=${params.tag}` : ""}`}
                  className="px-3 py-1.5 text-xs rounded-md border border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-white transition-colors"
                >
                  Previous
                </Link>
              )}
              {pagination.hasMore && (
                <Link
                  href={`/threads?page=${pagination.page + 1}&sort=${currentSort}${params.q ? `&q=${params.q}` : ""}${params.tag ? `&tag=${params.tag}` : ""}`}
                  className="px-3 py-1.5 text-xs rounded-md border border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-white transition-colors"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
        </>
      )}
    </div>
  );
}
