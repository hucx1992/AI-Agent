import { upsertDocs } from '../../services/knowLedge.service'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ text?: string }>(event)
  const text = body?.text?.trim()
  if (!text) {
    setResponseStatus(event, 400)
    return { code: 400, message: 'text is required', data: null }
  }

  try {
    const result = await upsertDocs([text])
    return { code: 1000, message: 'success', data: result }
  }
  catch (error) {
    console.error('添加知识库失败', error)
    setResponseStatus(event, 500)
    return {
      code: 500,
      message: error instanceof Error ? error.message : '添加失败',
      data: null,
    }
  }
})
