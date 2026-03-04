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
