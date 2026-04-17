import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  ShoppingBag, LayoutDashboard, ListOrdered, LogOut, Leaf, Plus,
} from 'lucide-react'

function NavLink({ to, icon: Icon, label }) {
  const { pathname } = useLocation()
  const active = pathname === to || pathname.startsWith(to + '/')
  return (
    <Link
      to={to}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
        active
          ? 'bg-green-100 text-green-800 font-medium'
          : 'text-gray-600 hover:text-green-700 hover:bg-gray-50'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </Link>
  )
}

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const isFarmer = user?.role === 'farmer'

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2 font-bold text-green-700 text-lg">
              <Leaf className="w-5 h-5" />
              AgriTrade
            </Link>

            <div className="flex items-center gap-1">
              {isFarmer ? (
                <>
                  <NavLink to="/farmer/dashboard" icon={LayoutDashboard} label="Dashboard" />
                  <NavLink to="/farmer/listings"  icon={ShoppingBag}     label="My Listings" />
                  <NavLink to="/farmer/orders"    icon={ListOrdered}     label="Orders" />
                  <Link
                    to="/farmer/listings/new"
                    className="flex items-center gap-1.5 ml-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition-colors"
                  >
                    <Plus className="w-4 h-4" /> New Listing
                  </Link>
                </>
              ) : (
                <>
                  <NavLink to="/"       icon={ShoppingBag}  label="Marketplace" />
                  <NavLink to="/orders" icon={ListOrdered}  label="My Orders" />
                </>
              )}

              <div className="ml-4 flex items-center gap-2 pl-4 border-l border-gray-200">
                <span className="text-xs text-gray-500 capitalize">{user?.role}</span>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 text-sm text-gray-400 hover:text-red-600 transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  )
}
