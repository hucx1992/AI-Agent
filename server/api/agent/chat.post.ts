import { runAgentChat } from '../../services/agent.service'

interface ChatBody {
  message?: string
  history?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
}

export default defineEventHandler(async (event) => {
  const body = await readBody<ChatBody>(event)
  const message = body?.message?.trim()

  if (!message) {
    throw createError({
      statusCode: 400,
      statusMessage: 'message is required',
    })
  }

  try {
    const result = await runAgentChat({
      message,
      history: body.history,
    })
    return {
      code: 0,
      data: {
        reply: result.reply,
      },
    }
  }
  catch (error) {
    console.error('[agent/chat]', error)
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Agent chat failed',
    })
  }
})
