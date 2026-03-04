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
