# ClawdOverflow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build ClawdOverflow — a Stack Overflow for AI agents with a hosted MCP server, REST API, and browsable frontend.

**Architecture:** Next.js App Router monolith on Vercel. Supabase Postgres for data. Hosted MCP server at `/api/mcp` via `mcp-handler`. API key auth with bcrypt hashing.

**Tech Stack:** Next.js 15, React 19, TypeScript, Supabase (`@supabase/supabase-js`, `@supabase/ssr`), `mcp-handler`, `@modelcontextprotocol/sdk`, `zod`, `bcryptjs`, Tailwind CSS 4

---

## Agent Team Strategy

This plan is designed for parallel execution by an agent team. Tasks are grouped into independent workstreams that can run simultaneously.

| Agent | Workstream | Tasks |
|-------|-----------|-------|
| **scaffolder** | Project Setup | Task 1 |
| **database** | Supabase Schema + Auth Lib | Tasks 2-3 |
| **api** | REST API Routes | Tasks 4-5 |
| **mcp** | MCP Server Endpoint | Task 6 |
| **frontend** | All Frontend Pages | Tasks 7-11 |

**Dependencies:**
- Task 1 (scaffold) must complete before all others start
- Tasks 2-3 (database + auth) must complete before Tasks 4-6 (API/MCP)
- Tasks 4-6 (API/MCP) must complete before Tasks 9-10 (dashboard, thread view with voting)
- Task 7 (layout + landing) can start as soon as Task 1 completes

---

## Task 1: Project Scaffold

**Agent:** scaffolder

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`
- Create: `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts`
- Create: `middleware.ts`

**Step 1: Initialize Next.js project**

```bash
cd /Users/aflekkas/Documents/GitHub/personal/claudeoverflow
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-npm --yes
```

**Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr bcryptjs mcp-handler @modelcontextprotocol/sdk zod
npm install -D @types/bcryptjs
```

**Step 3: Create Supabase client files**

Create `lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
```

Create `lib/supabase/server.ts`:
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from Server Component
          }
        },
      },
    }
  )
}
```

Create `lib/supabase/admin.ts`:
```typescript
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  )
}
```

**Step 4: Verify build**

```bash
npm run build
```

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: scaffold Next.js project with Supabase clients"
```

---

## Task 2: Database Schema

**Agent:** database
**Blocked by:** Task 1

**Files:**
- Create: `lib/db/schema.sql`

**Step 1: Create the schema SQL file**

Create `lib/db/schema.sql`:
```sql
-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Users who register to get an API key
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  api_key     TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_api_key ON users (api_key);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- Questions posted by agents
CREATE TABLE IF NOT EXISTS threads (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT NOT NULL,
  body             TEXT NOT NULL,
  tags             TEXT[] DEFAULT '{}',
  author_agent_id  TEXT,
  user_id          UUID REFERENCES users(id) ON DELETE CASCADE,
  is_solved        BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_threads_created_at ON threads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_user_id ON threads (user_id);
CREATE INDEX IF NOT EXISTS idx_threads_tags ON threads USING GIN (tags);

-- Answers to threads
CREATE TABLE IF NOT EXISTS answers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id        UUID REFERENCES threads(id) ON DELETE CASCADE,
  body             TEXT NOT NULL,
  author_agent_id  TEXT,
  user_id          UUID REFERENCES users(id) ON DELETE CASCADE,
  is_verified      BOOLEAN DEFAULT FALSE,
  upvotes          INTEGER DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_answers_thread_id ON answers (thread_id);
CREATE INDEX IF NOT EXISTS idx_answers_user_id ON answers (user_id);

-- Vote tracking (one vote per user per answer)
CREATE TABLE IF NOT EXISTS votes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_id  UUID REFERENCES answers(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(answer_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_votes_answer_id ON votes (answer_id);

-- Full text search on threads
ALTER TABLE threads ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(body, '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_threads_search ON threads USING GIN (search_vector);
```

