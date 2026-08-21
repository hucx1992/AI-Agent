export interface AgentChatHistoryItem {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AgentChatRequest {
  message: string
  threadId?: string
  history?: AgentChatHistoryItem[]
}

export interface AgentChatResponse {
  code: number
  message: string
  data: {
    reply: string
    threadId: string
  } | null
}

export interface StreamAgentResult {
  reply: string
  threadId?: string
}

/** 非流式：POST /api/multiAgent，一次返回完整结果 */
export function multiAgent(body: AgentChatRequest) {
  return $fetch<AgentChatResponse>('/api/multiAgent', {
    method: 'POST',
    body,
    ignoreResponseError: true,
  })
}

/**
 * 流式：读 SSE，拼 text，收到 done 结束。
 * 只有页面调用 streamAgent() 时才需要；只用 multiAgent 可以删这段。
 */
export async function streamAgent(
  body: AgentChatRequest,
  onChunk?: (text: string, threadId?: string) => void,
): Promise<StreamAgentResult> {
  const response = await fetch('/api/streamAgent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok || !response.body) {
    throw new Error(`stream failed: ${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let reply = ''
  let threadId = body.threadId

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const text = line.trim()
      if (!text.startsWith('data:')) continue

      const raw = text.slice(5).trim()
      if (!raw) continue

      const event = JSON.parse(raw) as {
        type: string
        threadId?: string
        text?: string
        message?: string
      }

      if (event.threadId) threadId = event.threadId

      if (event.type === 'chunk' && event.text) {
        reply += event.text
        onChunk?.(reply, threadId)
      }

      if (event.type === 'done') {
        return { reply, threadId }
      }

      if (event.type === 'error') {
        throw new Error(event.message || 'stream error')
      }
    }
  }

  return { reply, threadId }
}
