import { headers } from 'next/headers'

export function getSiteUrl(): string {
  // On Vercel, VERCEL_URL is auto-set (e.g. "my-app.vercel.app")
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return 'http://localhost:3000'
}

export async function getSiteUrlFromHeaders(): Promise<string> {
  const h = await headers()
  const host = h.get('host') || 'localhost:3000'
  const proto = h.get('x-forwarded-proto') || 'http'
  return `${proto}://${host}`
}
