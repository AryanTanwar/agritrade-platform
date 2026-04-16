import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useListing } from '../../hooks/useListings'
import { usePlaceOrder } from '../../hooks/useOrders'
import { ArrowLeft, MapPin } from 'lucide-react'

export default function PlaceOrder() {
  const { listingId } = useParams()
  const navigate      = useNavigate()
  const { data: listing, isLoading } = useListing(listingId)
  const placeOrder    = usePlaceOrder()

  const [qty, setQty]   = useState(1)
  const [addr, setAddr] = useState({ line1: '', city: '', state: '', pincode: '' })
  const [error, setError] = useState('')

  const set = (field) => (e) => setAddr(a => ({ ...a, [field]: e.target.value }))

  if (isLoading || !listing) return (
    <div className="max-w-lg mx-auto space-y-4 animate-pulse">
      <div className="h-8 bg-gray-100 rounded w-1/2" />
      <div className="h-48 bg-gray-100 rounded-xl" />
    </div>
  )

  const { title, price_per_unit, unit, quantity: stock } = listing
  const total = (qty * price_per_unit).toFixed(2)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const { data } = await placeOrder.mutateAsync({
        listing_id:       listingId,
        quantity:         qty,
        delivery_address: `${addr.line1}, ${addr.city}`,
        delivery_pincode: addr.pincode,
      })
      navigate(`/orders/${data.id}/pay`)
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to place order. Try again.')
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Place Order</h1>

      <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
        <p className="text-sm font-medium text-gray-700">{title}</p>
        <p className="text-green-700 font-bold mt-0.5">₹{price_per_unit.toLocaleString()} / {unit}</p>
        <p className="text-xs text-gray-500 mt-0.5">{stock.toLocaleString()} {unit} available</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Quantity ({unit})
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setQty(q => Math.max(1, q - 1))}
              className="w-9 h-9 rounded-lg border border-gray-300 flex items-center justify-center text-lg hover:bg-gray-50"
            >−</button>
            <input
              type="number" min={1} max={stock}
              value={qty} onChange={e => setQty(Math.min(stock, Math.max(1, +e.target.value)))}
              className="w-24 text-center border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              type="button"
              onClick={() => setQty(q => Math.min(stock, q + 1))}
              className="w-9 h-9 rounded-lg border border-gray-300 flex items-center justify-center text-lg hover:bg-gray-50"
            >+</button>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-3">
            <MapPin className="w-4 h-4" /> Delivery Address
          </div>
          <div className="space-y-3">
            <input
              type="text" required placeholder="Street address"
              value={addr.line1} onChange={set('line1')}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text" required placeholder="City"
                value={addr.city} onChange={set('city')}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <input
                type="text" required placeholder="State"
                value={addr.state} onChange={set('state')}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <input
              type="text" required placeholder="Pincode" maxLength={6} pattern="\d{6}"
              value={addr.pincode} onChange={set('pincode')}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-gray-600">{qty} × ₹{price_per_unit.toLocaleString()}</span>
            <span className="text-sm font-medium text-gray-800">₹{total}</span>
          </div>
          <div className="flex justify-between items-center font-bold">
            <span className="text-gray-800">Total</span>
            <span className="text-green-700 text-lg">₹{total}</span>
          </div>
        </div>

        <button
          type="submit" disabled={placeOrder.isPending}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
        >
          {placeOrder.isPending ? 'Placing order…' : 'Proceed to Payment →'}
        </button>
      </form>
    </div>
  )
}
