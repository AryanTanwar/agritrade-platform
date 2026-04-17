import { Link } from 'react-router-dom'
import { useMyListings, useDeleteListing } from '../../hooks/useListings'
import { Plus, Edit, Trash2, Leaf, Package } from 'lucide-react'
import { useState } from 'react'

const STATUS_COLOR = {
  active:    'bg-green-100 text-green-700',
  sold_out:  'bg-gray-100 text-gray-500',
  expired:   'bg-red-100 text-red-500',
  cancelled: 'bg-gray-100 text-gray-400',
}

export default function Listings() {
  const { data, isLoading } = useMyListings()
  const deleteListing       = useDeleteListing()
  const [deleting, setDeleting] = useState(null)

  const listings = data?.listings ?? data?.data ?? []

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this listing? This cannot be undone.')) return
    setDeleting(id)
    try { await deleteListing.mutateAsync(id) }
    finally { setDeleting(null) }
  }

  if (isLoading) return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-24 bg-white rounded-xl border animate-pulse" />
      ))}
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Listings</h1>
        <Link
          to="/farmer/listings/new"
          className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> New Listing
        </Link>
      </div>

      {listings.length === 0 && (
        <div className="text-center py-20">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">No listings yet. Create your first produce listing.</p>
          <Link to="/farmer/listings/new" className="text-sm text-green-600 hover:text-green-700 font-medium">
            + Create Listing
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {listings.map(listing => (
          <div
            key={listing.id}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-2xl shrink-0">
              {listing.is_organic ? '🌿' : '🌾'}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="font-semibold text-gray-800 truncate">{listing.title}</p>
                {listing.is_organic && (
                  <span className="shrink-0 flex items-center gap-0.5 text-xs text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">
                    <Leaf className="w-3 h-3" /> Organic
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>₹{listing.price_per_unit?.toLocaleString()}/{listing.unit}</span>
                <span>{listing.quantity?.toLocaleString()} {listing.unit} left</span>
                <span className={`px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLOR[listing.status] ?? 'bg-gray-100 text-gray-500'}`}>
                  {listing.status}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link
                to={`/farmer/listings/${listing.id}/edit`}
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Edit"
              >
                <Edit className="w-4 h-4" />
              </Link>
              <button
                onClick={() => handleDelete(listing.id)}
                disabled={deleting === listing.id}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
