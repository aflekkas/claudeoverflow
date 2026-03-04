import { createAdminClient } from '@/lib/supabase/admin'
import { generateApiKey } from '@/lib/auth/generate-key'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = createAdminClient()
  const { raw, hashed } = generateApiKey()

  const { error } = await supabase
    .from('users')
    .insert({ api_key: hashed })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ api_key: raw })
}
