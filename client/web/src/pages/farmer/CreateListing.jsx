import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreateListing } from '../../hooks/useListings'
import { ArrowLeft, Leaf } from 'lucide-react'

const CATEGORIES = ['grains', 'vegetables', 'fruits', 'dairy', 'spices', 'pulses', 'oilseeds', 'other']
const UNITS      = ['kg', 'quintal', 'tonne', 'litre', 'dozen', 'piece']

export default function CreateListing() {
  const navigate     = useNavigate()
  const createListing = useCreateListing()

  const [form, setForm] = useState({
    title: '', category: 'grains', description: '',
    quantity: '', unit: 'kg', price_per_unit: '',
    is_organic: false, harvest_date: '', expiry_date: '',
    location: { city: '', state: '', lat: '', lng: '' },
  })
  const [error, setError] = useState('')

  const set = (field) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm(f => ({ ...f, [field]: val }))
  }

  const setLocation = (field) => (e) =>
    setForm(f => ({ ...f, location: { ...f.location, [field]: e.target.value } }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const payload = {
      ...form,
      quantity:       parseFloat(form.quantity),
      price_per_unit: parseFloat(form.price_per_unit),
      location: {
        city:  form.location.city,
        state: form.location.state,
        ...(form.location.lat && form.location.lng && {
          lat: parseFloat(form.location.lat),
          lng: parseFloat(form.location.lng),
        }),
      },
    }
    try {
      await createListing.mutateAsync(payload)
      navigate('/farmer/listings')
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to create listing.')
    }
  }

  const Input = ({ label, name, type = 'text', required, ...rest }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}{required && ' *'}</label>
      <input
        type={type} required={required} name={name}
        value={form[name] ?? ''} onChange={set(name)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        {...rest}
      />
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New Listing</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
        {/* Basic info */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Produce Details</h2>

          <Input label="Title" name="title" required placeholder="e.g. Fresh Basmati Rice Grade A" />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
            <select
              required value={form.category} onChange={set('category')}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description} onChange={set('description')}
              rows={3} placeholder="Quality, variety, farming method…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="organic" type="checkbox"
              checked={form.is_organic} onChange={set('is_organic')}
              className="w-4 h-4 text-green-600 rounded"
            />
            <label htmlFor="organic" className="flex items-center gap-1.5 text-sm font-medium text-gray-700 cursor-pointer">
              <Leaf className="w-4 h-4 text-green-600" /> Certified Organic
            </label>
          </div>
        </div>

        {/* Quantity & Price */}
        <div className="space-y-4 pt-2 border-t border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Quantity & Price</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
              <input
                type="number" min="0.1" step="0.1" required
                value={form.quantity} onChange={set('quantity')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit *</label>
              <select
                required value={form.unit} onChange={set('unit')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              >
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price per {form.unit} (₹) *</label>
            <input
              type="number" min="0.01" step="0.01" required
              value={form.price_per_unit} onChange={set('price_per_unit')}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Dates */}
        <div className="space-y-4 pt-2 border-t border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Dates</h2>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Harvest Date" name="harvest_date" type="date" />
            <Input label="Best Before" name="expiry_date" type="date" />
          </div>
        </div>

        {/* Location */}
        <div className="space-y-4 pt-2 border-t border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Location</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                type="text" value={form.location.city} onChange={setLocation('city')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <input
                type="text" value={form.location.state} onChange={setLocation('state')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button" onClick={() => navigate(-1)}
            className="flex-1 border border-gray-300 text-gray-700 font-medium py-3 rounded-xl text-sm hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit" disabled={createListing.isPending}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
          >
            {createListing.isPending ? 'Publishing…' : 'Publish Listing'}
          </button>
        </div>
      </form>
    </div>
  )
}
