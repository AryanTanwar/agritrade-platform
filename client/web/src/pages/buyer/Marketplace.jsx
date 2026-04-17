import { useState } from 'react'
import { Search, SlidersHorizontal, Leaf, X } from 'lucide-react'
import { useListings } from '../../hooks/useListings'
import ListingCard from '../../components/ListingCard'

const CATEGORIES = ['all', 'grains', 'vegetables', 'fruits', 'dairy', 'spices', 'pulses', 'oilseeds', 'other']

export default function Marketplace() {
  const [search,   setSearch]   = useState('')
  const [category, setCategory] = useState('all')
  const [organic,  setOrganic]  = useState(false)
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [page,     setPage]     = useState(1)

  const params = {
    ...(search   && { search }),
    ...(category !== 'all' && { category }),
    ...(organic  && { is_organic: true }),
    ...(minPrice && { min_price: minPrice }),
    ...(maxPrice && { max_price: maxPrice }),
    page,
    limit: 12,
  }

  const { data, isLoading, isError } = useListings(params)
  const listings = data?.listings ?? data?.data ?? []
  const total    = data?.total ?? 0

  const clearFilters = () => {
    setCategory('all')
    setOrganic(false)
    setMinPrice('')
    setMaxPrice('')
    setSearch('')
    setPage(1)
  }

  const hasFilters = category !== 'all' || organic || minPrice || maxPrice || search

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Marketplace</h1>
        <p className="text-gray-500 text-sm mt-1">Fresh produce, direct from farms</p>
      </div>

      {/* Search + filter bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text" placeholder="Search produce…"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-gray-400" />
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => { setCategory(cat); setPage(1) }}
              className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
                category === cat
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}

          <button
            onClick={() => { setOrganic(o => !o); setPage(1) }}
            className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              organic ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Leaf className="w-3 h-3" /> Organic
          </button>

          <div className="flex items-center gap-1 ml-auto">
            <input
              type="number" placeholder="Min ₹"
              value={minPrice} onChange={e => { setMinPrice(e.target.value); setPage(1) }}
              className="w-20 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
            />
            <span className="text-gray-400 text-xs">–</span>
            <input
              type="number" placeholder="Max ₹"
              value={maxPrice} onChange={e => { setMaxPrice(e.target.value); setPage(1) }}
              className="w-20 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>

          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 animate-pulse">
              <div className="h-36 bg-gray-100 rounded-t-xl" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-gray-100 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {isError && (
        <div className="text-center py-16 text-red-500">Failed to load listings. Please try again.</div>
      )}

      {!isLoading && !isError && listings.length === 0 && (
        <div className="text-center py-20">
          <p className="text-4xl mb-3">🌾</p>
          <p className="text-gray-500">No listings found. Try adjusting your filters.</p>
        </div>
      )}

      {!isLoading && listings.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{total} listing{total !== 1 ? 's' : ''} found</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {listings.map(l => <ListingCard key={l.id} listing={l} />)}
          </div>

          {total > 12 && (
            <div className="flex justify-center gap-2 pt-4">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-sm text-gray-600">Page {page}</span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={listings.length < 12}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
