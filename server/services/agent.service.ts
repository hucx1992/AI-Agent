import { createAgent } from 'langchain'
import { ChatOpenAI } from '@langchain/openai'
import { MemorySaver, StateSchema } from '@langchain/langgraph'
import type { BaseMessageLike } from '@langchain/core/messages'
import { getWeatherTool } from '../tools/wearther'
import { weartherPrompt } from '../prompts/wearther'
import { z } from 'zod'

export interface AgentChatInput {
  message: string
  /** 多轮对话时传入历史消息 */
  threadId?: string
  history?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
}

export interface AgentChatResult {
  reply: string
  threadId: string
  messages: unknown[]
}

function buildMessages(input: AgentChatInput): BaseMessageLike[] {
  console.log('buildMessages____________: ', input);
  const history = input.history ?? [];
  // 有 threadId 时由 checkpointer 恢复历史，只传本轮用户消息
  if (input.threadId && !input.history?.length) {
    return [{ role: 'user', content: input.message }]
  }
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
          return block.text ??''
        })
        .join('')
        .trim()
      if (text) return text
    }
  }
  return ''
}
function resolveThreadId(threadId?: string) {
  return threadId?.trim() || crypto.randomUUID()
}

const chatMemory = new MemorySaver();

const stateSchema = new StateSchema({
  userId: z.string().describe('用户ID'),
  userName: z.string().describe('用户姓名'),
});

const createChatModel = () => {
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
    model: config.openaiModel || 'qwen-plus',
    temperature: 0.2,
    ...(config.openaiBaseUrl
      ? { configuration: { baseURL: config.openaiBaseUrl } }
      : {}),
  })
}


const createNewAgent = () => {
  return createAgent({
    name: 'new-agent',
    description: 'new-agent',
    model: createChatModel(),
    tools: [getWeatherTool],
    systemPrompt: '你是一个有帮助的 AI 助手。只有当用户询问天气时，必须调用 get_weather 工具查询。',
    checkpointer: chatMemory,   // 持久化
    stateSchema,
  })
}


/** 一次性调用：适合非流式对话 */
export async function runAgentChat(input: AgentChatInput): Promise<AgentChatResult> {
  const threadId = resolveThreadId(input.threadId)
  const agent = createNewAgent()
  const result = await agent.invoke({
    messages: buildMessages({...input, threadId}),
  }, {
    configurable: { thread_id: threadId }
  })

  const messages = (result.messages ?? []) as Array<{ content?: unknown }>
  return {
    reply: extractReply(messages),
    threadId,
    messages,
  }
}

/** 流式调用：按事件向外抛，由 API 层写成 SSE */
export async function* streamAgentChat(input: AgentChatInput) {
  const threadId = resolveThreadId(input.threadId)
  const agent = createNewAgent()

  const stream = await agent.stream(
    { messages: buildMessages({ ...input, threadId }) },
    {
      streamMode: 'messages',
      configurable: { thread_id: threadId },
    },
  )

  for await (const chunk of stream) {
    yield { threadId, chunk }
  }
}