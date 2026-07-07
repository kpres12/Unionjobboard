import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api } from '../api'
import type { LaborGraph, LaborGraphNode } from '../types/intelligence'

const WIDTH = 900
const HEIGHT = 520

function nodePosition(node: LaborGraphNode, index: number, total: number) {
  const angle = (index / Math.max(total, 1)) * Math.PI * 2
  const radius = 160 + (node.intentScore || 0) * 0.8
  const cx = WIDTH / 2
  const cy = HEIGHT / 2
  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
  }
}

export default function LaborGraphPage() {
  const [graph, setGraph] = useState<LaborGraph | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState<number | null>(null)

  useEffect(() => {
    api
      .getLaborGraph()
      .then(setGraph)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load graph'))
      .finally(() => setLoading(false))
  }, [])

  const positions = useMemo(() => {
    if (!graph) return new Map<number, { x: number; y: number }>()
    const map = new Map<number, { x: number; y: number }>()
    graph.nodes.forEach((node, index) => {
      map.set(node.id, nodePosition(node, index, graph.nodes.length))
    })
    return map
  }, [graph])

  const activeNode = graph?.nodes.find((node) => node.id === activeId) || null

  return (
    <div className="space-y-6">
      <Link to="/intelligence" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" /> Intelligence
      </Link>

      <section className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-stone-900">Labor graph</h1>
        <p className="mt-2 max-w-3xl text-stone-600">
          Regional labor flows and sector alignment between employers. Nodes reflect hiring intent;
          edges connect employers in the same market or sector.
        </p>
      </section>

      {error && <p className="text-red-600">{error}</p>}

      {loading ? (
        <p className="text-stone-500">Building labor graph...</p>
      ) : !graph || graph.nodes.length === 0 ? (
        <p className="text-stone-500">No graph data yet. Run signal sync after importing jobs.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="overflow-x-auto rounded-xl border border-amber-100 bg-white p-4 shadow-sm">
            <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full min-w-[640px]">
              {graph.edges.map((edge, index) => {
                const source = positions.get(edge.source)
                const target = positions.get(edge.target)
                if (!source || !target) return null
                return (
                  <line
                    key={`${edge.source}-${edge.target}-${index}`}
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    stroke={edge.type === 'regional_labor_flow' ? '#d97706' : '#a8a29e'}
                    strokeOpacity={0.35 + edge.weight * 0.4}
                    strokeWidth={1 + edge.weight * 2}
                  />
                )
              })}

              {graph.nodes.map((node) => {
                const pos = positions.get(node.id)
                if (!pos) return null
                const radius = 10 + Math.min(node.intentScore || 0, 80) / 8
                const isActive = activeId === node.id
                return (
                  <g
                    key={node.id}
                    className="cursor-pointer"
                    onMouseEnter={() => setActiveId(node.id)}
                    onMouseLeave={() => setActiveId(null)}
                  >
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={radius}
                      fill={isActive ? '#b45309' : '#f59e0b'}
                      stroke="#78350f"
                      strokeWidth={isActive ? 2 : 1}
                    />
                    <text
                      x={pos.x}
                      y={pos.y + radius + 14}
                      textAnchor="middle"
                      className="fill-stone-700 text-[10px]"
                    >
                      {node.name.length > 22 ? `${node.name.slice(0, 20)}…` : node.name}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>

          <aside className="rounded-xl border border-amber-100 bg-white p-4 shadow-sm">
            <h2 className="font-semibold text-stone-900">Employer focus</h2>
            {activeNode ? (
              <div className="mt-3 space-y-2 text-sm">
                <p className="font-medium text-stone-900">{activeNode.name}</p>
                {activeNode.location && <p className="text-stone-600">{activeNode.location}</p>}
                <p className="text-stone-600">Intent: {Math.round(activeNode.intentScore || 0)}</p>
                <p className="text-stone-600">Listings: {activeNode.activeListings}</p>
                <Link
                  to={`/employers/${activeNode.slug}`}
                  className="inline-block text-primary hover:underline"
                >
                  View profile
                </Link>
              </div>
            ) : (
              <p className="mt-3 text-sm text-stone-500">Hover a node to inspect an employer.</p>
            )}

            <div className="mt-6 border-t border-amber-50 pt-4 text-xs text-stone-500">
              <p className="font-medium text-stone-700">Edge types</p>
              <p className="mt-2">Amber: regional labor flow</p>
              <p>Gray: sector alignment</p>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
