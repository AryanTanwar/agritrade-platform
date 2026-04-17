import { Link } from 'react-router-dom'
import { useMyListings } from '../../hooks/useListings'
import { useOrders } from '../../hooks/useOrders'
import { useAuth } from '../../contexts/AuthContext'
import { ShoppingBag, ListOrdered, TrendingUp, Truck, Plus, ArrowRight } from 'lucide-react'
import { format } from 'date-fns'

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

function StatCard({ icon: Icon, label, value, sub, color = 'green' }) {
  const colors = {
    green:  'bg-green-50  text-green-600',
    blue:   'bg-blue-50   text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm font-medium text-gray-600 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const { data: listingsData } = useMyListings()
  const { data: ordersData }   = useOrders()

  const listings = listingsData?.listings ?? listingsData?.data ?? []
  const orders   = ordersData?.orders    ?? ordersData?.data   ?? []

  const activeListings    = listings.filter(l => l.status === 'active').length
  const pendingOrders     = orders.filter(o => o.status === 'placed').length
  const inTransit         = orders.filter(o => o.status === 'in_transit').length
  const completedRevenue  = orders
    .filter(o => o.status === 'completed')
    .reduce((sum, o) => sum + (o.total_amount ?? 0), 0)

  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Here's what's happening with your farm</p>
        </div>
        <Link
          to="/farmer/listings/new"
          className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> New Listing
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ShoppingBag}  label="Active Listings"   value={activeListings}                        color="green" />
        <StatCard icon={ListOrdered}  label="Pending Orders"    value={pendingOrders}   sub="awaiting confirmation" color="blue" />
        <StatCard icon={Truck}        label="In Transit"        value={inTransit}                             color="orange" />
        <StatCard icon={TrendingUp}   label="Revenue Earned"    value={`₹${completedRevenue.toLocaleString()}`} sub="from completed orders" color="purple" />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          to="/farmer/listings"
          className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:border-green-200 hover:shadow-md transition-all flex items-center justify-between group"
        >
          <div>
            <p className="font-semibold text-gray-800">Manage Listings</p>
            <p className="text-xs text-gray-500 mt-0.5">{listings.length} total listings</p>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-green-600 transition-colors" />
        </Link>
        <Link
          to="/farmer/orders"
          className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:border-green-200 hover:shadow-md transition-all flex items-center justify-between group"
        >
          <div>
            <p className="font-semibold text-gray-800">View All Orders</p>
            <p className="text-xs text-gray-500 mt-0.5">{orders.length} total orders</p>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-green-600 transition-colors" />
        </Link>
      </div>

      {/* Recent orders */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">Recent Orders</h2>
          <Link to="/farmer/orders" className="text-xs text-green-600 hover:text-green-700 font-medium">
            View all →
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No orders yet</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentOrders.map(order => (
              <Link
                key={order.id}
                to={`/orders/${order.id}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono text-gray-400">#{order.id.slice(0, 8)}</code>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLOR[order.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {order.status?.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-0.5">
                    {order.quantity} {order.unit} · ₹{order.total_amount?.toLocaleString()}
                  </p>
                </div>
                <p className="text-xs text-gray-400 shrink-0">
                  {order.created_at ? format(new Date(order.created_at), 'dd MMM') : ''}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
