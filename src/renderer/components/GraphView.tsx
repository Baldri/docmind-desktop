import { useEffect, useRef, useCallback } from 'react'
import { Network, RefreshCw, X, FileText, Users, Building2, MapPin } from 'lucide-react'
import { useGraphStore } from '../stores/graph-store'
import type { GraphNode } from '../../shared/types'
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force'
import { select } from 'd3-selection'

// d3 simulation types with position data
interface SimNode extends SimulationNodeDatum, GraphNode {
  x: number
  y: number
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  weight: number
}

// Entity type color mapping
const TYPE_COLORS: Record<string, string> = {
  persons: '#3b82f6',       // blue
  organizations: '#8b5cf6', // purple
  locations: '#10b981',     // green
}

const TYPE_LABELS: Record<string, string> = {
  persons: 'Personen',
  organizations: 'Organisationen',
  locations: 'Orte',
}

/**
 * GraphView — interactive entity co-occurrence graph.
 *
 * Uses d3-force for physics simulation, rendered via SVG.
 * Clicking a node loads its neighbor documents and co-entities.
 */
export function GraphView() {
  const svgRef = useRef<SVGSVGElement>(null)
  const simulationRef = useRef<ReturnType<typeof forceSimulation<SimNode>> | null>(null)

  const {
    nodes, edges, stats, isLoading, error,
    entityTypes, minCount,
    selectedEntity, neighborDocs, coEntities, isLoadingDetails,
    loadGraph, setEntityTypes, setMinCount,
    selectEntity, clearSelection,
  } = useGraphStore()

  // Load graph on mount and filter changes
  useEffect(() => {
    loadGraph()
  }, [loadGraph])

  // Render d3 graph when nodes/edges change
  const renderGraph = useCallback(() => {
    const svg = svgRef.current
    if (!svg || nodes.length === 0) return

    const width = svg.clientWidth
    const height = svg.clientHeight

    // Clear previous render
    select(svg).selectAll('*').remove()

    // Prepare simulation data (deep copy to avoid d3 mutating store)
    const simNodes: SimNode[] = nodes.map((n) => ({
      ...n,
      x: width / 2 + (Math.random() - 0.5) * 200,
      y: height / 2 + (Math.random() - 0.5) * 200,
    }))

    const nodeMap = new Map(simNodes.map((n) => [n.id, n]))

    const simLinks: SimLink[] = edges
      .filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target))
      .map((e) => ({
        source: e.source,
        target: e.target,
        weight: e.weight,
      }))

    // Create SVG groups
    const root = select(svg)
    const g = root.append('g')

    // Zoom behavior via wheel
    root.on('wheel', (event: WheelEvent) => {
      event.preventDefault()
      const currentTransform = g.attr('transform') || 'translate(0,0) scale(1)'
      const scaleMatch = currentTransform.match(/scale\(([\d.]+)\)/)
      const translateMatch = currentTransform.match(/translate\(([-\d.]+),([-\d.]+)\)/)
      let scale = scaleMatch ? parseFloat(scaleMatch[1]) : 1
      const tx = translateMatch ? parseFloat(translateMatch[1]) : 0
      const ty = translateMatch ? parseFloat(translateMatch[2]) : 0
      scale *= event.deltaY > 0 ? 0.95 : 1.05
      scale = Math.max(0.1, Math.min(5, scale))
      g.attr('transform', `translate(${tx},${ty}) scale(${scale})`)
    })

    // Drag state
    let dragOffsetX = 0
    let dragOffsetY = 0
    let isDragging = false

    root.on('mousedown', (event: MouseEvent) => {
      if (event.target === svg) {
        isDragging = true
        const currentTransform = g.attr('transform') || 'translate(0,0) scale(1)'
        const translateMatch = currentTransform.match(/translate\(([-\d.]+),([-\d.]+)\)/)
        const tx = translateMatch ? parseFloat(translateMatch[1]) : 0
        const ty = translateMatch ? parseFloat(translateMatch[2]) : 0
        dragOffsetX = event.clientX - tx
        dragOffsetY = event.clientY - ty
      }
    })

    root.on('mousemove', (event: MouseEvent) => {
      if (!isDragging) return
      const currentTransform = g.attr('transform') || 'translate(0,0) scale(1)'
      const scaleMatch = currentTransform.match(/scale\(([\d.]+)\)/)
      const scale = scaleMatch ? parseFloat(scaleMatch[1]) : 1
      const tx = event.clientX - dragOffsetX
      const ty = event.clientY - dragOffsetY
      g.attr('transform', `translate(${tx},${ty}) scale(${scale})`)
    })

    root.on('mouseup', () => { isDragging = false })
    root.on('mouseleave', () => { isDragging = false })

    // Draw edges
    const linkSelection = g.append('g')
      .selectAll('line')
      .data(simLinks)
      .join('line')
      .attr('stroke', 'currentColor')
      .attr('stroke-opacity', 0.15)
      .attr('stroke-width', (d) => Math.min(d.weight, 5))

    // Draw nodes
    const nodeSelection = g.append('g')
      .selectAll('circle')
      .data(simNodes)
      .join('circle')
      .attr('r', (d) => Math.max(4, Math.min(d.size * 1.5, 20)))
      .attr('fill', (d) => {
        // Determine entity type from the node id prefix or type field
        for (const [type, color] of Object.entries(TYPE_COLORS)) {
          if (d.type === type) return color
        }
        return TYPE_COLORS.persons // default
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .attr('cursor', 'pointer')
      .on('click', (_event: MouseEvent, d: SimNode) => {
        // Determine entity type — try to extract from id or use 'persons' default
        const entityType = d.type === 'entity' ? 'persons' : d.type
        selectEntity(d.label, entityType as 'persons' | 'organizations' | 'locations')
      })

    // Labels
    const labelSelection = g.append('g')
      .selectAll('text')
      .data(simNodes)
      .join('text')
      .text((d) => d.label)
      .attr('font-size', (d) => Math.max(8, Math.min(d.size + 6, 14)))
      .attr('fill', 'currentColor')
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => -(Math.max(4, Math.min(d.size * 1.5, 20)) + 4))
      .attr('pointer-events', 'none')
      .attr('opacity', 0.8)

    // Force simulation
    const simulation = forceSimulation<SimNode>(simNodes)
      .force('link', forceLink<SimNode, SimLink>(simLinks)
        .id((d) => d.id)
        .distance(80)
        .strength((d) => Math.min(d.weight * 0.1, 1)))
      .force('charge', forceManyBody<SimNode>().strength(-120))
      .force('center', forceCenter(width / 2, height / 2))
      .force('collide', forceCollide<SimNode>().radius((d) => Math.max(4, d.size * 1.5) + 8))
      .on('tick', () => {
        linkSelection
          .attr('x1', (d) => (d.source as SimNode).x)
          .attr('y1', (d) => (d.source as SimNode).y)
          .attr('x2', (d) => (d.target as SimNode).x)
          .attr('y2', (d) => (d.target as SimNode).y)

        nodeSelection
          .attr('cx', (d) => d.x)
          .attr('cy', (d) => d.y)

        labelSelection
          .attr('x', (d) => d.x)
          .attr('y', (d) => d.y)
      })

    simulationRef.current = simulation

    return () => {
      simulation.stop()
    }
  }, [nodes, edges, selectEntity])

  // Run d3 render when data changes
  useEffect(() => {
    const cleanup = renderGraph()
    return () => cleanup?.()
  }, [renderGraph])

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      if (simulationRef.current) {
        simulationRef.current.stop()
      }
      renderGraph()
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [renderGraph])

  const toggleEntityType = (type: 'persons' | 'organizations' | 'locations') => {
    const newTypes = entityTypes.includes(type)
      ? entityTypes.filter((t) => t !== type)
      : [...entityTypes, type]
    if (newTypes.length > 0) {
      setEntityTypes(newTypes)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
        <Network className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-sm font-medium">Wissens-Graph</h2>

        <div className="ml-4 flex gap-1">
          {(['persons', 'organizations', 'locations'] as const).map((type) => {
            const active = entityTypes.includes(type)
            const Icon = type === 'persons' ? Users : type === 'organizations' ? Building2 : MapPin
            return (
              <button
                key={type}
                onClick={() => toggleEntityType(type)}
                className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
                  active
                    ? 'bg-primary/20 text-primary'
                    : 'text-muted-foreground hover:bg-secondary'
                }`}
                title={TYPE_LABELS[type]}
              >
                <Icon className="h-3 w-3" />
                {TYPE_LABELS[type]}
              </button>
            )
          })}
        </div>

        <label className="ml-4 flex items-center gap-1 text-xs text-muted-foreground">
          Min:
          <input
            type="number"
            min={1}
            max={20}
            value={minCount}
            onChange={(e) => setMinCount(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-12 rounded border border-border bg-transparent px-1 py-0.5 text-xs"
          />
        </label>

        <button
          onClick={loadGraph}
          disabled={isLoading}
          className="ml-auto flex items-center gap-1 rounded bg-primary/20 px-3 py-1 text-xs text-primary hover:bg-primary/30 disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
          Laden
        </button>

        {stats.node_count > 0 && (
          <span className="text-xs text-muted-foreground">
            {stats.node_count} Knoten, {stats.edge_count} Kanten
          </span>
        )}
      </div>

      {/* Content area */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* SVG Graph */}
        <div className="flex-1">
          {error && (
            <div className="flex h-full items-center justify-center">
              <div className="rounded-lg bg-destructive/10 p-4 text-center text-sm text-destructive">
                {error}
              </div>
            </div>
          )}

          {!error && nodes.length === 0 && !isLoading && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <Network className="h-12 w-12 opacity-30" />
              <p className="text-sm">Keine Entitaeten gefunden</p>
              <p className="text-xs">
                Stellen Sie sicher, dass NER-Enrichment aktiv ist und Dokumente indexiert wurden.
              </p>
            </div>
          )}

          {isLoading && (
            <div className="flex h-full items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          <svg
            ref={svgRef}
            className="h-full w-full"
            style={{ display: nodes.length > 0 && !isLoading ? 'block' : 'none' }}
          />
        </div>

        {/* Detail panel (when entity selected) */}
        {selectedEntity && (
          <aside className="w-72 overflow-y-auto border-l border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{selectedEntity}</h3>
              <button
                onClick={clearSelection}
                className="rounded p-1 text-muted-foreground hover:bg-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isLoadingDetails ? (
              <RefreshCw className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <>
                {/* Co-entities */}
                {coEntities.length > 0 && (
                  <div className="mb-4">
                    <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase">
                      Verbundene Entitaeten ({coEntities.length})
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {coEntities.slice(0, 15).map((e) => (
                        <button
                          key={`${e.entity_type}:${e.name}`}
                          onClick={() => selectEntity(e.name, e.entity_type as 'persons' | 'organizations' | 'locations')}
                          className="rounded-full px-2 py-0.5 text-xs transition-colors hover:bg-secondary"
                          style={{
                            backgroundColor: `${TYPE_COLORS[e.entity_type] ?? '#6b7280'}20`,
                            color: TYPE_COLORS[e.entity_type] ?? '#6b7280',
                          }}
                        >
                          {e.name} ({e.count})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Documents */}
                {neighborDocs.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase">
                      Dokumente ({neighborDocs.length})
                    </h4>
                    <ul className="space-y-1.5">
                      {neighborDocs.map((doc) => (
                        <li
                          key={doc.file_path}
                          className="flex items-start gap-2 rounded p-1.5 text-xs hover:bg-secondary"
                        >
                          <FileText className="mt-0.5 h-3 w-3 flex-shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{doc.file_name}</p>
                            {doc.document_type && (
                              <p className="text-muted-foreground">{doc.document_type}</p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {neighborDocs.length === 0 && coEntities.length === 0 && (
                  <p className="text-xs text-muted-foreground">Keine Details verfuegbar.</p>
                )}
              </>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}
