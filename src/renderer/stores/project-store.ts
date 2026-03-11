import { create } from 'zustand'
import type { Project } from '../../shared/types'

interface ProjectState {
  projects: Project[]
  activeProjectId: string
  isLoading: boolean
  error: string | null

  loadProjects: () => Promise<void>
  setActiveProject: (id: string) => Promise<void>
  createProject: (name: string, description?: string) => Promise<Project | null>
  deleteProject: (id: string) => Promise<boolean>
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeProjectId: 'default',
  isLoading: false,
  error: null,

  loadProjects: async () => {
    set({ isLoading: true, error: null })
    try {
      const result = await window.electronAPI.projects.list()
      if (result.error) {
        set({ error: result.error, isLoading: false })
        return
      }
      set({ projects: result.projects ?? result, isLoading: false })

      // Sync activeProjectId from settings
      const activeId = await window.electronAPI.projects.getActive()
      if (activeId) {
        set({ activeProjectId: activeId })
      }
    } catch (err) {
      set({ error: String(err), isLoading: false })
    }
  },

  setActiveProject: async (id: string) => {
    try {
      await window.electronAPI.projects.setActive(id)
      set({ activeProjectId: id })
    } catch (err) {
      set({ error: String(err) })
    }
  },

  createProject: async (name: string, description = '') => {
    try {
      const result = await window.electronAPI.projects.create(name, description)
      if (result.error) {
        set({ error: result.error })
        return null
      }
      // Reload project list
      await get().loadProjects()
      return result
    } catch (err) {
      set({ error: String(err) })
      return null
    }
  },

  deleteProject: async (id: string) => {
    try {
      const result = await window.electronAPI.projects.delete(id)
      if (result.error) {
        set({ error: result.error })
        return false
      }
      // If deleted the active project, switch to default
      if (get().activeProjectId === id) {
        await get().setActiveProject('default')
      }
      await get().loadProjects()
      return true
    } catch (err) {
      set({ error: String(err) })
      return false
    }
  },
}))
