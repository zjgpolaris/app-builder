import { Script } from 'node:vm'
import { isGeneratedApp, PROMPT_LIMIT } from '../src/contract.ts'
import type { GeneratedApp } from '../src/contract.ts'

const creationBodyLimit = 16 * 1024
// Each code character may take up to six bytes after JSON escaping.
const revisionBodyLimit = 1024 * 1024
const messages = {
  METHOD_NOT_ALLOWED: '请使用 POST 提交生成请求。',
  INVALID_PROMPT: '请输入 1–1600 个字符描述你想创建的应用。',
  INVALID_CURRENT_APP: '当前应用代码无效，请重新生成应用后再修改。',
  PAYLOAD_TOO_LARGE: '需求内容过长，请缩短后重试。',
  RATE_LIMITED: '生成请求太频繁，请稍后重试。',
  TIMEOUT: '生成时间超过限制，请简化需求或重试。',
  NOT_CONFIGURED: '生成服务尚未配置 API 密钥。',
  INVALID_MODEL_CONFIG: '生成服务的模型地址配置有误。',
  LOCAL_MODEL_UNAVAILABLE: '无法连接本地模型，请确认 Ollama 正在运行。',
  LOCAL_MODEL_MISSING: 'Ollama 中没有配置的模型，请先下载该模型。',
  INVALID_OUTPUT: '模型未返回可用的应用，请尝试调整需求。',
  UPSTREAM_ERROR: '生成服务暂时不可用，请稍后重试。',
} as const

export class GenerationError extends Error {
  readonly code: keyof typeof messages
  readonly status: number

  constructor(code: keyof typeof messages, status: number) {
    super(messages[code])
    this.code = code
    this.status = status
  }
}

function json(data: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', ...headers },
  })
}

async function readGenerationRequest(request: Request) {
  const reader = request.body?.getReader()
  if (!reader || !request.headers.get('content-type')?.includes('application/json')) {
    throw new GenerationError('INVALID_PROMPT', 400)
  }

  const decoder = new TextDecoder()
  let bytes = 0
  let text = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > revisionBodyLimit) {
        void reader.cancel().catch(() => {})
        throw new GenerationError('PAYLOAD_TOO_LARGE', 413)
      }
      text += decoder.decode(value, { stream: true })
    }
    const body = JSON.parse(text + decoder.decode()) as { prompt?: unknown; currentApp?: unknown } | null
    if (body?.currentApp === undefined && bytes > creationBodyLimit) {
      throw new GenerationError('PAYLOAD_TOO_LARGE', 413)
    }
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''
    if (!prompt || prompt.length > PROMPT_LIMIT) throw new GenerationError('INVALID_PROMPT', 400)
    const currentApp = body?.currentApp
    if (currentApp === undefined) return { prompt }
    if (!isGeneratedApp(currentApp)) throw new GenerationError('INVALID_CURRENT_APP', 400)
    const { title, html, css, js } = currentApp
    return { prompt, currentApp: { title, html, css, js } }
  } catch (error) {
    if (error instanceof GenerationError) throw error
    throw new GenerationError('INVALID_PROMPT', 400)
  } finally {
    reader.releaseLock()
  }
}

type Model = (prompt: string, signal: AbortSignal, currentApp?: GeneratedApp) => Promise<unknown>
type Options = { timeoutMs?: number; allow?: (request: Request) => boolean }

export function createGenerateHandler(model: Model, { timeoutMs = 55_000, allow }: Options = {}) {
  return async (request: Request): Promise<Response> => {
    try {
      if (request.method !== 'POST') throw new GenerationError('METHOD_NOT_ALLOWED', 405)
      const { prompt, currentApp } = await readGenerationRequest(request)
      if (allow && !allow(request)) throw new GenerationError('RATE_LIMITED', 429)

      const controller = new AbortController()
      let timer: ReturnType<typeof setTimeout> | undefined
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new GenerationError('TIMEOUT', 504))
          controller.abort()
        }, timeoutMs)
      })

      try {
        const output = await Promise.race([model(prompt, controller.signal, currentApp), timeout])
        if (!isGeneratedApp(output)) throw new GenerationError('INVALID_OUTPUT', 502)
        const { title, html, css, js } = output
        if (currentApp) {
          try {
            // Check syntax without executing generated code on the server.
            new Script(js)
          } catch {
            throw new GenerationError('INVALID_OUTPUT', 502)
          }
        }
        return json({ title, html, css, js })
      } finally {
        clearTimeout(timer)
      }
    } catch (error) {
      const failure = error instanceof GenerationError ? error : new GenerationError('UPSTREAM_ERROR', 502)
      const headers: Record<string, string> = {}
      if (failure.status === 405) headers.Allow = 'POST'
      if (failure.status === 429) headers['Retry-After'] = '60'
      return json({ code: failure.code, message: failure.message }, failure.status, headers)
    }
  }
}
