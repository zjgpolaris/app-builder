import { Script } from 'node:vm'
import { generatedAppSchema, isGeneratedApp } from '../src/contract.ts'
import type { GeneratedApp } from '../src/contract.ts'
import { GenerationError } from './generate.ts'
import { appInstructions, modelInput } from './instructions.ts'

type OllamaResponse = { done?: boolean; done_reason?: string; message?: { content?: string } }

const localInstructions = `${appInstructions}
Use the exact labels requested by the user. Give every input a label or aria-label. Put a checkbox and its visible text inside the same label.
Keep CSS short. Render user-entered text with createElement and textContent. Use generated numeric IDs if needed. Do not use regular expressions, character replacement, alerts, or Unicode escapes.`

const scriptSchema = {
  type: 'object',
  properties: { js: { type: 'string' } },
  required: ['js'],
  additionalProperties: false,
}

function syntaxError(js: string): string | undefined {
  try {
    // Compile without running the generated code. Execution remains in the browser sandbox.
    new Script(js)
  } catch (error) {
    return error instanceof Error ? error.message : 'Invalid JavaScript'
  }
}

export function createOllamaModel(model: string, fetcher = fetch) {
  async function chat(instructions: string, prompt: string, format: object, signal: AbortSignal, contextSize = 4096): Promise<unknown> {
    let response: Response
    try {
      response = await fetcher('http://127.0.0.1:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          model,
          stream: false,
          format,
          options: { temperature: 0, num_ctx: contextSize, num_predict: 2200, repeat_penalty: 1.1 },
          messages: [
            { role: 'system', content: instructions },
            { role: 'user', content: prompt },
          ],
        }),
      })
    } catch (error) {
      if (signal.aborted) throw error
      throw new GenerationError('LOCAL_MODEL_UNAVAILABLE', 503)
    }

    if (response.status === 404) throw new GenerationError('LOCAL_MODEL_MISSING', 503)
    if (!response.ok) throw new GenerationError('UPSTREAM_ERROR', 502)

    try {
      const result = await response.json() as OllamaResponse
      if (!result.done || result.done_reason === 'length' || !result.message?.content) {
        throw new Error('Incomplete response')
      }
      return JSON.parse(result.message.content)
    } catch {
      throw new GenerationError('INVALID_OUTPUT', 502)
    }
  }

  return async (prompt: string, signal: AbortSignal, currentApp?: GeneratedApp): Promise<unknown> => {
    const { instructions, input } = modelInput(localInstructions, prompt, currentApp)
    const app = await chat(instructions, input, generatedAppSchema, signal, currentApp ? 8192 : 4096)
    if (!isGeneratedApp(app)) throw new GenerationError('INVALID_OUTPUT', 502)
    const error = syntaxError(app.js)
    if (!error) return app

    const repair = await chat(
      'Fix only the JavaScript syntax error. Preserve the existing behavior and DOM references. Return the complete corrected script in the js field.',
      JSON.stringify({ error, js: app.js }),
      scriptSchema,
      signal,
    ) as { js?: unknown } | null
    if (typeof repair?.js !== 'string' || !repair.js.trim() || syntaxError(repair.js)) {
      throw new GenerationError('INVALID_OUTPUT', 502)
    }
    return { ...app, js: repair.js }
  }
}
