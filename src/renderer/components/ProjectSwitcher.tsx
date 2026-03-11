import { useState, useEffect, useRef } from 'react'
import { FolderOpen, Plus, ChevronDown, Trash2, X } from 'lucide-react'
import { useProjectStore } from '../stores/project-store'
import { useChatStore } from '../stores/chat-store'
import type { Project } from '../../shared/types'

/**
 * ProjectSwitcher — dropdown in the sidebar for switching between RAG projects.
 *
 * Shows the active project name (or icon-only on narrow screens).
 * On project switch: clears chat/search state so the new project's data is shown.
 */
export function ProjectSwitcher() {
  const { projects, activeProjectId, isLoading, loadProjects, setActiveProject, createProject, deleteProject } =
    useProjectStore()
  const clearChat = useChatStore((s) => s.clearMessages)

  const [isOpen, setIsOpen] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Load projects on mount
  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setShowCreate(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const activeProject = projects.find((p) => p.id === activeProjectId)
  const displayName = activeProject?.name ?? 'Standard'

  async function handleSwitch(project: Project) {
    if (project.id === activeProjectId) {
      setIsOpen(false)
      return
    }
    await setActiveProject(project.id)
    // Clear chat state so new project data is loaded
    clearChat()
    setIsOpen(false)
  }

  async function handleCreate() {
    if (!newName.trim()) return
    await createProject(newName.trim(), newDesc.trim())
    setNewName('')
    setNewDesc('')
    setShowCreate(false)
  }

  async function handleDelete(e: React.MouseEvent, projectId: string) {
    e.stopPropagation()
    if (!confirm(`Projekt "${projectId}" und alle zugehoerigen Daten loeschen?`)) return
    await deleteProject(projectId)
  }

  return (
    <div className="no-drag relative px-2 mb-2" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-center lg:justify-between gap-1 rounded-lg border border-border bg-background/50 px-2 py-1.5 text-sm transition-colors hover:bg-secondary"
        title={`Projekt: ${displayName}`}
      >
        <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="hidden lg:inline truncate flex-1 text-left text-xs font-medium">
          {displayName}
        </span>
        <ChevronDown className={`hidden lg:block h-3 w-3 shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute left-2 right-2 top-full z-50 mt-1 rounded-lg border border-border bg-popover shadow-lg">
          {/* Project List */}
          <div className="max-h-48 overflow-y-auto py-1">
            {isLoading && (
              <div className="px-3 py-2 text-xs text-muted-foreground">Laden...</div>
            )}
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => handleSwitch(project)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-secondary ${
                  project.id === activeProjectId ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'
                }`}
              >
                <span className="truncate flex-1 text-left">{project.name}</span>
                {!project.is_default && (
                  <button
                    onClick={(e) => handleDelete(e, project.id)}
                    className="opacity-0 group-hover:opacity-100 hover:text-destructive p-0.5"
                    title="Loeschen"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </button>
            ))}
          </div>

          {/* Divider + Create */}
          <div className="border-t border-border">
            {showCreate ? (
              <div className="p-2 space-y-1.5">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Projektname"
                  className="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Beschreibung (optional)"
                  className="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
                <div className="flex gap-1">
                  <button
                    onClick={handleCreate}
                    disabled={!newName.trim()}
                    className="flex-1 rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    Erstellen
                  </button>
                  <button
                    onClick={() => setShowCreate(false)}
                    className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-secondary"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowCreate(true)}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <Plus className="h-3 w-3" />
                Neues Projekt
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
