import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { JOB_TYPES } from '../constants/jobTypes'
import type { LaborGraph, LaborGraphNode } from '../types/intelligence'
import {
  computeClusteredLayout,
  edgePath,
  getNeighborIds,
  type LayoutNode,
} from '../utils/laborGraphLayout'

const ORG_TYPE_STYLES: Record<string, { fill: string; stroke: string; ring: string }> = {
  Union: { fill: '#fecaca', stroke: '#b91c1c', ring: '#fee2e2' },
  'Co-op': { fill: '#6ee7b7', stroke: '#047857', ring: '#d1fae5' },
  Nonprofit: { fill: '#93c5fd', stroke: '#1d4ed8', ring: '#dbeafe' },
  'Public Sector': { fill: '#cbd5e1', stroke: '#334155', ring: '#f1f5f9' },
  'Labor Organization': { fill: '#fcd34d', stroke: '#b45309', ring: '#fef3c7' },
  'B-Corp': { fill: '#c4b5fd', stroke: '#6d28d9', ring: '#ede9fe' },
  Other: { fill: '#d6d3d1', stroke: '#57534e', ring: '#f5f5f4' },
}

function styleForType(orgType?: string | null) {
  return ORG_TYPE_STYLES[orgType || 'Other'] || ORG_TYPE_STYLES.Other
}

function intentLabel(score?: number | null) {
  const value = Math.round(score || 0)
  if (value >= 70) return 'High'
  if (value >= 45) return 'Moderate'
  if (value > 0) return 'Emerging'
  return 'Low'
}

interface LaborGraphProps {
  graph: LaborGraph
  selectedId: number | null
  onSelect: (id: number | null) => void
  filterType: string
  search: string
}

