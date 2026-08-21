import { tool } from 'langchain'
import { z } from 'zod'
import { findPersonByName, personProfiles } from '../data/profiles'

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

/** 按姓名查询人物档案 */
export const lookupPersonTool = tool(
  async ({ name }) => {
    const person = findPersonByName(name)
    if (!person) {
      // 未找到时，需要联网查询，返回查询结果
      return `必须要联网查询，查询结果：${name}`;
    }
    return JSON.stringify({ found: true, person })
  },
  {
    name: 'lookup_person',
    description: '根据姓名查询人物档案（如张三，李四）',
    schema: z.object({
      name: z.string().describe('要查询的姓名'),
    }),
  },
)

export const demoTools = [getCurrentTimeTool, echoTool, lookupPersonTool]
