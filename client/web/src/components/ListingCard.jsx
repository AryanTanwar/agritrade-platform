import { Link } from 'react-router-dom'
import { MapPin, Scale, Leaf } from 'lucide-react'

const CATEGORY_EMOJI = {
  grains:      '🌾', vegetables: '🥦', fruits:  '🍎',
  dairy:       '🥛', spices:     '🌶️', pulses: '🫘',
  oilseeds:    '🌻', other:      '📦',
}

export default function ListingCard({ listing }) {
  const {
    id, title, category, price_per_unit, unit,
    quantity, location, is_organic, status, farmer,
  } = listing

  if (status !== 'active') return null

  return (
    <Link
      to={`/listings/${id}`}
      className="group block bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-green-200 transition-all overflow-hidden"
    >
      <div className="h-36 bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center text-5xl">
        {CATEGORY_EMOJI[category] ?? '📦'}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-gray-800 text-sm leading-tight group-hover:text-green-700 line-clamp-2">
            {title}
          </h3>
          {is_organic && (
            <span className="shrink-0 flex items-center gap-0.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">
              <Leaf className="w-3 h-3" /> Organic
            </span>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-green-700">
              ₹{price_per_unit.toLocaleString()}
              <span className="text-xs font-normal text-gray-500">/{unit}</span>
            </span>
          </div>

          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Scale className="w-3.5 h-3.5" />
            {quantity.toLocaleString()} {unit} available
          </div>

          {location?.city && (
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <MapPin className="w-3.5 h-3.5" />
              {location.city}{location.state ? `, ${location.state}` : ''}
            </div>
          )}
        </div>

        {farmer?.name && (
          <div className="mt-3 pt-3 border-t border-gray-50 flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-green-700 text-xs font-bold">
              {farmer.name[0].toUpperCase()}
            </div>
            <span className="text-xs text-gray-500">{farmer.name}</span>
          </div>
        )}
      </div>
    </Link>
  )
}
