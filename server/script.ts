import { Script } from 'node:vm'

export function scriptSyntaxError(js: string): string | undefined {
  try {
    // Compile only. Generated code is never executed on the server.
    new Script(js)
  } catch (error) {
    return error instanceof Error ? error.message : 'Invalid JavaScript'
  }
}
