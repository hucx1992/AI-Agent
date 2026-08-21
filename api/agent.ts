export interface AgentChatHistoryItem {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AgentChatRequest {
  message: string
  history?: AgentChatHistoryItem[]
}

export interface AgentChatResponse {
  code: number
  data: {
    reply: string
  }
}

/** 非流式对话 */
export function postAgentChat(body: AgentChatRequest) {
  return $fetch<AgentChatResponse>('/api/agent/chat', {
    method: 'POST',
    body,
  })
}
