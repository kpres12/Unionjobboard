import type { LaborGraphEdge, LaborGraphNode } from '../types/intelligence'

export interface LayoutNode extends LaborGraphNode {
  x: number
  y: number
  radius: number
}

export interface LayoutCluster {
  id: string
  label: string
  x: number
  y: number
  width: number
  height: number
  nodeIds: number[]
}

export interface GraphLayout {
  width: number
  height: number
  nodes: LayoutNode[]
  clusters: LayoutCluster[]
  positions: Map<number, { x: number; y: number; radius: number }>
}

const PADDING = 48
const CLUSTER_GAP = 32
const NODE_GAP = 28

function clusterLabel(cluster: string, nodes: LaborGraphNode[]) {
  if (cluster === 'unknown' || cluster === 'remote') return 'Unplaced'
  const sample = nodes.find((node) => node.location)?.location
  if (sample) {
    const city = sample.split(',')[0].trim()
    if (city) return city
  }
  return cluster
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function nodeRadius(intentScore?: number | null) {
  return 14 + Math.min(intentScore || 0, 80) / 6
}

export function computeClusteredLayout(
  nodes: LaborGraphNode[],
  width = 960,
  minHeight = 560
): GraphLayout {
  const grouped = new Map<string, LaborGraphNode[]>()

  for (const node of nodes) {
    const key = node.cluster?.trim() || 'unknown'
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(node)
  }

  const clusterEntries = [...grouped.entries()].sort(
    (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])
  )

  const clusters: LayoutCluster[] = []
  const layoutNodes: LayoutNode[] = []
  const positions = new Map<number, { x: number; y: number; radius: number }>()

  const maxRowWidth = Math.max(320, width - PADDING * 2)
  let cursorX = PADDING
  let cursorY = PADDING
  let rowHeight = 0
  let maxBottom = PADDING + 120

  for (const [clusterId, clusterNodes] of clusterEntries) {
    const sorted = [...clusterNodes].sort(
      (a, b) => (b.intentScore || 0) - (a.intentScore || 0) || a.name.localeCompare(b.name)
    )

    const radii = sorted.map((node) => nodeRadius(node.intentScore))
    const maxRadius = Math.max(...radii, 16)
    const innerWidth = Math.max(180, maxRadius * 2 + 48)
    const innerHeight = sorted.reduce((sum, _, index) => sum + radii[index] * 2 + NODE_GAP, 0) + 56
    const clusterHeight = innerHeight + 40
    const clusterWidth = innerWidth + 24

    if (cursorX > PADDING && cursorX + clusterWidth - PADDING > maxRowWidth) {
      cursorX = PADDING
      cursorY += rowHeight + CLUSTER_GAP
      rowHeight = 0
    }

    const clusterX = cursorX
    const clusterY = cursorY
    let nodeY = clusterY + 52 + maxRadius

    for (let index = 0; index < sorted.length; index += 1) {
      const node = sorted[index]
      const radius = radii[index]
      const x = clusterX + clusterWidth / 2
      const y = nodeY

      const layoutNode: LayoutNode = { ...node, x, y, radius }
      layoutNodes.push(layoutNode)
      positions.set(node.id, { x, y, radius })
      nodeY += radius * 2 + NODE_GAP
    }

    clusters.push({
      id: clusterId,
      label: clusterLabel(clusterId, sorted),
      x: clusterX,
      y: clusterY,
      width: clusterWidth,
      height: clusterHeight,
      nodeIds: sorted.map((node) => node.id),
    })

    rowHeight = Math.max(rowHeight, clusterHeight)
    maxBottom = Math.max(maxBottom, clusterY + clusterHeight)
    cursorX += clusterWidth + CLUSTER_GAP
  }

  const computedWidth = width
  const computedHeight = Math.max(minHeight, maxBottom + PADDING)

  return {
    width: computedWidth,
    height: computedHeight,
    nodes: layoutNodes,
    clusters,
    positions,
  }
}

export function getNeighborIds(nodeId: number, edges: LaborGraphEdge[]) {
  const neighbors = new Set<number>()
  for (const edge of edges) {
    if (edge.source === nodeId) neighbors.add(edge.target)
    if (edge.target === nodeId) neighbors.add(edge.source)
  }
  return neighbors
}

export function edgePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  type: string
) {
  if (type === 'sector_alignment') {
    return `M ${x1} ${y1} L ${x2} ${y2}`
  }

  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const dx = x2 - x1
  const dy = y2 - y1
  const curve = Math.min(80, Math.hypot(dx, dy) * 0.25)
  const cx = mx - dy * 0.12
  const cy = my + dx * 0.12 + (dx >= 0 ? curve : -curve) * 0.15
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`
}
