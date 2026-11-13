import { Readable } from 'node:stream'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import type { Connect, Plugin } from 'vite'
import { createGenerateHandler } from './server/generate.ts'
import { createOllamaModel } from './server/ollama.ts'
import { createOpenAIModel } from './server/openai.ts'
import { configuredQwenModel } from './server/qwen.ts'
import { createRateLimiter } from './server/rate-limit.ts'

function localGeneration(env: Record<string, string>): Plugin {
  const localModel = env.OLLAMA_MODEL?.trim()
  const fallbackModel = localModel ? createOllamaModel(localModel) : createOpenAIModel({
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL,
  })
  const generate = createGenerateHandler(configuredQwenModel(env) ?? fallbackModel, { allow: createRateLimiter(6, 60_000) })

  const register = ({ middlewares }: { middlewares: Connect.Server }) => {
    middlewares.use('/api/generate', async (incoming, outgoing) => {
      const method = incoming.method ?? 'GET'
      const headers = new Headers()
      for (const [name, value] of Object.entries(incoming.headers)) {
        if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value)
      }
      const body = method === 'POST' ? Readable.toWeb(incoming) as ReadableStream<Uint8Array> : undefined
      const init = { method, headers, body, duplex: 'half' } as RequestInit
      const response = await generate(new Request('http://localhost/api/generate', init))
      outgoing.writeHead(response.status, Object.fromEntries(response.headers))
      outgoing.end(await response.text())
    })
  }

  return {
    name: 'local-generation',
    configureServer: register,
    configurePreviewServer: register,
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), localGeneration(loadEnv(mode, process.cwd(), ['OPENAI_', 'OLLAMA_MODEL', 'DASHSCOPE_']))],
}))
