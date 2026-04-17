import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator }    from '@react-navigation/bottom-tabs'
import { Ionicons }                    from '@expo/vector-icons'
import { ActivityIndicator, View }     from 'react-native'
import { useAuth }                     from '../contexts/AuthContext'

// Auth screens
import LoginScreen    from '../screens/auth/LoginScreen'
import RegisterScreen from '../screens/auth/RegisterScreen'
import OTPScreen      from '../screens/auth/OTPScreen'

// Buyer tabs
import MarketplaceScreen   from '../screens/marketplace/MarketplaceScreen'
import ListingDetailScreen from '../screens/marketplace/ListingDetailScreen'
import OrdersScreen        from '../screens/orders/OrdersScreen'
import OrderDetailScreen   from '../screens/orders/OrderDetailScreen'
import PlaceOrderScreen    from '../screens/orders/PlaceOrderScreen'

// Farmer tabs
import DashboardScreen    from '../screens/farmer/DashboardScreen'
import CreateListingScreen from '../screens/farmer/CreateListingScreen'

// Shared
import ProfileScreen from '../screens/profile/ProfileScreen'

const Stack = createNativeStackNavigator()
const Tab   = createBottomTabNavigator()

function BuyerTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor:   '#16a34a',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: { borderTopColor: '#f3f4f6' },
        tabBarIcon: ({ color, size }) => {
          const icons = {
            Marketplace: 'storefront-outline',
            Orders:      'receipt-outline',
            Profile:     'person-outline',
          }
          return <Ionicons name={icons[route.name] ?? 'ellipse-outline'} size={size} color={color} />
        },
      })}
    >
      <Tab.Screen name="Marketplace" component={MarketplaceStack} />
      <Tab.Screen name="Orders"      component={OrdersStack} />
      <Tab.Screen name="Profile"     component={ProfileScreen} />
    </Tab.Navigator>
  )
}

function FarmerTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor:   '#16a34a',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: { borderTopColor: '#f3f4f6' },
        tabBarIcon: ({ color, size }) => {
          const icons = {
            Dashboard: 'grid-outline',
            Orders:    'receipt-outline',
            Profile:   'person-outline',
          }
          return <Ionicons name={icons[route.name] ?? 'ellipse-outline'} size={size} color={color} />
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={FarmerDashboardStack} />
      <Tab.Screen name="Orders"    component={OrdersStack} />
      <Tab.Screen name="Profile"   component={ProfileScreen} />
    </Tab.Navigator>
  )
}

function MarketplaceStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MarketplaceList" component={MarketplaceScreen} />
      <Stack.Screen name="ListingDetail"   component={ListingDetailScreen} />
      <Stack.Screen name="PlaceOrder"      component={PlaceOrderScreen} />
    </Stack.Navigator>
  )
}

function OrdersStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OrdersList"   component={OrdersScreen} />
      <Stack.Screen name="OrderDetail"  component={OrderDetailScreen} />
    </Stack.Navigator>
  )
}

function FarmerDashboardStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="FarmerDashboard"  component={DashboardScreen} />
      <Stack.Screen name="CreateListing"    component={CreateListingScreen} />
      <Stack.Screen name="OrderDetail"      component={OrderDetailScreen} />
    </Stack.Navigator>
  )
}

export default function RootNavigator() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    )
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <>
          <Stack.Screen name="Login"    component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="OTP"      component={OTPScreen} />
        </>
      ) : user.role === 'farmer' ? (
        <Stack.Screen name="FarmerApp" component={FarmerTabs} />
      ) : (
        <Stack.Screen name="BuyerApp"  component={BuyerTabs} />
      )}
    </Stack.Navigator>
  )
}
