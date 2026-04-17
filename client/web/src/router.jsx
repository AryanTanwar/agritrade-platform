import { createBrowserRouter, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import OTPVerify from './pages/auth/OTPVerify'
import Marketplace from './pages/buyer/Marketplace'
import ListingDetail from './pages/buyer/ListingDetail'
import PlaceOrder from './pages/buyer/PlaceOrder'
import PaymentFlow from './pages/buyer/PaymentFlow'
import MyOrders from './pages/buyer/MyOrders'
import OrderTracking from './pages/buyer/OrderTracking'
import Dashboard from './pages/farmer/Dashboard'
import Listings from './pages/farmer/Listings'
import CreateListing from './pages/farmer/CreateListing'
import FarmerOrders from './pages/farmer/Orders'

export const router = createBrowserRouter([
  { path: '/login',       element: <Login /> },
  { path: '/register',    element: <Register /> },
  { path: '/verify-otp',  element: <OTPVerify /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <Layout />,
        children: [
          { index: true,                           element: <Marketplace /> },
          { path: '/listings/:id',                 element: <ListingDetail /> },
          { path: '/orders/place/:listingId',      element: <PlaceOrder /> },
          { path: '/orders/:orderId/pay',          element: <PaymentFlow /> },
          { path: '/orders',                       element: <MyOrders /> },
          { path: '/orders/:id',                   element: <OrderTracking /> },
          { path: '/farmer/dashboard',             element: <Dashboard /> },
          { path: '/farmer/listings',              element: <Listings /> },
          { path: '/farmer/listings/new',          element: <CreateListing /> },
          { path: '/farmer/orders',                element: <FarmerOrders /> },
          { path: '*',                             element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
])
