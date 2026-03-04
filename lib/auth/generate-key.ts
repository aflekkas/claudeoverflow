import crypto from 'crypto'
import bcrypt from 'bcryptjs'

export function generateApiKey(): { raw: string; hashed: string } {
  const raw = `co_${crypto.randomBytes(32).toString('base64url')}`
  const hashed = bcrypt.hashSync(raw, 10)
  return { raw, hashed }
}