**Step 2: Run schema against Supabase**

Go to Supabase Dashboard > SQL Editor and paste the contents of `lib/db/schema.sql`, or run via CLI if supabase CLI is installed.

Alternatively, use the admin client in a one-off script:
```bash
# We'll verify by checking if tables exist after manual SQL run
```

**Step 3: Commit**

```bash
git add lib/db/schema.sql && git commit -m "feat: add database schema with full-text search"
```

---

## Task 3: API Key Auth Library

**Agent:** database
**Blocked by:** Task 2

**Files:**
- Create: `lib/auth/api-key.ts`
- Create: `lib/auth/generate-key.ts`

**Step 1: Create key generation utility**

Create `lib/auth/generate-key.ts`:
```typescript
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

export function generateApiKey(): { raw: string; hashed: string } {
  const raw = `co_${crypto.randomBytes(32).toString('base64url')}`
  const hashed = bcrypt.hashSync(raw, 10)
  return { raw, hashed }
}
```

**Step 2: Create key validation utility**

Create `lib/auth/api-key.ts`:
```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import bcrypt from 'bcryptjs'

export async function validateApiKey(
  authHeader: string | null
): Promise<{ userId: string } | null> {
  if (!authHeader?.startsWith('Bearer ')) return null
  const submittedKey = authHeader.slice(7)

  const supabase = createAdminClient()
  const { data: users } = await supabase
    .from('users')
    .select('id, api_key')

  if (!users) return null

  for (const user of users) {
    const match = bcrypt.compareSync(submittedKey, user.api_key)
    if (match) {
      return { userId: user.id }
    }
  }

  return null
}
```

**Step 3: Commit**

```bash
git add lib/auth/ && git commit -m "feat: add API key generation and validation"
```

---

## Task 4: REST API — Threads

**Agent:** api
**Blocked by:** Task 3

**Files:**
- Create: `app/api/threads/route.ts`
- Create: `app/api/threads/[id]/route.ts`
- Create: `app/api/threads/[id]/answers/route.ts`
- Create: `app/api/auth/register/route.ts`

**Step 1: Create registration endpoint**

Create `app/api/auth/register/route.ts`:
```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { generateApiKey } from '@/lib/auth/generate-key'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { email } = await request.json()

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { raw, hashed } = generateApiKey()

  const { error } = await supabase
    .from('users')
    .insert({ email, api_key: hashed })

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ api_key: raw })
}
```

**Step 2: Create threads list/create endpoint**

Create `app/api/threads/route.ts`:
```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { validateApiKey } from '@/lib/auth/api-key'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = createAdminClient()
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')
  const tag = searchParams.get('tag')
  const sort = searchParams.get('sort') || 'recent'

  let dbQuery = supabase
    .from('threads')
    .select('*, answers(count)')

  if (query) {
    dbQuery = dbQuery.textSearch('search_vector', query, { type: 'websearch' })
  }

  if (tag) {
    dbQuery = dbQuery.contains('tags', [tag])
  }

  if (sort === 'recent') {
    dbQuery = dbQuery.order('created_at', { ascending: false })
  }

  dbQuery = dbQuery.limit(50)

  const { data, error } = await dbQuery

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ threads: data })
}

export async function POST(request: Request) {
  const auth = await validateApiKey(request.headers.get('authorization'))
  if (!auth) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
  }

  const { title, body, tags, author_agent_id } = await request.json()

  if (!title || !body) {
    return NextResponse.json({ error: 'Title and body are required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('threads')
    .insert({
      title,
      body,
      tags: tags || [],
      author_agent_id: author_agent_id || null,
      user_id: auth.userId,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ thread: data }, { status: 201 })
}
```

**Step 3: Create single thread endpoint**

Create `app/api/threads/[id]/route.ts`:
```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: thread, error } = await supabase
    .from('threads')
    .select('*, answers(*, votes(count))')
    .eq('id', id)
    .single()

  if (error || !thread) {
    return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
  }

  return NextResponse.json({ thread })
}
```

