import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Leaf, Sprout, ShoppingBag } from 'lucide-react'

const ROLE_OPTIONS = [
  { value: 'farmer', label: 'Farmer',      icon: Sprout,      desc: 'List and sell your produce directly' },
  { value: 'buyer',  label: 'Buyer',        icon: ShoppingBag, desc: 'Browse and purchase fresh produce' },
]

export default function Register() {
  const { register } = useAuth()
  const navigate     = useNavigate()

  const [role, setRole]       = useState('buyer')
  const [step, setStep]       = useState(1)
  const [form, setForm]       = useState({ name: '', phone: '', password: '', confirmPassword: '' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await register(role, { name: form.name, phone: form.phone, password: form.password })
      navigate('/verify-otp', { state: { phone: form.phone } })
    } catch (err) {
      setError(err.response?.data?.message ?? 'Registration failed. Try again.')
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
          <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
          <p className="text-gray-500 text-sm mt-1">Join the AgriTrade marketplace</p>
        </div>

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700 mb-3">I want to join as a…</p>
            {ROLE_OPTIONS.map(({ value, label, icon: Icon, desc }) => (
              <button
                key={value}
                onClick={() => setRole(value)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                  role === value
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${role === value ? 'bg-green-100' : 'bg-gray-100'}`}>
                  <Icon className={`w-5 h-5 ${role === value ? 'text-green-600' : 'text-gray-500'}`} />
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{label}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              </button>
            ))}
            <button
              onClick={() => setStep(2)}
              className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
            >
              Continue as {role}
            </button>
          </div>
        )}

        {step === 2 && (
          <>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="register-name" className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  id="register-name" name="name"
                  type="text" required placeholder="Ramesh Kumar"
                  value={form.name} onChange={set('name')}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label htmlFor="register-phone" className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  id="register-phone" name="phone"
                  type="tel" required placeholder="+91 9876543210"
                  value={form.phone} onChange={set('phone')}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label htmlFor="register-password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  id="register-password" name="password"
                  type="password" required minLength={8}
                  value={form.password} onChange={set('password')}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label htmlFor="register-confirm-password" className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input
                  id="register-confirm-password" name="confirmPassword"
                  type="password" required
                  value={form.confirmPassword} onChange={set('confirmPassword')}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button" onClick={() => setStep(1)}
                  className="flex-1 border border-gray-300 text-gray-700 font-medium py-2.5 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit" disabled={loading}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
                >
                  {loading ? 'Registering…' : 'Register'}
                </button>
              </div>
            </form>
          </>
        )}

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-green-600 hover:text-green-700 font-medium">Sign In</Link>
        </p>
      </div>
    </div>
  )
}
