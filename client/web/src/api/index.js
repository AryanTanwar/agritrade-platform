import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || '/api/v1'

const api = axios.create({ baseURL: BASE })

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('accessToken')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

api.interceptors.response.use(
  res => res,
  async err => {
    const orig = err.config
    if (err.response?.status === 401 && !orig._retry) {
      orig._retry = true
      const refreshToken = localStorage.getItem('refreshToken')
      if (!refreshToken) {
        localStorage.clear()
        window.location.href = '/login'
        return Promise.reject(err)
      }
      try {
        const { data } = await axios.post(`${BASE}/auth/refresh`, { refreshToken })
        localStorage.setItem('accessToken', data.accessToken)
        localStorage.setItem('refreshToken', data.refreshToken)
        orig.headers.Authorization = `Bearer ${data.accessToken}`
        return api(orig)
      } catch {
        localStorage.clear()
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export const authApi = {
  login:           (d)         => api.post('/auth/login', d),
  registerFarmer:  (d)         => api.post('/auth/register/farmer', d),
  registerBuyer:   (d)         => api.post('/auth/register/buyer', d),
  logout:          ()          => api.post('/auth/logout'),
  sendOTP:         (phone)     => api.post('/auth/otp/send', { phone }),
  verifyOTP:       (phone, code) => api.post('/auth/otp/verify', { phone, code }),
  getMe:           ()          => api.get('/users/me'),
  updateMe:        (d)         => api.put('/users/me', d),
  changePassword:  (d)         => api.put('/users/me/password', d),
  submitKYC:       (d)         => api.post('/users/me/kyc', d),
}

export const listingApi = {
  list:       (params) => api.get('/listings', { params }),
  getById:    (id)     => api.get(`/listings/${id}`),
  create:     (d)      => api.post('/listings', d),
  update:     (id, d)  => api.put(`/listings/${id}`, d),
  remove:     (id)     => api.delete(`/listings/${id}`),
  myListings: ()       => api.get('/listings/farmer/me'),
}

export const orderApi = {
  place:       (d)           => api.post('/orders', d),
  list:        (params)      => api.get('/orders', { params }),
  getById:     (id)          => api.get(`/orders/${id}`),
  confirm:     (id)          => api.post(`/orders/${id}/confirm`),
  attachEscrow:(id)          => api.post(`/orders/${id}/escrow`),
  markInTransit:(id)         => api.post(`/orders/${id}/in-transit`),
  deliver:     (id)          => api.post(`/orders/${id}/deliver`),
  complete:    (id)          => api.post(`/orders/${id}/complete`),
  dispute:     (id, reason)  => api.post(`/orders/${id}/dispute`, { reason }),
  cancel:      (id, reason)  => api.post(`/orders/${id}/cancel`, { reason }),
  history:     (id)          => api.get(`/orders/${id}/history`),
}

export const paymentApi = {
  createOrder:   (orderId)   => api.post('/payments/order', { orderId }),
  verify:        (d)         => api.post('/payments/verify', d),
  getEscrow:     (id)        => api.get(`/payments/escrow/${id}`),
  releaseEscrow: (id)        => api.post(`/payments/escrow/${id}/release`),
  refundEscrow:  (id)        => api.post(`/payments/escrow/${id}/refund`),
  disputeEscrow: (id, reason)=> api.post(`/payments/escrow/${id}/dispute`, { reason }),
}

export const logisticsApi = {
  getShipment:   (id) => api.get(`/logistics/shipments/${id}`),
  listShipments: ()   => api.get('/logistics/shipments'),
}

export const notificationApi = {
  list:          ()    => api.get('/notifications'),
  markRead:      (id)  => api.put(`/notifications/${id}/read`),
  markAllRead:   ()    => api.put('/notifications/read-all'),
  registerToken: (token, platform) => api.post('/notifications/tokens', { token, platform }),
}

export default api
