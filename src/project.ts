import { isGeneratedApp } from './contract.ts'
import type { GeneratedApp } from './contract.ts'

export const PROJECT_KEY = 'app-builder:latest-project'

export type Project = {
  version: 2
  id: string
  prompt: string
  app: GeneratedApp
  savedAt: number
}

export function createProject(prompt: string, app: GeneratedApp, previous?: Project): Project {
  return { version: 2, id: previous?.id ?? crypto.randomUUID(), prompt, app, savedAt: Date.now() }
}

export function readProject(): Project | null {
  try {
    const stored = localStorage.getItem(PROJECT_KEY)
    if (!stored) return null

    const project = JSON.parse(stored) as (Omit<Partial<Project>, 'version'> & { version?: number }) | null
    if ((project?.version === 1 || project?.version === 2) && typeof project.prompt === 'string'
      && typeof project.savedAt === 'number' && isGeneratedApp(project.app)) {
      if (project.version === 2 && (typeof project.id !== 'string' || !/^[\w-]{1,80}$/.test(project.id))) return null
      const current: Project = { version: 2, id: project.version === 2 ? project.id! : crypto.randomUUID(), prompt: project.prompt, savedAt: project.savedAt, app: project.app }
      if (project.version === 1) saveProject(current)
      return current
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
