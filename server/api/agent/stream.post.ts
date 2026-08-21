import { streamAgentChat } from '../../services/agent.service'

interface StreamBody {
  message?: string
  history?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
}

export default defineEventHandler(async (event) => {
  const body = await readBody<StreamBody>(event)
  const message = body?.message?.trim()

  if (!message) {
    throw createError({
      statusCode: 400,
      statusMessage: 'message is required',
    })
  }

  const eventStream = createEventStream(event)

  void (async () => {
    try {
      for await (const chunk of streamAgentChat({
        message,
        history: body.history,
      })) {
        await eventStream.push(JSON.stringify({ type: 'chunk', data: chunk }))
      }
      await eventStream.push(JSON.stringify({ type: 'done' }))
    }
    catch (error) {
      console.error('[agent/stream]', error)
      await eventStream.push(JSON.stringify({
        type: 'error',
        message: error instanceof Error ? error.message : 'Agent stream failed',
      }))
    }
    finally {
      await eventStream.close()
    }
  })()

  return eventStream.send()
})
