import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { format } from 'date-fns'
import { orderApi } from '../../api'
import OrderStatusBadge from '../../components/OrderStatusBadge'

export default function OrdersScreen({ navigation }) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['orders'],
    queryFn:  () => orderApi.list().then(r => r.data),
  })

  const orders = data?.orders ?? data?.data ?? []

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}><Text style={styles.title}>My Orders</Text></View>
        <View style={styles.center}><ActivityIndicator size="large" color="#16a34a" /></View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>My Orders</Text>
      </View>

      <FlatList
        data={orders}
        keyExtractor={item => item.id}
        onRefresh={refetch}
        refreshing={isLoading}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={{ fontSize: 40, marginBottom: 8 }}>📦</Text>
            <Text style={styles.emptyText}>No orders yet</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
            activeOpacity={0.75}
          >
            <View style={styles.cardTop}>
              <Text style={styles.orderCode}>#{item.id.slice(0, 8)}</Text>
              <OrderStatusBadge status={item.status} />
            </View>
            <Text style={styles.amount}>
              {item.quantity} {item.unit} · ₹{item.total_amount?.toLocaleString()}
            </Text>
            {item.created_at && (
              <Text style={styles.date}>{format(new Date(item.created_at), 'dd MMM yyyy')}</Text>
            )}
            <Ionicons name="chevron-forward" size={16} color="#d1d5db" style={styles.chevron} />
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#f9fafb' },
  header:    { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  title:     { fontSize: 24, fontWeight: '700', color: '#111827' },
  list:      { paddingHorizontal: 20, paddingBottom: 32 },
  center:    { alignItems: 'center', paddingTop: 80 },
  emptyText: { color: '#9ca3af', fontSize: 15 },
  card:      { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  cardTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  orderCode: { fontFamily: 'monospace', fontSize: 12, color: '#9ca3af' },
  amount:    { fontSize: 15, fontWeight: '600', color: '#111827' },
  date:      { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  chevron:   { position: 'absolute', right: 14, top: '50%' },
})
