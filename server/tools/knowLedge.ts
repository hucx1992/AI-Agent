import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { searchSimilar } from "../services/knowLedge.service";

export const knowledgeSearchTool = tool(
    async ({ query }) => {
        console.log('s--向量库搜索结果----1------------', query)
        const results = await searchSimilar(query);
        console.log('s--向量库搜索结果----2------------', query)
        return results.map((result) => result.pageContent).join("\n");
    },
    {
        name: "knowledge_search",
        description:
            "从本地知识库检索用户相关信息。当用户询问个人情况、心情、今天/近期状态、偏好、已录入的事实或任何可能已写入知识库的内容时，必须先调用本工具。",
        schema: z.object({
            query: z.string().describe('检索关键词，例如：今天、心情、杭州'),
        }),
    }
)