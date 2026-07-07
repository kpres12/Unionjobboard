import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Network } from 'lucide-react'
import { api } from '../api'
import LaborGraphView, { LaborGraphSidebar } from '../components/LaborGraph'
import type { LaborGraph } from '../types/intelligence'

export default function LaborGraphPage() {
  const [graph, setGraph] = useState<LaborGraph | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [filterType, setFilterType] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    api
      .getLaborGraph()
      .then(setGraph)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load graph'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <Link to="/intelligence" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" /> Intelligence
      </Link>

      <section className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-wrap items-start gap-4">
          <div className="rounded-xl bg-amber-100 p-3 text-amber-800">
            <Network className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Labor graph</p>
            <h1 className="mt-1 text-3xl font-bold text-stone-900">Where demand is clustering</h1>
            <p className="mt-2 max-w-3xl text-stone-600">
              Employers are grouped by market. Node color shows sector, size reflects hiring intent, and
              connections reveal regional labor flow versus sector alignment.
            </p>
          </div>
        </div>
      </section>

      {error && <p className="text-red-600">{error}</p>}

      {loading ? (
        <div className="rounded-2xl border border-amber-100 bg-white p-12 text-center text-stone-500">
          Building labor graph...
        </div>
      ) : !graph || graph.nodes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-amber-200 bg-white p-12 text-center text-stone-500">
          No graph data yet. Run <code className="rounded bg-amber-50 px-1">npm run sync-signals</code> after
          importing jobs.
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <LaborGraphView
            graph={graph}
            selectedId={selectedId}
            onSelect={setSelectedId}
            filterType={filterType}
            search={search}
          />
          <LaborGraphSidebar
            graph={graph}
            selectedId={selectedId}
            onSelect={setSelectedId}
            filterType={filterType}
            onFilterType={setFilterType}
            search={search}
            onSearch={setSearch}
          />
        </div>
      )}
    </div>
  )
}
