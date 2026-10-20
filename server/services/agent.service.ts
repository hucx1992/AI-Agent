import { createAgent, summarizationMiddleware } from 'langchain'
import { ChatOpenAI } from '@langchain/openai'
import { MemorySaver, StateSchema } from '@langchain/langgraph'
import type { BaseMessageLike } from '@langchain/core/messages'
import { getWeatherTool } from '../tools/wearther'
import { z } from 'zod'
import { knowledgeSearchTool } from '../tools/knowLedge'
import { searchSimilar } from './knowLedge.service'
import { classifyIntent, type IntentResult } from './intent.service'

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
  intent: IntentResult
}

async function buildMessages(
  input: AgentChatInput,
  intent?: IntentResult,
): Promise<BaseMessageLike[]> {
  const history = input.history ?? [];
  let content = input.message
  if (intent?.intent === 'knowledge') {
    const hits = await searchSimilar(intent.query || input.message, { topK: 3 })
    if (hits.length) {
      content = [
        '【知识库检索结果】（已按相关度打分，取 topK）',
        ...hits.map((hit) => `${hit.rank}. [相关度 ${hit.score}] ${hit.content}`),
        '',
        `用户问题：${input.message}`,
      ].join('\n')
    }
  }
  // 有 threadId 时由 checkpointer 恢复历史，只传本轮用户消息
  if (input.threadId && !input.history?.length) {
    return [{ role: 'user', content }]
  }
  return [
    ...history.map((item) => ({
      role: item.role,
      content: item.content,
    })),
    { role: 'user' as const, content },
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

const toolsByIntent = {
  weather: [getWeatherTool],
  knowledge: [knowledgeSearchTool],
  chitchat: [],
} as const

function intentSystemPrompt(intent: IntentResult) {
  const lines = [
    '你是一个有帮助的 AI 助手。',
    `本轮意图：${intent.intent}（${intent.reason}）。`,
  ]
  if (intent.intent === 'weather') {
    lines.push(
      '只处理天气问题。必须调用 get_weather。',
      intent.city ? `城市优先使用：${intent.city}。` : '若用户没说城市，先询问城市再调用工具。',
    )
  } else if (intent.intent === 'knowledge') {
    lines.push(
      '依据【知识库检索结果】回答。结果为空或不够时，再调用 knowledge_search。',
      '不要把这类问题当成天气。',
    )
  } else {
    lines.push('普通对话，不要调用天气或知识库工具。')
  }
  return lines.join('\n')
}

const createNewAgent = (intent: IntentResult) => {
  const model = createChatModel()

  return createAgent({
    name: 'new-agent',
    description: 'new-agent',
    model,
    tools: [...toolsByIntent[intent.intent]],
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
    systemPrompt: intentSystemPrompt(intent),
    checkpointer: chatMemory,
    stateSchema,
  })
}

/** 一次性调用：适合非流式对话 */
export async function runAgentChat(input: AgentChatInput): Promise<AgentChatResult> {
  const threadId = resolveThreadId(input.threadId)
  const intent = await classifyIntent(input.message)
  const agent = createNewAgent(intent)
  const result = await agent.invoke({
    messages: await buildMessages({ ...input, threadId }, intent),
  }, {
    configurable: { thread_id: threadId },
  })

  const messages = (result.messages ?? []) as Array<{ content?: unknown }>
  return {
    reply: extractReply(messages),
    threadId,
    messages,
    intent,
  }
}

/** 流式调用：按事件向外抛，由 API 层写成 SSE */
export async function* streamAgentChat(input: AgentChatInput) {
  const threadId = resolveThreadId(input.threadId)
  const intent = await classifyIntent(input.message)
  yield { threadId, intent, chunk: undefined as unknown }

  const agent = createNewAgent(intent)
  const stream = await agent.stream(
    { messages: await buildMessages({ ...input, threadId }, intent) },
    {
      streamMode: 'messages',
      configurable: { thread_id: threadId },
    },
  )

  for await (const chunk of stream) {
    yield { threadId, intent, chunk }
  }
}
