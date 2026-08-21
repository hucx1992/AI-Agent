import { createAgent } from 'langchain'
import { ChatOpenAI } from '@langchain/openai'
import type { BaseMessageLike } from '@langchain/core/messages'
import { demoTools } from '../tools/demo.tools'

export interface AgentChatInput {
  message: string
  /** 多轮对话时传入历史消息 */
  history?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
}

export interface AgentChatResult {
  reply: string
  messages: unknown[]
}

function createChatModel() {
  const config = useRuntimeConfig()
  const apiKey = config.openaiApiKey

  if (!apiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Missing NUXT_OPENAI_API_KEY in runtimeConfig',
    })
  }

  return new ChatOpenAI({
    apiKey,
    model: config.openaiModel || 'gpt-4o-mini',
    temperature: 0.2,
    ...(config.openaiBaseUrl
      ? { configuration: { baseURL: config.openaiBaseUrl } }
      : {}),
  })
}

function createAppAgent() {
  return createAgent({
    model: createChatModel(),
    tools: demoTools,
    systemPrompt:
      'You are a helpful AI agent. Use tools when they improve the answer. Reply in the same language as the user.',
  })
}

function buildMessages(input: AgentChatInput): BaseMessageLike[] {
  const history = input.history ?? []
  return [
    ...history.map((item) => ({
      role: item.role,
      content: item.content,
    })),
    { role: 'user' as const, content: input.message },
  ]
}

function extractReply(messages: Array<{ content?: unknown }>): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const content = messages[i]?.content
    if (typeof content === 'string' && content.trim()) {
      return content
    }
    if (Array.isArray(content)) {
      const text = content
        .map((block) => {
          if (typeof block === 'string') return block
          if (block && typeof block === 'object' && 'text' in block) {
            return String((block as { text?: string }).text ?? '')
          }
          return ''
        })
        .join('')
        .trim()
      if (text) return text
    }
  }
  return ''
}

/** 一次性调用：适合非流式对话 */
export async function runAgentChat(input: AgentChatInput): Promise<AgentChatResult> {
  const agent = createAppAgent()
  const result = await agent.invoke({
    messages: buildMessages(input),
  })

  const messages = (result.messages ?? []) as Array<{ content?: unknown }>
  return {
    reply: extractReply(messages),
    messages,
  }
}

/** 流式调用：按事件向外抛，由 API 层写成 SSE */
export async function* streamAgentChat(input: AgentChatInput) {
  const agent = createAppAgent()
  const stream = await agent.stream(
    { messages: buildMessages(input) },
    { streamMode: 'messages' },
  )

  for await (const chunk of stream) {
    yield chunk
  }
}
