import { OpenAIEmbeddings } from '@langchain/openai'
import { MemoryVectorStore } from '@langchain/classic/vectorstores/memory'
import { Document } from '@langchain/core/documents'

let store: MemoryVectorStore | null = null

function createEmbeddings() {
  const config = useRuntimeConfig()
  return new OpenAIEmbeddings({
    apiKey: config.openaiApiKey,
    model: 'text-embedding-v3', // 通义；OpenAI 用 text-embedding-3-small
    configuration: config.openaiBaseUrl
      ? { baseURL: config.openaiBaseUrl }
      : undefined,
  })
}

/** 写入文档并向量化 */
export async function upsertDocs(texts: string[]) {
  const embeddings = createEmbeddings()
  const docs = texts.map((pageContent) => new Document({ pageContent }))
  if (!store) {
    store = await MemoryVectorStore.fromDocuments(docs, embeddings)
  } else {
    await store.addDocuments(docs)
  }
  return { count: texts.length }
}

export const DEFAULT_TOP_K = 3
/** 余弦相似度下限，低于此分的结果丢掉 */
export const DEFAULT_MIN_SCORE = 0.35

export interface KnowledgeHit {
  content: string
  /** 余弦相似度，越接近 1 越相关 */
  score: number
  /** 过滤打分后的名次，从 1 开始 */
  rank: number
}

export interface SearchSimilarOptions {
  topK?: number
  minScore?: number
}

function toScore(raw: number) {
  if (!Number.isFinite(raw)) return 0
  return Math.round(raw * 1000) / 1000
}

/** 按相似度打分，取 topK */
export async function searchSimilar(
  query: string,
  options: SearchSimilarOptions = {},
): Promise<KnowledgeHit[]> {
  if (!store) return []

  const topK = Math.max(1, options.topK ?? DEFAULT_TOP_K)
  const minScore = options.minScore ?? DEFAULT_MIN_SCORE
  const fetchK = Math.max(topK * 3, 10)
  const pairs = await store.similaritySearchWithScore(query, fetchK)

  return pairs
    .map(([doc, rawScore]) => ({
      content: doc.pageContent,
      score: toScore(rawScore),
    }))
    .filter((item) => item.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }))
}