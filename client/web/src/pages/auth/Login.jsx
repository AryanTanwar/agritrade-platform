import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Leaf, Eye, EyeOff } from 'lucide-react'

export default function Login() {
  const { login } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const from      = location.state?.from?.pathname || '/'

  const [form, setForm]       = useState({ phone: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const user = await login(form)
      navigate(user.role === 'farmer' ? '/farmer/dashboard' : from, { replace: true })
    } catch (err) {
      setError(err.response?.data?.message ?? 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-green-100 rounded-full mb-4">
            <Leaf className="w-7 h-7 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome to AgriTrade</h1>
          <p className="text-gray-500 text-sm mt-1">Sign in to your account</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-phone" className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input
              id="login-phone" name="phone"
              type="tel" required placeholder="+91 9876543210"
              value={form.phone} onChange={set('phone')}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <input
                id="login-password" name="password"
                type={showPass ? 'text' : 'password'} required
                value={form.password} onChange={set('password')}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <button
                type="button" onClick={() => setShowPass(s => !s)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors mt-2"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-green-600 hover:text-green-700 font-medium">
            Register
          </Link>
        </p>
      </div>
    </div>
  )
}