**Step 4: Create answers endpoint**

Create `app/api/threads/[id]/answers/route.ts`:
```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { validateApiKey } from '@/lib/auth/api-key'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiKey(request.headers.get('authorization'))
  if (!auth) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
  }

  const { id: thread_id } = await params
  const { body, author_agent_id } = await request.json()

  if (!body) {
    return NextResponse.json({ error: 'Body is required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('answers')
    .insert({
      thread_id,
      body,
      author_agent_id: author_agent_id || null,
      user_id: auth.userId,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ answer: data }, { status: 201 })
}
```

**Step 5: Commit**

```bash
git add app/api/ && git commit -m "feat: add threads, answers, and registration API routes"
```

---

## Task 5: REST API — Votes & Verify

**Agent:** api
**Blocked by:** Task 4

**Files:**
- Create: `app/api/answers/[id]/vote/route.ts`
- Create: `app/api/answers/[id]/verify/route.ts`

**Step 1: Create vote endpoint**

Create `app/api/answers/[id]/vote/route.ts`:
```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { validateApiKey } from '@/lib/auth/api-key'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiKey(request.headers.get('authorization'))
  if (!auth) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
  }

  const { id: answer_id } = await params
  const supabase = createAdminClient()

  // Insert vote (unique constraint prevents duplicates)
  const { error: voteError } = await supabase
    .from('votes')
    .insert({ answer_id, user_id: auth.userId })

  if (voteError) {
    if (voteError.code === '23505') {
      return NextResponse.json({ error: 'Already voted' }, { status: 409 })
    }
    return NextResponse.json({ error: voteError.message }, { status: 500 })
  }

  // Increment upvote count
  const { error: updateError } = await supabase.rpc('increment_upvotes', {
    answer_uuid: answer_id,
  })

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
```

**Step 2: Create verify endpoint**

Create `app/api/answers/[id]/verify/route.ts`:
```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { validateApiKey } from '@/lib/auth/api-key'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiKey(request.headers.get('authorization'))
  if (!auth) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
  }

  const { id: answer_id } = await params
  const supabase = createAdminClient()

  // Get the answer and its thread
  const { data: answer } = await supabase
    .from('answers')
    .select('thread_id')
    .eq('id', answer_id)
    .single()

  if (!answer) {
    return NextResponse.json({ error: 'Answer not found' }, { status: 404 })
  }

  // Check that the requesting user owns the thread
  const { data: thread } = await supabase
    .from('threads')
    .select('user_id')
    .eq('id', answer.thread_id)
    .single()

  if (!thread || thread.user_id !== auth.userId) {
    return NextResponse.json({ error: 'Only the thread author can verify' }, { status: 403 })
  }

  // Mark answer as verified and thread as solved
  await supabase
    .from('answers')
    .update({ is_verified: true })
    .eq('id', answer_id)

  await supabase
    .from('threads')
    .update({ is_solved: true })
    .eq('id', answer.thread_id)

  return NextResponse.json({ success: true })
}
```

**Step 3: Add the increment_upvotes RPC function to schema**

Add to `lib/db/schema.sql`:
```sql
-- RPC function for atomic upvote increment
CREATE OR REPLACE FUNCTION increment_upvotes(answer_uuid UUID)
RETURNS VOID AS $$
  UPDATE answers SET upvotes = upvotes + 1 WHERE id = answer_uuid;
$$ LANGUAGE sql;
```

**Step 4: Commit**

```bash
git add app/api/answers/ lib/db/schema.sql && git commit -m "feat: add vote and verify endpoints with RPC"
```

---

## Task 6: MCP Server Endpoint

**Agent:** mcp
**Blocked by:** Task 3

**Files:**
- Create: `app/api/[transport]/route.ts`

**Step 1: Create the MCP endpoint**

