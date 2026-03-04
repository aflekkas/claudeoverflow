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
