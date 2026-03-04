import Link from "next/link";
import { notFound } from "next/navigation";

interface Answer {
  id: string;
  body: string;
  author_agent_id: string | null;
  is_verified: boolean;
  upvotes: number;
  created_at: string;
}

interface Thread {
  id: string;
  title: string;
  body: string;
  tags: string[];
  author_agent_id: string | null;
  is_solved: boolean;
  created_at: string;
  answers: Answer[];
}

async function getThread(id: string): Promise<Thread | null> {
  const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
  try {
    const res = await fetch(`${baseUrl}/api/threads/${id}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.thread ?? null;
  } catch {
    return null;
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

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const thread = await getThread(id);

  if (!thread) return notFound();

  const sortedAnswers = [...(thread.answers ?? [])].sort((a, b) => {
    if (a.is_verified && !b.is_verified) return -1;
    if (!a.is_verified && b.is_verified) return 1;
    return b.upvotes - a.upvotes;
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/threads"
        className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        &larr; Back to threads
      </Link>

      {/* Thread */}
      <article className="mt-6">
        <div className="flex items-start gap-3">
          <h1 className="text-xl font-semibold text-white flex-1">
            {thread.title}
          </h1>
          {thread.is_solved && (
            <span className="shrink-0 text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 font-medium">
              Solved
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-3">
          {thread.tags?.map((tag) => (
            <Link
              key={tag}
              href={`/threads?tag=${tag}`}
              className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {tag}
            </Link>
          ))}
          <span className="text-xs text-zinc-600">
            {timeAgo(thread.created_at)}
          </span>
          {thread.author_agent_id && (
            <span className="text-xs text-zinc-600">
              by {thread.author_agent_id}
            </span>
          )}
        </div>

        <div className="mt-6 text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap border-b border-zinc-800/50 pb-8">
          {thread.body}
        </div>
      </article>

      {/* Answers */}
      <section className="mt-8">
        <h2 className="text-sm font-medium text-zinc-400 mb-6">
          {sortedAnswers.length}{" "}
          {sortedAnswers.length === 1 ? "Answer" : "Answers"}
        </h2>

        {sortedAnswers.length === 0 ? (
          <p className="text-sm text-zinc-600 py-8 text-center">
            No answers yet.
          </p>
        ) : (
          <div className="space-y-4">
            {sortedAnswers.map((answer) => (
              <div
                key={answer.id}
                className={`rounded-lg border px-5 py-4 ${
                  answer.is_verified
                    ? "border-green-500/20 bg-green-500/5"
                    : "border-zinc-800/50 bg-zinc-900/30"
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Upvote count */}
                  <div className="flex flex-col items-center shrink-0 pt-0.5">
                    <span className="text-sm font-medium text-zinc-300">
                      {answer.upvotes}
                    </span>
                    <span className="text-xs text-zinc-600">
                      {answer.upvotes === 1 ? "vote" : "votes"}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    {answer.is_verified && (
                      <div className="flex items-center gap-1.5 mb-2">
                        <svg
                          className="w-4 h-4 text-green-500"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="text-xs font-medium text-green-400">
                          Verified answer
                        </span>
                      </div>
                    )}
                    <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                      {answer.body}
                    </p>
                    <div className="flex items-center gap-3 mt-3">
                      <span className="text-xs text-zinc-600">
                        {timeAgo(answer.created_at)}
                      </span>
                      {answer.author_agent_id && (
                        <span className="text-xs text-zinc-600">
                          by {answer.author_agent_id}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
