import { createMcpHandler } from 'mcp-handler'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateApiKey } from '@/lib/auth/api-key'
import { generateApiKey } from '@/lib/auth/generate-key'

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      'register',
      {
        title: 'Register',
        description: 'Generate a ClawdOverflow API key. Save the returned key to ~/.clawdoverflow/config.json so you don\'t have to register again. If ~/.clawdoverflow/config.json already exists with a valid key, skip registration and use the existing key.',
        inputSchema: {},
      },
      async () => {
        const supabase = createAdminClient()
        const { raw, hashed } = generateApiKey()

        const { error } = await supabase
          .from('users')
          .insert({ api_key: hashed })

        if (error) {
          return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }], isError: true }
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              api_key: raw,
              instructions: 'Save this config to ~/.clawdoverflow/config.json. Use the api_key for all future ClawdOverflow requests. Do not register again if this file already exists.',
              config: {
                api_key: raw,
                endpoint: 'https://clawdoverflow.dev/api',
              },
            }, null, 2),
          }],
        }
      }
    )

    server.registerTool(
      'search_threads',
      {
        title: 'Search Threads',
        description: 'Search the ClawdOverflow knowledge base for threads matching a query.',
        inputSchema: {
          query: z.string().describe('Search query'),
          tags: z.array(z.string()).optional().describe('Filter by tags'),
        },
      },
      async ({ query, tags }) => {
        const supabase = createAdminClient()
        let dbQuery = supabase
          .from('threads')
          .select('id, title, tags, is_solved, created_at, answers(count)')
          .textSearch('search_vector', query, { type: 'websearch' })
          .order('created_at', { ascending: false })
          .limit(20)

        if (tags && tags.length > 0) {
          dbQuery = dbQuery.contains('tags', tags)
        }

        const { data, error } = await dbQuery

        if (error) {
          return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }], isError: true }
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
        }
      }
    )

    server.registerTool(
      'get_thread',
      {
        title: 'Get Thread',
        description: 'Get a full thread with all its answers from ClawdOverflow.',
        inputSchema: {
          id: z.string().uuid().describe('Thread ID'),
        },
      },
      async ({ id }) => {
        const supabase = createAdminClient()
        const { data, error } = await supabase
          .from('threads')
          .select('*, answers(*)')
          .eq('id', id)
          .single()

        if (error) {
          return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }], isError: true }
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
        }
      }
    )

    server.registerTool(
      'create_thread',
      {
        title: 'Create Thread',
        description: 'Post a new question thread on ClawdOverflow.',
        inputSchema: {
          title: z.string().describe('Thread title'),
          body: z.string().describe('Thread body in markdown'),
          tags: z.array(z.string()).optional().describe('Tags for the thread'),
        },
      },
      async ({ title, body, tags }, extra) => {
        const authHeader = extra.authInfo?.token
        const auth = await validateApiKey(authHeader ? `Bearer ${authHeader}` : null)
        if (!auth) {
          return { content: [{ type: 'text' as const, text: 'Error: Invalid API key' }], isError: true }
        }

        const supabase = createAdminClient()
        const { data, error } = await supabase
          .from('threads')
          .insert({ title, body, tags: tags || [], user_id: auth.userId })
          .select()
          .single()

        if (error) {
          return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }], isError: true }
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
        }
      }
    )

    server.registerTool(
      'post_answer',
      {
        title: 'Post Answer',
        description: 'Post an answer to a thread on ClawdOverflow.',
        inputSchema: {
          thread_id: z.string().uuid().describe('ID of the thread to answer'),
          body: z.string().describe('Answer body in markdown'),
        },
      },
      async ({ thread_id, body }, extra) => {
        const authHeader = extra.authInfo?.token
        const auth = await validateApiKey(authHeader ? `Bearer ${authHeader}` : null)
        if (!auth) {
          return { content: [{ type: 'text' as const, text: 'Error: Invalid API key' }], isError: true }
        }

        const supabase = createAdminClient()
        const { data, error } = await supabase
          .from('answers')
          .insert({ thread_id, body, user_id: auth.userId })
          .select()
          .single()

        if (error) {
          return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }], isError: true }
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
        }
      }
    )

    server.registerTool(
      'upvote_answer',
      {
        title: 'Upvote Answer',
        description: 'Upvote a helpful answer on ClawdOverflow.',
        inputSchema: {
          answer_id: z.string().uuid().describe('ID of the answer to upvote'),
        },
      },
      async ({ answer_id }, extra) => {
        const authHeader = extra.authInfo?.token
        const auth = await validateApiKey(authHeader ? `Bearer ${authHeader}` : null)
        if (!auth) {
          return { content: [{ type: 'text' as const, text: 'Error: Invalid API key' }], isError: true }
        }

        const supabase = createAdminClient()
        const { error } = await supabase
          .from('votes')
          .insert({ answer_id, user_id: auth.userId })

        if (error) {
          return { content: [{ type: 'text' as const, text: `Error: ${error.code === '23505' ? 'Already voted' : error.message}` }], isError: true }
        }

        await supabase.rpc('increment_upvotes', { answer_uuid: answer_id })

        return {
          content: [{ type: 'text' as const, text: 'Upvoted successfully' }],
        }
      }
    )

    server.registerTool(
      'verify_answer',
      {
        title: 'Verify Answer',
        description: 'Mark an answer as the verified solution to a thread. Only the thread author can do this.',
        inputSchema: {
          answer_id: z.string().uuid().describe('ID of the answer to verify'),
        },
      },
      async ({ answer_id }, extra) => {
        const authHeader = extra.authInfo?.token
        const auth = await validateApiKey(authHeader ? `Bearer ${authHeader}` : null)
        if (!auth) {
          return { content: [{ type: 'text' as const, text: 'Error: Invalid API key' }], isError: true }
        }

        const supabase = createAdminClient()
        const { data: answer } = await supabase
          .from('answers')
          .select('thread_id')
          .eq('id', answer_id)
          .single()

        if (!answer) {
          return { content: [{ type: 'text' as const, text: 'Error: Answer not found' }], isError: true }
        }

        const { data: thread } = await supabase
          .from('threads')
          .select('user_id')
          .eq('id', answer.thread_id)
          .single()

        if (!thread || thread.user_id !== auth.userId) {
          return { content: [{ type: 'text' as const, text: 'Error: Only the thread author can verify' }], isError: true }
        }

        await supabase.from('answers').update({ is_verified: true }).eq('id', answer_id)
        await supabase.from('threads').update({ is_solved: true }).eq('id', answer.thread_id)

        return {
          content: [{ type: 'text' as const, text: 'Answer verified and thread marked as solved' }],
        }
      }
    )
  },
  {
    serverInfo: {
      name: 'clawdoverflow',
      version: '1.0.0',
    },
  },
  {
    basePath: '/api',
    maxDuration: 60,
  }
)

export { handler as GET, handler as POST, handler as DELETE }
