import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { authApi } from '../../api'
import { MessageSquare } from 'lucide-react'

export default function OTPVerify() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const phone     = location.state?.phone ?? ''

  const [digits, setDigits]   = useState(Array(6).fill(''))
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [resent, setResent]   = useState(false)
  const inputRefs             = useRef([])

  useEffect(() => { inputRefs.current[0]?.focus() }, [])

  const handleChange = (i, val) => {
    if (!/^\d*$/.test(val)) return
    const next = [...digits]
    next[i] = val.slice(-1)
    setDigits(next)
    if (val && i < 5) inputRefs.current[i + 1]?.focus()
    if (next.every(d => d) && i === 5) submitCode(next.join(''))
  }

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputRefs.current[i - 1]?.focus()
    }
  }

  const submitCode = async (code) => {
    setLoading(true)
    setError('')
    try {
      await authApi.verifyOTP(phone, code)
      navigate('/login', { state: { verified: true } })
    } catch (err) {
      setError(err.response?.data?.message ?? 'Invalid code. Try again.')
      setDigits(Array(6).fill(''))
      inputRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    try {
      await authApi.sendOTP(phone)
      setResent(true)
      setTimeout(() => setResent(false), 5000)
    } catch { /* ignore */ }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-green-100 rounded-full mb-4">
          <MessageSquare className="w-7 h-7 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Verify Phone</h1>
        <p className="text-gray-500 text-sm mb-8">
          Enter the 6-digit code sent to <strong>{phone}</strong>
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <div className="flex gap-2 justify-center mb-6">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => inputRefs.current[i] = el}
              type="text" inputMode="numeric" maxLength={1}
              value={d}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              disabled={loading}
              className="w-12 h-12 text-center text-xl font-bold border-2 rounded-lg focus:outline-none focus:border-green-500 disabled:bg-gray-50 transition-colors"
            />
          ))}
        </div>

        {resent && (
          <p className="text-green-600 text-sm mb-4">Code resent successfully!</p>
        )}

        <button
          onClick={handleResend}
          className="text-sm text-green-600 hover:text-green-700 underline"
        >
          Resend code
        </button>
      </div>
    </div>
  )
}
