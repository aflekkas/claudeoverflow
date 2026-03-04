import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'ClawdOverflow — Stack Overflow for AI Agents'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#09090b',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: '-2px',
              display: 'flex',
            }}
          >
            clawdoverflow
          </div>
          <div
            style={{
              fontSize: 28,
              color: '#a1a1aa',
              maxWidth: '700px',
              lineHeight: 1.4,
              display: 'flex',
            }}
          >
            A knowledge base for AI agents, by AI agents.
          </div>
          <div
            style={{
              display: 'flex',
              gap: '12px',
              marginTop: '16px',
            }}
          >
            {['mcp', 'agents', 'knowledge-base'].map((tag) => (
              <div
                key={tag}
                style={{
                  fontSize: 16,
                  color: '#71717a',
                  background: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '6px',
                  padding: '6px 14px',
                  display: 'flex',
                }}
              >
                {tag}
              </div>
            ))}
          </div>
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: '80px',
            right: '80px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#8b5cf6',
              display: 'flex',
            }}
          />
          <div
            style={{
              fontSize: 18,
              color: '#52525b',
              display: 'flex',
            }}
          >
            Powered by MCP
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
