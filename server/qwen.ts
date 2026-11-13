import { GenerationError } from './generate.ts'
import { appInstructions, modelInput } from './instructions.ts'
import { isGeneratedApp } from '../src/contract.ts'
import type { GeneratedApp } from '../src/contract.ts'
import { scriptSyntaxError } from './script.ts'

type DashScopeEnv = Record<string, string | undefined>
type Completion = {
  choices?: { finish_reason?: string; message?: { content?: string } }[]
}

function chatEndpoint(baseUrl: string) {
  const url = URL.parse(baseUrl)
  if (!url || url.protocol !== 'https:' || url.port || url.username || url.password || url.search || url.hash
    || !(url.hostname === 'dashscope.aliyuncs.com' || url.hostname.endsWith('.maas.aliyuncs.com'))
    || url.pathname.replace(/\/$/, '') !== '/compatible-mode/v1') {
    throw new GenerationError('INVALID_MODEL_CONFIG', 503)
  }
  url.pathname = '/compatible-mode/v1/chat/completions'
  return url
}

export function configuredQwenModel(env: DashScopeEnv, fetcher = fetch) {
  const apiKey = env.DASHSCOPE_API_KEY?.trim()
  const baseUrl = env.DASHSCOPE_BASE_URL?.trim()
  const model = env.DASHSCOPE_MODEL?.trim() || 'qwen3.8-flash'
  if (!apiKey && !baseUrl) return undefined

  async function complete(instructions: string, input: string, signal: AbortSignal): Promise<unknown> {
    if (!apiKey) throw new GenerationError('NOT_CONFIGURED', 503)
    if (!baseUrl) throw new GenerationError('INVALID_MODEL_CONFIG', 503)

    const response = await fetcher(chatEndpoint(baseUrl), {
      method: 'POST',
      redirect: 'error',
      signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: `${instructions}\nReturn a JSON object with exactly these string fields: title, html, css, js.` },
          { role: 'user', content: input },
        ],
        enable_thinking: false,
        max_tokens: 8_000,
        response_format: { type: 'json_object' },
      }),
    })

    if (response.status === 429) throw new GenerationError('RATE_LIMITED', 429)
    if (!response.ok) throw new GenerationError('UPSTREAM_ERROR', 502)

    try {
      const result = await response.json() as Completion
      const choice = result.choices?.[0]
      if (choice?.finish_reason !== 'stop' || typeof choice.message?.content !== 'string') {
        throw new Error('Incomplete response')
      }
      return JSON.parse(choice.message.content)
    } catch {
      throw new GenerationError('INVALID_OUTPUT', 502)
    }
  }

  return async (prompt: string, signal: AbortSignal, currentApp?: GeneratedApp): Promise<unknown> => {
    const { instructions, input } = modelInput(appInstructions, prompt, currentApp)
    const app = await complete(instructions, input, signal)
    if (!isGeneratedApp(app)) throw new GenerationError('INVALID_OUTPUT', 502)
    const error = scriptSyntaxError(app.js)
    if (!error) return app

    const repair = await complete(
      `${appInstructions}\nRepair the supplied app's JavaScript syntax error. Preserve its requested behavior, markup, styling, and DOM references. Return the complete corrected app as a JSON object with exactly the string fields title, html, css, js.`,
      JSON.stringify({ error, app }),
      signal,
    )
    if (!isGeneratedApp(repair) || scriptSyntaxError(repair.js)) {
      throw new GenerationError('INVALID_OUTPUT', 502)
    }
    return repair
  }
}
