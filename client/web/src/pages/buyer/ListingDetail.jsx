import { useParams, useNavigate } from 'react-router-dom'
import { useListing } from '../../hooks/useListings'
import { MapPin, Scale, Calendar, Leaf, ArrowLeft, ShoppingCart } from 'lucide-react'
import { format } from 'date-fns'

const CATEGORY_EMOJI = {
  grains: '🌾', vegetables: '🥦', fruits: '🍎',
  dairy: '🥛', spices: '🌶️', pulses: '🫘',
  oilseeds: '🌻', other: '📦',
}

export default function ListingDetail() {
  const { id }       = useParams()
  const navigate     = useNavigate()
  const { data: listing, isLoading, isError } = useListing(id)

  if (isLoading) return (
    <div className="max-w-2xl mx-auto space-y-4 animate-pulse">
      <div className="h-56 bg-gray-100 rounded-2xl" />
      <div className="h-8 bg-gray-100 rounded w-2/3" />
      <div className="h-4 bg-gray-100 rounded w-1/3" />
    </div>
  )

  if (isError || !listing) return (
    <div className="text-center py-20 text-red-500">Listing not found.</div>
  )

  const {
    title, category, price_per_unit, unit, quantity,
    location, is_organic, description, harvest_date,
    expiry_date, farmer, status,
  } = listing

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="h-56 bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center text-8xl">
          {CATEGORY_EMOJI[category] ?? '📦'}
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            {is_organic && (
              <span className="shrink-0 flex items-center gap-1 text-sm font-medium text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-full">
                <Leaf className="w-3.5 h-3.5" /> Organic
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Price per {unit}</p>
              <p className="text-2xl font-bold text-green-700">₹{price_per_unit.toLocaleString()}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Available Stock</p>
              <p className="text-2xl font-bold text-gray-800">{quantity.toLocaleString()} <span className="text-base font-normal text-gray-500">{unit}</span></p>
            </div>
          </div>

          <div className="space-y-3">
            {location?.city && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin className="w-4 h-4 text-gray-400" />
                {location.city}{location.state ? `, ${location.state}` : ''}
              </div>
            )}
            {harvest_date && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="w-4 h-4 text-gray-400" />
                Harvested: {format(new Date(harvest_date), 'dd MMM yyyy')}
              </div>
            )}
            {expiry_date && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="w-4 h-4 text-gray-400" />
                Best before: {format(new Date(expiry_date), 'dd MMM yyyy')}
              </div>
            )}
          </div>

          {description && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1.5">About this produce</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
            </div>
          )}

          {farmer && (
            <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold">
                {farmer.name?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-sm text-gray-800">{farmer.name}</p>
                <p className="text-xs text-gray-500">Verified Farmer</p>
              </div>
            </div>
          )}

          {status === 'active' && (
            <button
              onClick={() => navigate(`/orders/place/${id}`)}
              className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
            >
              <ShoppingCart className="w-4 h-4" />
              Place Order
            </button>
          )}

          {status !== 'active' && (
            <div className="w-full text-center py-3 bg-gray-100 text-gray-500 rounded-xl text-sm font-medium">
              This listing is no longer available
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
