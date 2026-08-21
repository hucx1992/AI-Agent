import { tool } from 'langchain'
import { z } from 'zod'

/** 示例工具：后续可替换为业务工具 */
export const getCurrentTimeTool = tool(
  async () => {
    return new Date().toISOString()
  },
  {
    name: 'get_current_time',
    description: 'Get the current UTC time in ISO 8601 format',
    schema: z.object({}),
  },
)

export const echoTool = tool(
  async ({ text }) => {
    return text
  },
  {
    name: 'echo',
    description: 'Echo back the provided text',
    schema: z.object({
      text: z.string().describe('Text to echo'),
    }),
  },
)

export const demoTools = [getCurrentTimeTool, echoTool]