export default function LaborGraphView({
  graph,
  selectedId,
  onSelect,
  filterType,
  search,
}: LaborGraphProps) {
  const filteredNodes = useMemo(() => {
    const query = search.trim().toLowerCase()
    return graph.nodes.filter((node) => {
      if (filterType !== 'all' && node.orgType !== filterType) return false
      if (!query) return true
      return (
        node.name.toLowerCase().includes(query) ||
        (node.location || '').toLowerCase().includes(query) ||
        (node.orgType || '').toLowerCase().includes(query) ||
        node.cluster.toLowerCase().includes(query)
      )
    })
  }, [graph.nodes, filterType, search])

  const filteredIds = useMemo(() => new Set(filteredNodes.map((node) => node.id)), [filteredNodes])

  const layout = useMemo(
    () => computeClusteredLayout(filteredNodes),
    [filteredNodes]
  )

  const neighbors = useMemo(
    () => (selectedId ? getNeighborIds(selectedId, graph.edges) : new Set<number>()),
    [selectedId, graph.edges]
  )

  const visibleEdges = graph.edges.filter(
    (edge) => filteredIds.has(edge.source) && filteredIds.has(edge.target)
  )

  const selectedNode = graph.nodes.find((node) => node.id === selectedId) || null

  return (
    <div className="overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-b from-white to-amber-50/40 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-100 px-4 py-3">
        <div className="flex flex-wrap gap-4 text-xs text-stone-600">
          <span><strong className="text-stone-900">{filteredNodes.length}</strong> employers</span>
          <span><strong className="text-stone-900">{layout.clusters.length}</strong> markets</span>
          <span><strong className="text-stone-900">{visibleEdges.length}</strong> flows</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500">
          {JOB_TYPES.map((type) => (
            <span key={type} className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full border"
                style={{
                  background: styleForType(type).fill,
                  borderColor: styleForType(type).stroke,
                }}
              />
              {type}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          className="w-full"
          role="img"
          aria-label="Labor market graph"
        >
          <defs>
            <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#f5f5f4" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width={layout.width} height={layout.height} fill="url(#grid)" />

          {layout.clusters.map((cluster) => (
            <g key={cluster.id}>
              <rect
                x={cluster.x}
                y={cluster.y}
                width={cluster.width}
                height={cluster.height}
                rx={16}
                fill="#fffbeb"
                stroke="#fde68a"
                strokeWidth={1.5}
                strokeDasharray="4 0"
              />
              <text
                x={cluster.x + 16}
                y={cluster.y + 24}
                className="fill-amber-900 text-[13px] font-semibold"
              >
                {cluster.label}
              </text>
              <text
                x={cluster.x + 16}
                y={cluster.y + 40}
                className="fill-stone-500 text-[11px]"
              >
                {cluster.nodeIds.length} employer{cluster.nodeIds.length === 1 ? '' : 's'}
              </text>
            </g>
          ))}

          {visibleEdges.map((edge, index) => {
            const source = layout.positions.get(edge.source)
            const target = layout.positions.get(edge.target)
            if (!source || !target) return null

            const highlighted =
              selectedId != null &&
              (edge.source === selectedId ||
                edge.target === selectedId ||
                (neighbors.has(edge.source) && neighbors.has(edge.target)))

            const isRegional = edge.type === 'regional_labor_flow'
            const dimmed = selectedId != null && !highlighted

            return (
              <path
                key={`${edge.source}-${edge.target}-${index}`}
                d={edgePath(source.x, source.y, target.x, target.y, edge.type)}
                fill="none"
                stroke={isRegional ? '#d97706' : '#78716c'}
                strokeOpacity={dimmed ? 0.12 : isRegional ? 0.55 : 0.35}
                strokeWidth={highlighted ? 2.5 : 1 + edge.weight * 1.5}
                strokeDasharray={isRegional ? undefined : '5 4'}
              />
            )
          })}

          {layout.nodes.map((node) => (
            <GraphNode
              key={node.id}
              node={node}
              selected={selectedId === node.id}
              connected={selectedId != null && neighbors.has(node.id)}
              dimmed={selectedId != null && selectedId !== node.id && !neighbors.has(node.id)}
              onSelect={() => onSelect(selectedId === node.id ? null : node.id)}
            />
          ))}
        </svg>
      </div>

      {selectedNode && (
        <div className="border-t border-amber-100 bg-white/90 px-4 py-3 text-sm text-stone-600 lg:hidden">
          <SelectedSummary node={selectedNode} graph={graph} selectedId={selectedId!} />
        </div>
      )}
    </div>
  )
}

function GraphNode({
  node,
  selected,
  connected,
  dimmed,
  onSelect,
}: {
  node: LayoutNode
  selected: boolean
  connected: boolean
  dimmed: boolean
  onSelect: () => void
}) {
  const colors = styleForType(node.orgType)
  const opacity = dimmed ? 0.35 : 1

  return (
    <g
      className="cursor-pointer transition-opacity"
      style={{ opacity }}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
    >
      {(selected || connected) && (
        <circle
          cx={node.x}
          cy={node.y}
          r={node.radius + 8}
          fill={selected ? colors.ring : 'transparent'}
          stroke={selected ? colors.stroke : colors.stroke}
          strokeOpacity={connected && !selected ? 0.35 : 0.8}
          strokeWidth={selected ? 2 : 1.5}
        />
      )}
      <circle
        cx={node.x}
        cy={node.y}
        r={node.radius}
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth={selected ? 2.5 : 1.5}
      />
      {selected && (
        <>
          <rect
            x={node.x - 92}
            y={node.y - node.radius - 38}
            width={184}
            height={28}
            rx={8}
            fill="#1c1917"
            fillOpacity={0.92}
          />
          <text
            x={node.x}
            y={node.y - node.radius - 19}
            textAnchor="middle"
            className="fill-white text-[11px] font-medium"
          >
            {node.name.length > 28 ? `${node.name.slice(0, 26)}…` : node.name}
          </text>
        </>
      )}
      <text
        x={node.x}
        y={node.y + 4}
        textAnchor="middle"
        className="fill-stone-900 text-[10px] font-semibold pointer-events-none"
      >
        {Math.round(node.intentScore || 0)}
      </text>
    </g>
  )
}

export function LaborGraphSidebar({
  graph,
  selectedId,
  onSelect,
  filterType,
  onFilterType,
  search,
  onSearch,
}: {
  graph: LaborGraph
  selectedId: number | null
  onSelect: (id: number | null) => void
  filterType: string
  onFilterType: (type: string) => void
  search: string
  onSearch: (value: string) => void
}) {
  const sorted = useMemo(
    () =>
      [...graph.nodes].sort(
        (a, b) => (b.intentScore || 0) - (a.intentScore || 0) || a.name.localeCompare(b.name)
      ),
    [graph.nodes]
  )

  const selectedNode = graph.nodes.find((node) => node.id === selectedId) || null
  const neighbors = selectedId ? getNeighborIds(selectedId, graph.edges) : new Set<number>()

  const filteredList = sorted.filter((node) => {
    if (filterType !== 'all' && node.orgType !== filterType) return false
    const query = search.trim().toLowerCase()
    if (!query) return true
    return (
      node.name.toLowerCase().includes(query) ||
      (node.location || '').toLowerCase().includes(query)
    )
  })

  return (
    <aside className="flex flex-col gap-4">
      <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
        <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          Search employers
        </label>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Name, location, sector..."
            className="w-full rounded-lg border border-amber-100 bg-amber-50/50 py-2 pl-9 pr-3 text-sm outline-none ring-primary/20 focus:border-amber-300 focus:ring-2"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <FilterChip active={filterType === 'all'} onClick={() => onFilterType('all')}>
            All
          </FilterChip>
          {JOB_TYPES.map((type) => (
            <FilterChip
              key={type}
              active={filterType === type}
              onClick={() => onFilterType(type)}
            >
              {type}
            </FilterChip>
          ))}
        </div>
      </div>

      {selectedNode ? (
        <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Selected</p>
          <SelectedSummary node={selectedNode} graph={graph} selectedId={selectedNode.id} />
          {neighbors.size > 0 && (
            <div className="mt-4 border-t border-amber-50 pt-3">
              <p className="text-xs font-medium text-stone-500">Connected employers</p>
              <ul className="mt-2 space-y-1">
                {[...neighbors].map((id) => {
                  const node = graph.nodes.find((entry) => entry.id === id)
                  if (!node) return null
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => onSelect(id)}
                        className="text-left text-sm text-primary hover:underline"
                      >
                        {node.name}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/40 p-4 text-sm text-stone-600">
          Click a node or pick an employer below to inspect hiring intent, listings, and market
          connections.
        </div>
      )}

      <div className="rounded-2xl border border-amber-200 bg-white shadow-sm">
        <div className="border-b border-amber-50 px-4 py-3">
          <h2 className="font-semibold text-stone-900">Employers by intent</h2>
          <p className="text-xs text-stone-500">{filteredList.length} shown</p>
        </div>
        <ul className="max-h-[420px] overflow-y-auto divide-y divide-amber-50">
          {filteredList.map((node) => (
            <li key={node.id}>
              <button
                type="button"
                onClick={() => onSelect(node.id)}
                className={`flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition hover:bg-amber-50/60 ${
                  selectedId === node.id ? 'bg-amber-50' : ''
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-stone-900">{node.name}</p>
                  <p className="truncate text-xs text-stone-500">
                    {node.orgType || 'Employer'}
                    {node.location ? ` · ${node.location}` : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-stone-900">{Math.round(node.intentScore || 0)}</p>
                  <p className="text-[10px] text-stone-400">{intentLabel(node.intentScore)}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-amber-100 bg-white p-4 text-xs text-stone-500">
        <p className="font-medium text-stone-700">How to read this graph</p>
        <ul className="mt-2 space-y-1.5">
          <li>Markets are grouped into regional clusters.</li>
          <li>Node color = sector. Size & number = hiring intent.</li>
          <li>Solid amber curves = regional labor flow.</li>
          <li>Dashed gray lines = sector alignment.</li>
        </ul>
      </div>
    </aside>
  )
}

function SelectedSummary({
  node,
  graph,
  selectedId,
}: {
  node: LaborGraphNode
  graph: LaborGraph
  selectedId: number
}) {
  const connectionCount = graph.edges.filter(
    (edge) => edge.source === selectedId || edge.target === selectedId
  ).length

  return (
    <div className="mt-3 space-y-3">
      <div>
        <h3 className="text-lg font-semibold text-stone-900">{node.name}</h3>
        {node.location && <p className="text-sm text-stone-600">{node.location}</p>}
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <Stat label="Intent" value={`${Math.round(node.intentScore || 0)} (${intentLabel(node.intentScore)})`} />
        <Stat label="Listings" value={String(node.activeListings)} />
        <Stat label="Connections" value={String(connectionCount)} />
        <Stat label="Sector" value={node.orgType || '—'} />
      </div>
      {node.ghostRate != null && (
        <p className="text-xs text-stone-500">
          Ghost rate {Math.round(node.ghostRate * 100)}% on Haymarket applications
        </p>
      )}
      <Link to={`/employers/${node.slug}`} className="inline-flex text-sm font-medium text-primary hover:underline">
        View full employer profile
      </Link>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-amber-50/80 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-stone-500">{label}</p>
      <p className="font-medium text-stone-900">{value}</p>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-amber-50 text-stone-600 hover:bg-amber-100'
      }`}
    >
      {children}
    </button>
  )
}
