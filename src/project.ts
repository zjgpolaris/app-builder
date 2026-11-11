import { isGeneratedApp } from './contract.ts'
import type { GeneratedApp } from './contract.ts'

export const PROJECT_KEY = 'app-builder:latest-project'

export type Project = {
  version: 1
  prompt: string
  app: GeneratedApp
  savedAt: number
}

export function readProject(): Project | null {
  try {
    const stored = localStorage.getItem(PROJECT_KEY)
    if (!stored) return null

    const project = JSON.parse(stored) as Partial<Project> | null
    if (project?.version === 1 && typeof project.prompt === 'string'
      && typeof project.savedAt === 'number' && isGeneratedApp(project.app)) {
      return { version: 1, prompt: project.prompt, savedAt: project.savedAt, app: project.app }
    }
  } catch {
    // Private browsing and malformed records can make storage unavailable.
  }
  return null
}

export function saveProject(project: Project) {
  try {
    localStorage.setItem(PROJECT_KEY, JSON.stringify(project))
    return true
  } catch {
    return false
  }
}