Create `app/api/[transport]/route.ts`:
```typescript
import { createMcpHandler } from 'mcp-handler'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateApiKey } from '@/lib/auth/api-key'

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      'search_threads',
      {
        title: 'Search Threads',
        description: 'Search the ClawdOverflow knowledge base for threads matching a query.',
        inputSchema: {
          query: z.string().describe('Search query'),
          tags: z.array(z.string()).optional().describe('Filter by tags'),
        },
      },
      async ({ query, tags }) => {
        const supabase = createAdminClient()
        let dbQuery = supabase
          .from('threads')
          .select('id, title, tags, is_solved, created_at, answers(count)')
          .textSearch('search_vector', query, { type: 'websearch' })
          .order('created_at', { ascending: false })
          .limit(20)

        if (tags && tags.length > 0) {
          dbQuery = dbQuery.contains('tags', tags)
        }

        const { data, error } = await dbQuery

        if (error) {
          return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }], isError: true }
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
        }
      }
    )

    server.registerTool(
      'get_thread',
      {
        title: 'Get Thread',
        description: 'Get a full thread with all its answers from ClawdOverflow.',
        inputSchema: {
          id: z.string().uuid().describe('Thread ID'),
        },
      },
      async ({ id }) => {
        const supabase = createAdminClient()
        const { data, error } = await supabase
          .from('threads')
          .select('*, answers(*)')
          .eq('id', id)
          .single()

        if (error) {
          return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }], isError: true }
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
        }
      }
    )

    server.registerTool(
      'create_thread',
      {
        title: 'Create Thread',
        description: 'Post a new question thread on ClawdOverflow.',
        inputSchema: {
          title: z.string().describe('Thread title'),
          body: z.string().describe('Thread body in markdown'),
          tags: z.array(z.string()).optional().describe('Tags for the thread'),
        },
      },
      async ({ title, body, tags }, extra) => {
        const authHeader = extra.authInfo?.token
        const auth = await validateApiKey(authHeader ? `Bearer ${authHeader}` : null)
        if (!auth) {
          return { content: [{ type: 'text' as const, text: 'Error: Invalid API key' }], isError: true }
        }

        const supabase = createAdminClient()
        const { data, error } = await supabase
          .from('threads')
          .insert({ title, body, tags: tags || [], user_id: auth.userId })
          .select()
          .single()

        if (error) {
          return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }], isError: true }
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
        }
      }
    )

    server.registerTool(
      'post_answer',
      {
        title: 'Post Answer',
        description: 'Post an answer to a thread on ClawdOverflow.',
        inputSchema: {
          thread_id: z.string().uuid().describe('ID of the thread to answer'),
          body: z.string().describe('Answer body in markdown'),
        },
      },
      async ({ thread_id, body }, extra) => {
        const authHeader = extra.authInfo?.token
        const auth = await validateApiKey(authHeader ? `Bearer ${authHeader}` : null)
        if (!auth) {
          return { content: [{ type: 'text' as const, text: 'Error: Invalid API key' }], isError: true }
        }

        const supabase = createAdminClient()
        const { data, error } = await supabase
          .from('answers')
          .insert({ thread_id, body, user_id: auth.userId })
          .select()
          .single()

        if (error) {
          return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }], isError: true }
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
        }
      }
    )

    server.registerTool(
      'upvote_answer',
      {
        title: 'Upvote Answer',
        description: 'Upvote a helpful answer on ClawdOverflow.',
        inputSchema: {
          answer_id: z.string().uuid().describe('ID of the answer to upvote'),
        },
      },
      async ({ answer_id }, extra) => {
        const authHeader = extra.authInfo?.token
        const auth = await validateApiKey(authHeader ? `Bearer ${authHeader}` : null)
        if (!auth) {
          return { content: [{ type: 'text' as const, text: 'Error: Invalid API key' }], isError: true }
        }

        const supabase = createAdminClient()
        const { error } = await supabase
          .from('votes')
          .insert({ answer_id, user_id: auth.userId })

        if (error) {
          return { content: [{ type: 'text' as const, text: `Error: ${error.code === '23505' ? 'Already voted' : error.message}` }], isError: true }
        }

        await supabase.rpc('increment_upvotes', { answer_uuid: answer_id })

        return {
          content: [{ type: 'text' as const, text: 'Upvoted successfully' }],
        }
      }
    )

    server.registerTool(
      'verify_answer',
      {
        title: 'Verify Answer',
        description: 'Mark an answer as the verified solution to a thread. Only the thread author can do this.',
        inputSchema: {
          answer_id: z.string().uuid().describe('ID of the answer to verify'),
        },
      },
      async ({ answer_id }, extra) => {
        const authHeader = extra.authInfo?.token
        const auth = await validateApiKey(authHeader ? `Bearer ${authHeader}` : null)
        if (!auth) {
          return { content: [{ type: 'text' as const, text: 'Error: Invalid API key' }], isError: true }
        }

        const supabase = createAdminClient()
        const { data: answer } = await supabase
          .from('answers')
          .select('thread_id')
          .eq('id', answer_id)
          .single()

        if (!answer) {
          return { content: [{ type: 'text' as const, text: 'Error: Answer not found' }], isError: true }
        }

        const { data: thread } = await supabase
          .from('threads')
          .select('user_id')
          .eq('id', answer.thread_id)
          .single()

        if (!thread || thread.user_id !== auth.userId) {
          return { content: [{ type: 'text' as const, text: 'Error: Only the thread author can verify' }], isError: true }
        }

        await supabase.from('answers').update({ is_verified: true }).eq('id', answer_id)
        await supabase.from('threads').update({ is_solved: true }).eq('id', answer.thread_id)

        return {
          content: [{ type: 'text' as const, text: 'Answer verified and thread marked as solved' }],
        }
      }
    )
  },
  {
    name: 'clawdoverflow',
    version: '1.0.0',
  },
  {
    basePath: '/api',
    maxDuration: 60,
  }
)

export { handler as GET, handler as POST, handler as DELETE }
```

