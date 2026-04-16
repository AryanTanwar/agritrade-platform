import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useOrders, useConfirmOrder, useCompleteOrder } from '../../hooks/useOrders'
import { format } from 'date-fns'
import { CheckCircle, Star, ChevronRight, Filter } from 'lucide-react'

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

const FILTERS = ['all', 'placed', 'confirmed', 'escrow_held', 'in_transit', 'delivered', 'completed', 'disputed']

export default function FarmerOrders() {
  const [filter, setFilter] = useState('all')
  const { data, isLoading, refetch } = useOrders()
  const confirmOrder  = useConfirmOrder()
  const completeOrder = useCompleteOrder()
  const [actionError, setActionError] = useState('')

  const all    = data?.orders ?? data?.data ?? []
  const orders = filter === 'all' ? all : all.filter(o => o.status === filter)

  const handleConfirm = async (id) => {
    setActionError('')
    try { await confirmOrder.mutateAsync(id); refetch() }
    catch (err) { setActionError(err.response?.data?.message ?? 'Failed to confirm.') }
  }

  const handleComplete = async (id) => {
    setActionError('')
    try { await completeOrder.mutateAsync(id); refetch() }
    catch (err) { setActionError(err.response?.data?.message ?? 'Failed to complete.') }
  }

  if (isLoading) return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-28 bg-white rounded-xl border animate-pulse" />
      ))}
    </div>
  )

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Incoming Orders</h1>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter className="w-4 h-4 text-gray-400" />
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
              filter === f ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {actionError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
          {actionError}
        </div>
      )}

      {orders.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📦</p>
          No {filter !== 'all' ? filter.replace(/_/g, ' ') + ' ' : ''}orders found.
        </div>
      )}

      <div className="space-y-3">
        {orders.map(order => (
          <div
            key={order.id}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <code className="text-xs font-mono text-gray-400">#{order.id.slice(0, 8)}</code>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_COLOR[order.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {order.status?.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-sm font-semibold text-gray-800">
                  {order.quantity} {order.unit} · ₹{order.total_amount?.toLocaleString()}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {order.delivery_address}
                </p>
              </div>
              <div className="text-right text-xs text-gray-400 shrink-0">
                {order.created_at ? format(new Date(order.created_at), 'dd MMM yyyy') : ''}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {order.status === 'placed' && (
                <button
                  onClick={() => handleConfirm(order.id)}
                  disabled={confirmOrder.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  {confirmOrder.isPending ? 'Confirming…' : 'Confirm Order'}
                </button>
              )}
              {order.status === 'delivered' && (
                <button
                  onClick={() => handleComplete(order.id)}
                  disabled={completeOrder.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  <Star className="w-3.5 h-3.5" />
                  {completeOrder.isPending ? '…' : 'Mark Complete'}
                </button>
              )}
              <Link
                to={`/orders/${order.id}`}
                className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors ml-auto"
              >
                View Details <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
