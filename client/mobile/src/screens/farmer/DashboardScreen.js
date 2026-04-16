import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { format } from 'date-fns'
import { listingApi, orderApi } from '../../api'
import { useAuth } from '../../contexts/AuthContext'
import OrderStatusBadge from '../../components/OrderStatusBadge'

function StatCard({ icon, label, value, color = '#16a34a', bg = '#f0fdf4' }) {
  return (
    <View style={[styles.statCard, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth()

  const { data: listingsData, isLoading: lLoad } = useQuery({
    queryKey: ['myListings'],
    queryFn:  () => listingApi.myListings().then(r => r.data),
  })

  const { data: ordersData, isLoading: oLoad, refetch } = useQuery({
    queryKey: ['orders'],
    queryFn:  () => orderApi.list().then(r => r.data),
  })

  const listings = listingsData?.listings ?? listingsData?.data ?? []
  const orders   = ordersData?.orders    ?? ordersData?.data   ?? []

  const activeListings   = listings.filter(l => l.status === 'active').length
  const pendingOrders    = orders.filter(o => o.status === 'placed').length
  const inTransit        = orders.filter(o => o.status === 'in_transit').length
  const completedRevenue = orders
    .filter(o => o.status === 'completed')
    .reduce((s, o) => s + (o.total_amount ?? 0), 0)

  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5)

  if (lLoad || oLoad) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator size="large" color="#16a34a" /></View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        onRefresh={refetch}
        refreshing={oLoad}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0]} 👋</Text>
            <Text style={styles.sub}>Here's your farm overview</Text>
          </View>
          <TouchableOpacity
            style={styles.newListingBtn}
            onPress={() => navigation.navigate('CreateListing')}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.newListingText}>New</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          <StatCard icon="storefront-outline"  label="Active Listings"   value={activeListings}                    color="#16a34a" bg="#f0fdf4" />
          <StatCard icon="receipt-outline"      label="Pending Orders"    value={pendingOrders}                     color="#1d4ed8" bg="#eff6ff" />
          <StatCard icon="car-outline"          label="In Transit"        value={inTransit}                         color="#ea580c" bg="#fff7ed" />
          <StatCard icon="trending-up-outline"  label="Revenue"           value={`₹${(completedRevenue/1000).toFixed(0)}K`} color="#7e22ce" bg="#faf5ff" />
        </View>

        {/* Recent orders */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Orders</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Orders')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>

          {recentOrders.length === 0 ? (
            <Text style={styles.emptyText}>No orders yet</Text>
          ) : (
            recentOrders.map(order => (
              <TouchableOpacity
                key={order.id}
                style={styles.orderRow}
                onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}
                activeOpacity={0.75}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderCode}>#{order.id.slice(0, 8)}</Text>
                  <Text style={styles.orderAmount}>
                    {order.quantity} {order.unit} · ₹{order.total_amount?.toLocaleString()}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <OrderStatusBadge status={order.status} />
                  {order.created_at && (
                    <Text style={styles.orderDate}>{format(new Date(order.created_at), 'dd MMM')}</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: '#f9fafb' },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:         { padding: 20, gap: 20, paddingBottom: 40 },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting:       { fontSize: 22, fontWeight: '700', color: '#111827' },
  sub:            { fontSize: 13, color: '#6b7280', marginTop: 2 },
  newListingBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#16a34a', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  newListingText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  statsGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard:       { flex: 1, minWidth: '45%', borderRadius: 14, padding: 14, gap: 4 },
  statValue:      { fontSize: 22, fontWeight: '700', color: '#111827', marginTop: 4 },
  statLabel:      { fontSize: 12, color: '#6b7280' },
  section:        { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  sectionHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle:   { fontSize: 16, fontWeight: '700', color: '#111827' },
  seeAll:         { fontSize: 13, color: '#16a34a', fontWeight: '600' },
  orderRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f9fafb' },
  orderCode:      { fontFamily: 'monospace', fontSize: 11, color: '#9ca3af' },
  orderAmount:    { fontSize: 14, fontWeight: '600', color: '#111827', marginTop: 2 },
  orderDate:      { fontSize: 11, color: '#9ca3af' },
  emptyText:      { color: '#9ca3af', fontSize: 14, textAlign: 'center', paddingVertical: 12 },
})
