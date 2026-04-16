import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useOrder } from '../../hooks/useOrders'
import { paymentApi } from '../../api'
import { Shield, CheckCircle, XCircle, Loader } from 'lucide-react'

function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return }
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload  = () => resolve(true)
    s.onerror = () => resolve(false)
    document.body.appendChild(s)
  })
}

export default function PaymentFlow() {
  const { orderId }  = useParams()
  const navigate     = useNavigate()
  const { data: order, isLoading } = useOrder(orderId)

  const [status,  setStatus]  = useState('idle') // idle | loading | success | error
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!order || order.status !== 'confirmed') return
    // Auto-prompt payment once the order is confirmed by the farmer
  }, [order])

  const handlePay = async () => {
    setStatus('loading')
    setMessage('')

    const loaded = await loadRazorpay()
    if (!loaded) {
      setStatus('error')
      setMessage('Failed to load payment gateway. Check your connection.')
      return
    }

    try {
      const { data: rzpOrder } = await paymentApi.createOrder(orderId)

      await new Promise((resolve, reject) => {
        const options = {
          key:        rzpOrder.key,
          amount:     rzpOrder.amount,
          currency:   rzpOrder.currency ?? 'INR',
          name:       'AgriTrade',
          description:`Order #${orderId.slice(0, 8)}`,
          order_id:   rzpOrder.razorpayOrderId,
          theme:      { color: '#16a34a' },
          handler: async (response) => {
            try {
              await paymentApi.verify({
                razorpayOrderId:   response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                orderId,
              })
              resolve()
            } catch (err) {
              reject(err)
            }
          },
          modal: {
            ondismiss: () => reject(new Error('Payment cancelled')),
          },
        }
        new window.Razorpay(options).open()
      })

      setStatus('success')
      setTimeout(() => navigate(`/orders/${orderId}`), 2000)
    } catch (err) {
      if (err.message === 'Payment cancelled') {
        setStatus('idle')
      } else {
        setStatus('error')
        setMessage(err.response?.data?.message ?? 'Payment failed. Please try again.')
      }
    }
  }

  if (isLoading || !order) return (
    <div className="max-w-md mx-auto text-center py-20">
      <Loader className="w-8 h-8 animate-spin text-green-600 mx-auto" />
    </div>
  )

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Secure Payment</h1>

      {status === 'success' && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-green-700 mb-2">Payment Successful!</h2>
          <p className="text-sm text-gray-600">
            Your payment is secured in escrow. Funds release to the farmer once you confirm delivery.
          </p>
          <p className="text-xs text-gray-400 mt-4">Redirecting to order tracking…</p>
        </div>
      )}

      {status !== 'success' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Order ID</span>
              <code className="font-mono text-gray-700 text-xs">{orderId.slice(0, 12)}…</code>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Amount</span>
              <span className="font-bold text-gray-800">₹{order.total_amount?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Status</span>
              <span className="capitalize text-gray-600">{order.status?.replace(/_/g, ' ')}</span>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
            <Shield className="w-5 h-5 shrink-0 mt-0.5" />
            <p>
              Your payment is held in <strong>smart contract escrow</strong> on Hyperledger Fabric.
              Funds are released to the farmer only after you confirm delivery.
            </p>
          </div>

          {status === 'error' && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
              <XCircle className="w-4 h-4 shrink-0" />
              {message}
            </div>
          )}

          {order.status === 'placed' && (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-4">
              Waiting for the farmer to confirm your order before payment can proceed.
            </div>
          )}

          {order.status === 'confirmed' && (
            <button
              onClick={handlePay}
              disabled={status === 'loading'}
              className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
            >
              {status === 'loading'
                ? <><Loader className="w-4 h-4 animate-spin" /> Processing…</>
                : <><Shield className="w-4 h-4" /> Pay ₹{order.total_amount?.toLocaleString()} Securely</>
              }
            </button>
          )}

          <button onClick={() => navigate(`/orders/${orderId}`)} className="w-full text-center text-sm text-gray-400 hover:text-gray-600">
            View order details
          </button>
        </div>
      )}
    </div>
  )
}
