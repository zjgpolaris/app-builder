export const PREVIEW_DATA_PREFIX = 'app-builder:preview-data:'
const DATA_LIMIT = 64_000

export type PreviewOperation = { operation: 'set'; key: unknown; value: unknown }
  | { operation: 'remove'; key: unknown }
  | { operation: 'clear' }

function validNamespace(namespace: string) {
  return /^[a-zA-Z0-9_-]{1,80}$/.test(namespace)
}

export function readPreviewData(namespace: string): Record<string, string> {
  if (!validNamespace(namespace)) return {}
  try {
    const stored = localStorage.getItem(PREVIEW_DATA_PREFIX + namespace)
    if (!stored || stored.length > DATA_LIMIT) return {}
    const parsed: unknown = JSON.parse(stored)
    if (!parsed || typeof parsed !== 'object') return {}
    const record = parsed as { version?: unknown; data?: unknown }
    if (record.version !== 1 || !record.data || typeof record.data !== 'object' || Array.isArray(record.data)) return {}
    if (Object.values(record.data).some(value => typeof value !== 'string')) return {}
    return Object.fromEntries(Object.entries(record.data)) as Record<string, string>
  } catch {
    return {}
  }
}

export function applyPreviewOperation(namespace: string, request: PreviewOperation): boolean {
  if (!validNamespace(namespace) || !request || typeof request !== 'object') return false
  const data = readPreviewData(namespace)
  if (request.operation === 'set') {
    if (typeof request.key !== 'string' || typeof request.value !== 'string') return false
    Object.defineProperty(data, request.key, { value: request.value, enumerable: true, configurable: true, writable: true })
  } else if (request.operation === 'remove') {
    if (typeof request.key !== 'string') return false
    delete data[request.key]
  } else if (request.operation === 'clear') {
    for (const key of Object.keys(data)) delete data[key]
  } else return false
  const encoded = JSON.stringify({ version: 1, data })
  if (encoded.length > DATA_LIMIT) return false
  try {
    localStorage.setItem(PREVIEW_DATA_PREFIX + namespace, encoded)
    return true
  } catch {
    return false
  }
}
