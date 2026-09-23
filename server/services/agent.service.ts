import { createAgent, summarizationMiddleware } from 'langchain'
import { ChatOpenAI } from '@langchain/openai'
import { MemorySaver, StateSchema } from '@langchain/langgraph'
import type { BaseMessageLike } from '@langchain/core/messages'
import { getWeatherTool } from '../tools/wearther'
import { z } from 'zod'
import { knowledgeSearchTool } from '../tools/knowLedge'
import { searchSimilar } from './knowLedge.service'

const AGENT_CONTEXT_MAX_TOKENS = 10000
const CONTEXT_COMPRESSION_TRIGGER_TOKENS = Math.floor(
  AGENT_CONTEXT_MAX_TOKENS * 0.8,
)
const CONTEXT_TOKENS_TO_KEEP = Math.floor(AGENT_CONTEXT_MAX_TOKENS * 0.2)

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
    streamUsage: true,
    ...(config.openaiBaseUrl
      ? { configuration: { baseURL: config.openaiBaseUrl } }
      : {}),
  })
}

const createNewAgent = () => {
  const model = createChatModel()

  return createAgent({
    name: 'new-agent',
    description: 'new-agent',
    model,
    tools: [getWeatherTool, knowledgeSearchTool],
    middleware: [
      summarizationMiddleware({
        model,
        trigger: { tokens: CONTEXT_COMPRESSION_TRIGGER_TOKENS },
        keep: { tokens: CONTEXT_TOKENS_TO_KEEP },
        trimTokensToSummarize:
          CONTEXT_COMPRESSION_TRIGGER_TOKENS - CONTEXT_TOKENS_TO_KEEP,
        summaryPrefix: '以下是截至目前的对话摘要：',
      }),
    ],
    systemPrompt: [
      '你是一个有帮助的 AI 助手。',
      '规则：',
      '1. 仅当用户明确询问天气时，才调用 get_weather。',
      '2. 用户消息里若已包含【知识库检索结果】，必须优先依据这些内容回答，不要忽略。',
      '3. 若仍需补充检索，可再调用 knowledge_search。',
      '4. 不要把个人心情/状态问题当成天气问题。',
    ].join('\n'),
    checkpointer: chatMemory,
    stateSchema,
  })
}

/** 一次性调用：适合非流式对话 */
export async function runAgentChat(input: AgentChatInput): Promise<AgentChatResult> {
  const threadId = resolveThreadId(input.threadId)
  const agent = createNewAgent()
  const result = await agent.invoke({
    messages: await buildMessages({ ...input, threadId }),
  }, {
    configurable: { thread_id: threadId },
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
    { messages: await buildMessages({ ...input, threadId }) },
    {
      streamMode: 'messages',
      configurable: { thread_id: threadId },
    },
  )

  for await (const chunk of stream) {
    yield { threadId, chunk }
  }
}
