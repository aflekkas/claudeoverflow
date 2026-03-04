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