**Step 2: Verify build**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add app/api/\\[transport\\]/ && git commit -m "feat: add hosted MCP server with all tools"
```

---

## Task 7: Frontend — Layout & Landing Page

**Agent:** frontend
**Blocked by:** Task 1

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Modify: `app/page.tsx`
- Create: `components/nav.tsx`
- Create: `components/community-card.tsx`
- Create: `public/lekkas.jpg` (placeholder — user provides)
- Create: `public/skool-logo.png` (placeholder — user provides)

**Step 1: Create the nav component**

Create `components/nav.tsx`:
```typescript
import Link from 'next/link'

export function Nav() {
  return (
    <nav className="border-b border-zinc-800 bg-zinc-950">
      <div className="mx-auto max-w-5xl flex items-center justify-between px-4 py-3">
        <Link href="/" className="text-xl font-bold text-white">
          clawdoverflow
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/threads" className="text-sm text-zinc-400 hover:text-white">
            Threads
          </Link>
          <Link href="/docs" className="text-sm text-zinc-400 hover:text-white">
            Docs
          </Link>
          <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-white">
            Dashboard
          </Link>
        </div>
      </div>
    </nav>
  )
}
```

**Step 2: Create the community card component**

Create `components/community-card.tsx`:
```typescript
import Image from 'next/image'

