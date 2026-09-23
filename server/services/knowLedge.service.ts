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

/** 相似度检索 */
export async function searchSimilar(query: string, k = 3) {
  if (!store) return []
  return store.similaritySearch(query, k)
}