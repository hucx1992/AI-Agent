import { streamAgentChat } from "../services/agent.service";

interface ChatBody {
    message?: string
    threadId?: string
    history?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
}

/** 只取助手增量文本；跳过 tool 结果，避免把 JSON 推给前端 */
function getText(item: unknown): string {
    const raw = (item as { chunk?: unknown })?.chunk ?? item
    const msg = Array.isArray(raw) ? raw[0] : raw
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

export default defineEventHandler(async (event: ChatBody) => {
    const body:any = await readBody<ChatBody>(event)
    if (!body.message) {
        setResponseStatus(event, 400)
        return {
            code: 400,
            message: 'message is required',
            data: null
        }
    }
    const eventStream = createEventStream(event)
    void (async () => {
        try {
            // const result = await streamAgentChat(body);
            for await (const chunk of streamAgentChat(body)) {
                const text = getText(chunk)
                if (!text) continue
                await eventStream.push(JSON.stringify({
                    type: 'chunk',
                    text
                }))
            }
            await eventStream.push(JSON.stringify({ type: 'done' }))
        } catch (error) {

            console.error('[agent/stream]', error)
            await eventStream.push(JSON.stringify({
                code: 500,
                type: 'error',
                message: error instanceof Error ? error.message : 'Agent stream failed',
            }))
        } finally {
            await eventStream.close()
        }
    })()
    return eventStream.send()
});