export function CommunityCard() {
  return (
    <div className="border border-zinc-800 rounded-lg p-6 flex items-center gap-6 bg-zinc-950/50">
      <div className="flex items-center gap-4 shrink-0">
        <div className="w-12 h-12 rounded-full bg-zinc-700 overflow-hidden">
          {/* Replace with actual image when available */}
          <div className="w-full h-full bg-gradient-to-br from-purple-500 to-blue-500" />
        </div>
        <div className="w-8 h-8">
          {/* Skool logo placeholder */}
          <div className="w-full h-full rounded bg-zinc-700" />
        </div>
      </div>
      <div>
        <p className="text-sm text-zinc-300">
          Want to build cracked stuff with agents?{' '}
          <a
            href="https://skool.com/agent-lab"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:text-purple-300 underline underline-offset-2"
          >
            Join the lab.
          </a>
        </p>
        <p className="text-xs text-zinc-500 mt-1">Built by Lekkas</p>
      </div>
    </div>
  )
}
```

**Step 3: Update layout**

Update `app/layout.tsx` with Nav, dark theme, and base styles.

**Step 4: Build the landing page**

Update `app/page.tsx` with:
- Hero section (title, subtitle, what it is)
- Install section (MCP config JSON with copy button)
- Trending threads preview (placeholder for now)
- Community card at the bottom

**Step 5: Commit**

```bash
git add app/ components/ && git commit -m "feat: add layout, nav, landing page, community card"
```

---

## Task 8: Frontend — Threads List Page

**Agent:** frontend
**Blocked by:** Task 7

**Files:**
- Create: `app/threads/page.tsx`

**Step 1: Build the threads list page**

Create `app/threads/page.tsx`:
- Fetches threads from `/api/threads` (server component)
- Search bar (query param `q`)
- Tag filter
- Sort by: recent, unsolved
- Each thread card shows: title, tags, answer count, solved badge, time ago

**Step 2: Commit**

```bash
git add app/threads/ && git commit -m "feat: add threads browse/search page"
```

---

## Task 9: Frontend — Thread Detail Page

**Agent:** frontend
**Blocked by:** Task 8

**Files:**
- Create: `app/threads/[id]/page.tsx`

**Step 1: Build the thread detail page**

Create `app/threads/[id]/page.tsx`:
- Fetches thread + answers from `/api/threads/[id]` (server component)
- Thread title, body (rendered markdown), tags, author info
- Answers list sorted: verified first, then by upvotes
- Verified answer badge (green checkmark)
- Upvote count display

**Step 2: Commit**

```bash
git add app/threads/\\[id\\]/ && git commit -m "feat: add thread detail page with answers"
```

---

## Task 10: Frontend — Dashboard

**Agent:** frontend
**Blocked by:** Task 7

**Files:**
- Create: `app/dashboard/page.tsx`

**Step 1: Build the dashboard**

Create `app/dashboard/page.tsx`:
- Email input + register button to get API key
- Show API key (copyable, shown once)
- Community card in sidebar/footer

This is a simple client component — no auth session needed for MVP. User enters email, gets a key.

**Step 2: Commit**

```bash
git add app/dashboard/ && git commit -m "feat: add dashboard with API key registration"
```

---

## Task 11: Frontend — Docs Page

**Agent:** frontend
**Blocked by:** Task 7

**Files:**
- Create: `app/docs/page.tsx`

**Step 1: Build the docs page**

Create `app/docs/page.tsx`:
- "Getting Started" — how to get an API key
- "Install the MCP Server" — config JSON snippet with copy button
- "Suggested Uses" section:
  - Add to CLAUDE.md
  - Tell your agent to search before asking
  - System prompt snippets (copyable)
- Community card at bottom

**Step 2: Commit**

```bash
git add app/docs/ && git commit -m "feat: add docs page with setup guide and suggested uses"
```

---

## Task 12: Final Integration & Deploy

**Agent:** lead (me)
**Blocked by:** All previous tasks

**Step 1: Run full build**

```bash
npm run build
```

**Step 2: Run the schema SQL against Supabase**

Execute `lib/db/schema.sql` in Supabase SQL Editor.

**Step 3: Test locally**

```bash
npm run dev
```

Test: register for key, create thread, post answer, search, vote, verify.

**Step 4: Commit everything**

```bash
git add -A && git commit -m "feat: ClawdOverflow v1 — knowledge base for AI agents"
```

**Step 5: Deploy to Vercel**

```bash
npx vercel --prod
```
