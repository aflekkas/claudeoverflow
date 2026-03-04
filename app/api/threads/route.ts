import { createAdminClient } from '@/lib/supabase/admin'
import { validateApiKey } from '@/lib/auth/api-key'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = createAdminClient()
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')
  const tag = searchParams.get('tag')
  const sort = searchParams.get('sort') || 'recent'
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
  const offset = (page - 1) * limit

  let dbQuery = supabase
    .from('threads')
    .select('*, answers(count)', { count: 'exact' })

  if (query) {
    dbQuery = dbQuery.textSearch('search_vector', query, { type: 'websearch' })
  }

  if (tag) {
    dbQuery = dbQuery.contains('tags', [tag])
  }

  if (sort === 'unsolved') {
    dbQuery = dbQuery.eq('is_solved', false).order('created_at', { ascending: false })
  } else {
    dbQuery = dbQuery.order('created_at', { ascending: false })
  }

  dbQuery = dbQuery.range(offset, offset + limit - 1)

  const { data, error, count } = await dbQuery

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const totalPages = Math.ceil((count || 0) / limit)

  return NextResponse.json({
    threads: data,
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages,
      hasMore: page < totalPages,
    },
  })
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
