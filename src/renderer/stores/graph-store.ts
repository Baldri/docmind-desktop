import { create } from 'zustand'
import type {
  GraphNode,
  GraphEdge,
  GraphEntityItem,
  GraphNeighborDocument,
} from '../../shared/types'
import { friendlyError } from '../lib/error-messages'

type EntityType = 'persons' | 'organizations' | 'locations'

interface GraphState {
  // Visualization data
  nodes: GraphNode[]
  edges: GraphEdge[]
  stats: { node_count: number; edge_count: number; total_entities_scanned: number }
  isLoading: boolean
  error: string | null

  // Filters
  entityTypes: EntityType[]
  minCount: number
  limit: number

  // Selected entity details
  selectedEntity: string | null
  selectedEntityType: EntityType | null
  neighborDocs: GraphNeighborDocument[]
  coEntities: GraphEntityItem[]
  isLoadingDetails: boolean

  // Actions
  loadGraph: () => Promise<void>
  setEntityTypes: (types: EntityType[]) => void
  setMinCount: (count: number) => void
  setLimit: (limit: number) => void
  selectEntity: (name: string, type: EntityType) => Promise<void>
  clearSelection: () => void
}

export const useGraphStore = create<GraphState>((set, get) => ({
  nodes: [],
  edges: [],
  stats: { node_count: 0, edge_count: 0, total_entities_scanned: 0 },
  isLoading: false,
  error: null,

  entityTypes: ['persons', 'organizations', 'locations'],
  minCount: 2,
  limit: 100,

  selectedEntity: null,
  selectedEntityType: null,
  neighborDocs: [],
  coEntities: [],
  isLoadingDetails: false,

  loadGraph: async () => {
    const { entityTypes, minCount, limit } = get()
    set({ isLoading: true, error: null })

    try {
      const response = await window.electronAPI.graph.visualize(
        entityTypes,
        minCount,
        limit,
      ) as { nodes: GraphNode[]; edges: GraphEdge[]; stats: GraphState['stats']; error?: string }

      if (response.error) {
        throw new Error(response.error)
      }

      set({
        nodes: response.nodes ?? [],
        edges: response.edges ?? [],
        stats: response.stats ?? { node_count: 0, edge_count: 0, total_entities_scanned: 0 },
        isLoading: false,
      })
    } catch (error) {
      const raw = error instanceof Error ? error.message : 'Graph konnte nicht geladen werden'
      set({ isLoading: false, error: friendlyError(raw) })
    }
  },

  setEntityTypes: (types) => set({ entityTypes: types }),
  setMinCount: (count) => set({ minCount: count }),
  setLimit: (limit) => set({ limit }),

  selectEntity: async (name, type) => {
    set({
      selectedEntity: name,
      selectedEntityType: type,
      isLoadingDetails: true,
      neighborDocs: [],
      coEntities: [],
    })

    try {
      const response = await window.electronAPI.graph.neighbors(name, type) as {
        documents: GraphNeighborDocument[]
        co_entities: GraphEntityItem[]
        error?: string
      }

      if (response.error) {
        throw new Error(response.error)
      }

      set({
        neighborDocs: response.documents ?? [],
        coEntities: response.co_entities ?? [],
        isLoadingDetails: false,
      })
    } catch {
      set({ isLoadingDetails: false })
    }
  },

  clearSelection: () =>
    set({
      selectedEntity: null,
      selectedEntityType: null,
      neighborDocs: [],
      coEntities: [],
    }),
}))
