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
