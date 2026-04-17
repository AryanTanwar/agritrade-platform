import { Link } from 'react-router-dom'
import { useOrders } from '../../hooks/useOrders'
import { format } from 'date-fns'
import { ChevronRight, Package } from 'lucide-react'

const STATUS_COLOR = {
  placed:       'bg-blue-100 text-blue-700',
  confirmed:    'bg-amber-100 text-amber-700',
  escrow_held:  'bg-purple-100 text-purple-700',
  in_transit:   'bg-orange-100 text-orange-700',
  delivered:    'bg-teal-100 text-teal-700',
  completed:    'bg-green-100 text-green-700',
  disputed:     'bg-red-100 text-red-700',
  cancelled:    'bg-gray-100 text-gray-500',
}

export default function MyOrders() {
  const { data, isLoading, isError } = useOrders()
  const orders = data?.orders ?? data?.data ?? []

  if (isLoading) return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-20 bg-white rounded-xl border animate-pulse" />
      ))}
    </div>
  )

  if (isError) return <p className="text-red-500 text-center py-10">Failed to load orders.</p>

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>

      {orders.length === 0 && (
        <div className="text-center py-20">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No orders yet. Start shopping on the marketplace!</p>
          <Link to="/" className="mt-4 inline-block text-sm text-green-600 hover:text-green-700 font-medium">
            Browse Marketplace →
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {orders.map(order => (
          <Link
            key={order.id}
            to={`/orders/${order.id}`}
            className="block bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-green-200 transition-all p-4"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <code className="text-xs font-mono text-gray-400">#{order.id.slice(0, 8)}</code>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_COLOR[order.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {order.status?.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="font-medium text-sm text-gray-800 truncate">
                  {order.quantity} {order.unit} — ₹{order.total_amount?.toLocaleString()}
                </p>
                {order.created_at && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {format(new Date(order.created_at), 'dd MMM yyyy')}
                  </p>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
