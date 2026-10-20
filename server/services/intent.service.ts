import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'

export const IntentKind = z.enum(['weather', 'knowledge', 'chitchat'])
export type IntentKind = z.infer<typeof IntentKind>

export const IntentResultSchema = z.object({
  intent: IntentKind.describe(
    'weather=询问天气/气温/下雨；knowledge=个人事实、心情、已录入知识；chitchat=打招呼、闲聊或其他',
  ),
  city: z.string().optional().describe('天气意图时的城市，没有则省略'),
  query: z.string().optional().describe('知识库检索关键词，没有则用原句'),
  reason: z.string().describe('一句话说明分类依据'),
})

export type IntentResult = z.infer<typeof IntentResultSchema>

export const INTENT_LABEL: Record<IntentKind, string> = {
  weather: '查天气',
  knowledge: '查知识库',
  chitchat: '闲聊',
}

function heuristicIntent(message: string): IntentResult {
  if (/天气|气温|下雨|温度|多少度|forecast/i.test(message)) {
    const city = message.match(/([\u4e00-\u9fff]{2,8})(?:的天气|天气)/)?.[1]
    return { intent: 'weather', city, reason: '规则：包含天气相关词' }
  }
  if (/心情|今天怎么样|我是谁|我住|知识库|记得吗/.test(message)) {
    return { intent: 'knowledge', query: message, reason: '规则：像在问个人/知识库信息' }
  }
  return { intent: 'chitchat', reason: '规则：未匹配到天气或知识库' }
}

function createClassifierModel() {
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
    temperature: 0,
    ...(config.openaiBaseUrl
      ? { configuration: { baseURL: config.openaiBaseUrl } }
      : {}),
  })
}

/** 识别用户本轮意图，失败时回退到关键词规则 */
export async function classifyIntent(message: string): Promise<IntentResult> {
  const text = message.trim()
  if (!text) {
    return { intent: 'chitchat', reason: '空消息' }
  }

  try {
    const model = createClassifierModel().withStructuredOutput(IntentResultSchema)
    const result = await model.invoke([
      {
        role: 'system',
        content: [
          '你是意图分类器，只分类，不回答用户问题。',
          'weather：问天气、气温、是否下雨、某地气候。',
          'knowledge：问个人情况、心情、今天过得怎样、已录入的事实。',
          'chitchat：打招呼、闲聊、写代码、一般问答。不要把心情问题当成天气。',
        ].join('\n'),
      },
      { role: 'user', content: text },
    ])
    return IntentResultSchema.parse(result)
  } catch (error) {
    console.warn('[classifyIntent] fallback to heuristic', error)
    return heuristicIntent(text)
  }
}
