import { runAgentChat } from "../services/agent.service";

interface ChatBody {
    message: string
    threadId?: string
    history?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
}
export default defineEventHandler(async (event: any) => {
    const body:ChatBody = await readBody<ChatBody>(event)
    if (!body.message) {
        setResponseStatus(event, 400)
        return {
            code: 400,
            message: 'message is required',
            data: null
        }
    }

    try {
        const result = await runAgentChat(body);
        return {
            code: 1000,
            data: result,
            message: 'success',
        };
    } catch (error) {
        setResponseStatus(event, 500)
        return {
            code: 500,
            message: error.message,
            data: null
        }
    }
});