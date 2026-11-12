import { createGenerateHandler } from '../server/generate.ts'
import { createOpenAIModel } from '../server/openai.ts'
import { createRateLimiter } from '../server/rate-limit.ts'

const allow = createRateLimiter(6, 60_000)

export default {
  fetch(request: Request) {
    const openAIKey = process.env.OPENAI_API_KEY?.trim()
    const model = process.env.OPENAI_MODEL
    const gatewayKey = process.env.AI_GATEWAY_API_KEY?.trim() || request.headers.get('x-vercel-oidc-token') || undefined
    const generate = createGenerateHandler(createOpenAIModel({
      apiKey: openAIKey || gatewayKey,
      model,
      gateway: !openAIKey && Boolean(gatewayKey),
    }), { allow })
    return generate(request)
  },
}
