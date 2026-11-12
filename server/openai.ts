import { generatedAppSchema } from '../src/contract.ts'
import { GenerationError } from './generate.ts'
import { appInstructions } from './instructions.ts'

type OutputPart = { type?: string; text?: string }
type ProviderResponse = { status?: string; output?: { type?: string; content?: OutputPart[] }[] }

type ModelOptions = { apiKey?: string; model?: string; gateway?: boolean }

export function createOpenAIModel({ apiKey, model, gateway = false }: ModelOptions, fetcher = fetch) {
  const modelName = model?.trim() || 'gpt-5-mini'
  const modelId = gateway && !modelName.includes('/') ? `openai/${modelName}` : modelName
  const endpoint = gateway ? 'https://ai-gateway.vercel.sh/v1/responses' : 'https://api.openai.com/v1/responses'
  return async (prompt: string, signal: AbortSignal): Promise<unknown> => {
    if (!apiKey?.trim()) throw new GenerationError('NOT_CONFIGURED', 503)

    const response = await fetcher(endpoint, {
      method: 'POST',
      signal,
      headers: { Authorization: `Bearer ${apiKey.trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelId,
        instructions: appInstructions,
        input: prompt,
        store: false,
        max_output_tokens: 8_000,
        reasoning: !gateway && modelId === 'gpt-5-mini' ? { effort: 'minimal' } : undefined,
        text: { format: { type: 'json_schema', name: 'web_app', strict: true, schema: generatedAppSchema } },
      }),
    })

    if (response.status === 429) throw new GenerationError('RATE_LIMITED', 429)
    if (!response.ok) throw new GenerationError('UPSTREAM_ERROR', 502)

    try {
      const result = await response.json() as ProviderResponse
      const output = result.output?.filter(item => item.type === 'message')
        .flatMap(item => item.content ?? [])
        .filter(part => part.type === 'output_text')
        .map(part => part.text)
        .join('')
      if (result.status !== 'completed' || !output) throw new Error('Incomplete response')
      return JSON.parse(output)
    } catch {
      throw new GenerationError('INVALID_OUTPUT', 502)
    }
  }
}
