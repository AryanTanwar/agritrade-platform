import { format } from 'date-fns'
import {
  ShoppingCart, CheckCircle, Shield, Truck, Package,
  Star, AlertTriangle, XCircle, Lock,
} from 'lucide-react'

const STATUS_CONFIG = {
  placed:       { label: 'Order Placed',        Icon: ShoppingCart,  ring: 'ring-blue-300',   bg: 'bg-blue-100',   text: 'text-blue-700'   },
  confirmed:    { label: 'Farmer Confirmed',     Icon: CheckCircle,   ring: 'ring-green-300',  bg: 'bg-green-100',  text: 'text-green-700'  },
  escrow_held:  { label: 'Payment Secured',      Icon: Shield,        ring: 'ring-purple-300', bg: 'bg-purple-100', text: 'text-purple-700' },
  in_transit:   { label: 'Shipment In Transit',  Icon: Truck,         ring: 'ring-orange-300', bg: 'bg-orange-100', text: 'text-orange-700' },
  delivered:    { label: 'Delivered',            Icon: Package,       ring: 'ring-teal-300',   bg: 'bg-teal-100',   text: 'text-teal-700'   },
  completed:    { label: 'Trade Completed',      Icon: Star,          ring: 'ring-emerald-300',bg: 'bg-emerald-100',text: 'text-emerald-700'},
  disputed:     { label: 'Under Dispute',        Icon: AlertTriangle, ring: 'ring-red-300',    bg: 'bg-red-100',    text: 'text-red-700'    },
  cancelled:    { label: 'Cancelled',            Icon: XCircle,       ring: 'ring-gray-300',   bg: 'bg-gray-100',   text: 'text-gray-500'   },
}

const DEFAULT_CFG = { label: 'Event', Icon: CheckCircle, ring: 'ring-gray-300', bg: 'bg-gray-100', text: 'text-gray-600' }

export default function BlockchainTimeline({ history = [] }) {
  if (!history.length) {
    return <p className="text-sm text-gray-400 italic py-4">No on-chain history available yet.</p>
  }

  return (
    <ol className="relative border-l-2 border-gray-200 ml-4 space-y-0">
      {history.map((entry, i) => {
        const status = entry.value?.status ?? entry.status
        const cfg    = STATUS_CONFIG[status] ?? { ...DEFAULT_CFG, label: status }
        const { label, Icon, ring, bg, text } = cfg
        const ts = entry.timestamp ? new Date(entry.timestamp) : null

        return (
          <li key={entry.txId ?? i} className="mb-8 ml-7">
            <span className={`absolute flex items-center justify-center w-9 h-9 rounded-full -left-[18px] ring-2 ring-white ${bg} ${ring}`}>
              <Icon className={`w-4 h-4 ${text}`} />
            </span>

            <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`font-semibold text-sm ${text}`}>{label}</p>
                  {ts && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {format(ts, 'dd MMM yyyy · HH:mm:ss')}
                    </p>
                  )}
                  {entry.value?.actor?.mspId && (
                    <p className="text-xs text-gray-500 mt-1">
                      org: <span className="font-mono">{entry.value.actor.mspId}</span>
                    </p>
                  )}
                </div>

                {entry.txId && (
                  <div className="shrink-0 text-right">
                    <div className="flex items-center gap-1 text-xs text-gray-400 mb-1 justify-end">
                      <Lock className="w-3 h-3" />
                      Fabric TX
                    </div>
                    <code className="text-xs font-mono bg-gray-50 text-gray-600 px-2 py-1 rounded border border-gray-200 block">
                      {entry.txId.slice(0, 8)}…{entry.txId.slice(-6)}
                    </code>
                  </div>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
