import { streamAgentChat } from "../services/agent.service";

interface ChatBody {
    message: string
    threadId?: string
    history?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
}

interface TokenUsage {
    inputTokens: number
    outputTokens: number
    totalTokens: number
}

function getMessage(item: unknown) {
    const raw = (item as { chunk?: unknown })?.chunk ?? item
    return Array.isArray(raw) ? raw[0] : raw
}

/** 只取助手增量文本；跳过 tool 结果，避免把 JSON 推给前端 */
function getText(item: unknown): string {
    const msg = getMessage(item)
    if (!msg || typeof msg !== 'object') return ''

    const typed = msg as {
        type?: string
        getType?: () => string
        content?: unknown
    }
    const msgType = typed.type
        || (typeof typed.getType === 'function' ? typed.getType() : '')
    // tool / human 等中间消息不推流
    if (msgType && msgType !== 'ai') return ''

    const content = typed.content
    return typeof content === 'string' ? content : ''
}

/** 模型通常在最后一个消息块返回本次调用的 token 用量 */
function getTokenUsage(item: unknown): TokenUsage | null {
    const msg = getMessage(item)
    if (!msg || typeof msg !== 'object') return null

    const typed = msg as {
        usage_metadata?: {
            input_tokens?: number
            output_tokens?: number
            total_tokens?: number
        }
        response_metadata?: {
            tokenUsage?: {
                promptTokens?: number
                completionTokens?: number
                totalTokens?: number
            }
        }
    }
    const usage = typed.usage_metadata
    const fallbackUsage = typed.response_metadata?.tokenUsage
    if (!usage && !fallbackUsage) return null

    const inputTokens = usage?.input_tokens ?? fallbackUsage?.promptTokens ?? 0
    const outputTokens = usage?.output_tokens ?? fallbackUsage?.completionTokens ?? 0
    return {
        inputTokens,
        outputTokens,
        totalTokens:
            usage?.total_tokens
            ?? fallbackUsage?.totalTokens
            ?? inputTokens + outputTokens,
    }
}

export default defineEventHandler(async (event: any) => {
    const body:ChatBody = await readBody(event);
    if (!body.message) {
        setResponseStatus(event, 400);
        return {
            code: 400,
            message: 'message is required',
            data: null
        }
    }
    const eventStream = createEventStream(event);

    let threadId = body.threadId;
    const tokenUsage: TokenUsage = {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
    }
    let hasTokenUsage = false
    void (async () => {
        try {
            for await (const chunk of streamAgentChat(body)) {
                threadId = chunk.threadId;
                const chunkUsage = getTokenUsage(chunk)
                if (chunkUsage) {
                    hasTokenUsage = true
                    tokenUsage.inputTokens += chunkUsage.inputTokens
                    tokenUsage.outputTokens += chunkUsage.outputTokens
                    tokenUsage.totalTokens += chunkUsage.totalTokens
                }
                const text = getText(chunk);
                if (!text) continue;

                await eventStream.push(JSON.stringify({
                    type: 'chunk',
                    text,
                    threadId,
                }));
            }
            await eventStream.push(JSON.stringify({
                type: 'done',
                threadId,
                usage: hasTokenUsage ? tokenUsage : null,
            }));
        } catch (error) {
            await eventStream.push(JSON.stringify({
                code: 500,
                type: 'error',
                message: error instanceof Error ? error.message : 'Agent stream failed',
            }));
        } finally {
            await eventStream.close();
        }
    })();
    return eventStream.send();
});
