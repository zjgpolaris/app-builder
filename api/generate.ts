import { createGenerateHandler } from '../server/generate.ts'
import { createOpenAIModel } from '../server/openai.ts'
import { createRateLimiter } from '../server/rate-limit.ts'

const allow = createRateLimiter(6, 60_000)
const generate = createGenerateHandler(createOpenAIModel({
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.OPENAI_MODEL,
}), { allow })

export default { fetch: generate }
