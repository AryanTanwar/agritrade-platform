import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useOrder, useOrderHistory, useDeliverOrder, useDisputeOrder } from '../../hooks/useOrders'
import BlockchainTimeline from '../../components/BlockchainTimeline'
import { format } from 'date-fns'
import {
  ArrowLeft, Shield, Truck, AlertTriangle,
  CheckCircle, RefreshCw, Package,
} from 'lucide-react'

const STATUS_STEPS = ['placed', 'confirmed', 'escrow_held', 'in_transit', 'delivered', 'completed']

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

function ProgressBar({ status }) {
  const idx = STATUS_STEPS.indexOf(status)
  const pct = idx < 0 ? 0 : Math.round((idx / (STATUS_STEPS.length - 1)) * 100)
  return (
    <div className="mb-6">
      <div className="flex justify-between text-xs text-gray-400 mb-2">
        <span>Placed</span>
        <span>Completed</span>
      </div>
      <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="absolute h-full bg-green-500 rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function OrderTracking() {
  const { id }       = useParams()
  const navigate     = useNavigate()
  const { data: order, isLoading, refetch }   = useOrder(id)
  const { data: history = [], isLoading: histLoading } = useOrderHistory(id)
  const deliverOrder = useDeliverOrder()
  const disputeOrder = useDisputeOrder()

  const [disputeReason, setDisputeReason]   = useState('')
  const [showDisputeForm, setShowDisputeForm] = useState(false)
  const [actionError, setActionError]         = useState('')

  if (isLoading) return (
    <div className="max-w-2xl mx-auto space-y-4 animate-pulse">
      <div className="h-8 bg-gray-100 rounded w-1/3" />
      <div className="h-48 bg-gray-100 rounded-2xl" />
      <div className="h-64 bg-gray-100 rounded-2xl" />
    </div>
  )

  if (!order) return <p className="text-center py-20 text-gray-500">Order not found.</p>

  const canConfirmDelivery = order.status === 'in_transit'
  const canDispute         = ['confirmed', 'escrow_held', 'in_transit', 'delivered'].includes(order.status)
  const needsPayment       = order.status === 'confirmed'

  const handleDeliver = async () => {
    setActionError('')
    try {
      await deliverOrder.mutateAsync(id)
      refetch()
    } catch (err) {
      setActionError(err.response?.data?.message ?? 'Action failed.')
    }
  }

  const handleDispute = async (e) => {
    e.preventDefault()
    setActionError('')
    try {
      await disputeOrder.mutateAsync({ id, reason: disputeReason })
      setShowDisputeForm(false)
      refetch()
    } catch (err) {
      setActionError(err.response?.data?.message ?? 'Failed to raise dispute.')
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/orders')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> My Orders
        </button>
        <button onClick={() => refetch()} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Order summary card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Order Tracking</h1>
            <code className="text-xs font-mono text-gray-400">#{order.id}</code>
          </div>
          <span className={`text-sm font-medium px-3 py-1 rounded-full capitalize ${STATUS_COLOR[order.status] ?? 'bg-gray-100 text-gray-500'}`}>
            {order.status?.replace(/_/g, ' ')}
          </span>
        </div>

        <ProgressBar status={order.status} />

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-400 text-xs mb-0.5">Quantity</p>
            <p className="font-medium text-gray-800">{order.quantity} {order.unit}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs mb-0.5">Total Amount</p>
            <p className="font-bold text-green-700">₹{order.total_amount?.toLocaleString()}</p>
          </div>
          {order.created_at && (
            <div>
              <p className="text-gray-400 text-xs mb-0.5">Ordered on</p>
              <p className="font-medium text-gray-800">{format(new Date(order.created_at), 'dd MMM yyyy')}</p>
            </div>
          )}
          {order.delivery_address && (
            <div>
              <p className="text-gray-400 text-xs mb-0.5">Delivery Address</p>
              <p className="font-medium text-gray-800 text-xs leading-relaxed">{order.delivery_address}</p>
            </div>
          )}
        </div>

        {/* Escrow status */}
        {['escrow_held', 'in_transit', 'delivered'].includes(order.status) && (
          <div className="mt-4 flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-xl p-3 text-sm text-purple-700">
            <Shield className="w-4 h-4 shrink-0" />
            Payment of <strong>₹{order.total_amount?.toLocaleString()}</strong> is secured in escrow
          </div>
        )}
      </div>

      {/* Action buttons */}
      {actionError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
          {actionError}
        </div>
      )}

      {needsPayment && (
        <button
          onClick={() => navigate(`/orders/${id}/pay`)}
          className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
        >
          <Shield className="w-4 h-4" /> Pay Now to Secure Order
        </button>
      )}

      {canConfirmDelivery && (
        <button
          onClick={handleDeliver}
          disabled={deliverOrder.isPending}
          className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-300 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
        >
          <Package className="w-4 h-4" />
          {deliverOrder.isPending ? 'Confirming…' : 'Confirm Delivery Received'}
        </button>
      )}

      {order.status === 'delivered' && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 text-sm text-teal-700">
          <div className="flex items-center gap-2 mb-1 font-semibold">
            <CheckCircle className="w-4 h-4" /> Delivery confirmed
          </div>
          Payment will be released to the farmer shortly.
        </div>
      )}

      {canDispute && !showDisputeForm && (
        <button
          onClick={() => setShowDisputeForm(true)}
          className="w-full flex items-center justify-center gap-2 border border-red-300 text-red-600 hover:bg-red-50 font-medium py-2.5 rounded-xl text-sm transition-colors"
        >
          <AlertTriangle className="w-4 h-4" /> Raise a Dispute
        </button>
      )}

      {showDisputeForm && (
        <form onSubmit={handleDispute} className="bg-white rounded-xl border border-red-200 p-4 space-y-3">
          <h3 className="font-semibold text-red-700 text-sm">Raise Dispute</h3>
          <textarea
            required
            placeholder="Describe the issue (damaged goods, wrong quantity, etc.)"
            value={disputeReason} onChange={e => setDisputeReason(e.target.value)}
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowDisputeForm(false)} className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={disputeOrder.isPending} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-sm font-medium transition-colors">
              {disputeOrder.isPending ? 'Submitting…' : 'Submit Dispute'}
            </button>
          </div>
        </form>
      )}

      {/* Blockchain timeline */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-5">
          <Truck className="w-5 h-5 text-gray-400" />
          <h2 className="font-bold text-gray-800">Blockchain Audit Trail</h2>
        </div>
        {histLoading
          ? <div className="space-y-4 animate-pulse">{Array.from({length:3}).map((_,i)=><div key={i} className="h-16 bg-gray-50 rounded-xl"/>)}</div>
          : <BlockchainTimeline history={history} />
        }
      </div>
    </div>
  )
}
