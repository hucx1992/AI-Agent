import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { searchSimilar } from "../services/knowLedge.service";

export const knowledgeSearchTool = tool(
    async ({ query, topK }) => {
        const results = await searchSimilar(query, { topK })
        if (!results.length) {
            return '知识库没有足够相关的内容。'
        }
        return results
            .map((item) => `${item.rank}. [相关度 ${item.score}] ${item.content}`)
            .join('\n')
    },
    {
        name: "knowledge_search",
        description:
            "从本地知识库检索用户相关信息，返回带相关度分数的 topK 结果。当用户询问个人情况、心情、今天/近期状态、偏好、已录入的事实或任何可能已写入知识库的内容时，必须先调用本工具。",
        schema: z.object({
            query: z.string().describe('检索关键词，例如：今天、心情、杭州'),
            topK: z.number().int().min(1).max(10).optional().describe('返回条数，默认 3'),
        }),
    }
)