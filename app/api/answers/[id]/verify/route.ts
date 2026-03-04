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
