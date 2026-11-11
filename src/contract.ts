export const PROMPT_LIMIT = 1600

const fieldLimits = { title: 120, html: 40_000, css: 40_000, js: 60_000 }

export type GeneratedApp = Record<keyof typeof fieldLimits, string>

export const generatedAppSchema = {
  type: 'object',
  additionalProperties: false,
  properties: { title: { type: 'string' }, html: { type: 'string' }, css: { type: 'string' }, js: { type: 'string' } },
  required: ['title', 'html', 'css', 'js'],
}

export function isGeneratedApp(value: unknown): value is GeneratedApp {
  if (!value || typeof value !== 'object') return false
  const app = value as Record<string, unknown>
  return Object.entries(fieldLimits).every(([name, limit]) => {
    const field = app[name]
    return typeof field === 'string' && field.length <= limit
      && ((name !== 'title' && name !== 'html') || field.trim().length > 0)
  })
}
