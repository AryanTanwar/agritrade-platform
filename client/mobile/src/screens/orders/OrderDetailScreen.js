import { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { format } from 'date-fns'
import { orderApi } from '../../api'
import BlockchainTimeline from '../../components/BlockchainTimeline'
import OrderStatusBadge from '../../components/OrderStatusBadge'
import { useAuth } from '../../contexts/AuthContext'

export default function OrderDetailScreen({ navigation, route }) {
  const { orderId } = route.params
  const { user }    = useAuth()
  const qc          = useQueryClient()

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', orderId],
    queryFn:  () => orderApi.getById(orderId).then(r => r.data),
  })

  const { data: history = [], isLoading: histLoading } = useQuery({
    queryKey: ['orderHistory', orderId],
    queryFn:  () => orderApi.history(orderId).then(r => r.data),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['order', orderId] })
    qc.invalidateQueries({ queryKey: ['orderHistory', orderId] })
    qc.invalidateQueries({ queryKey: ['orders'] })
  }

  const confirmMut = useMutation({ mutationFn: () => orderApi.confirm(orderId),  onSuccess: invalidate })
  const deliverMut = useMutation({ mutationFn: () => orderApi.deliver(orderId),  onSuccess: invalidate })
  const completeMut= useMutation({ mutationFn: () => orderApi.complete(orderId), onSuccess: invalidate })

  const handleAction = (mutation, confirmMsg) => {
    Alert.alert('Confirm', confirmMsg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes', onPress: () => mutation.mutate() },
    ])
  }

  if (isLoading || !order) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator size="large" color="#16a34a" /></View>
      </SafeAreaView>
    )
  }

  const isFarmer = user?.role === 'farmer'
  const isBuyer  = user?.role === 'buyer'

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.navbar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Order Details</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Summary card */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.code}>#{order.id?.slice(0, 12)}</Text>
            <OrderStatusBadge status={order.status} />
          </View>

          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Quantity</Text>
              <Text style={styles.gridValue}>{order.quantity} {order.unit}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Total</Text>
              <Text style={[styles.gridValue, { color: '#16a34a' }]}>₹{order.total_amount?.toLocaleString()}</Text>
            </View>
            {order.created_at && (
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Ordered</Text>
                <Text style={styles.gridValue}>{format(new Date(order.created_at), 'dd MMM yyyy')}</Text>
              </View>
            )}
            {order.delivery_address && (
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Deliver to</Text>
                <Text style={styles.gridValue} numberOfLines={2}>{order.delivery_address}</Text>
              </View>
            )}
          </View>

          {['escrow_held', 'in_transit', 'delivered'].includes(order.status) && (
            <View style={styles.escrowBanner}>
              <Ionicons name="shield-checkmark-outline" size={16} color="#7e22ce" />
              <Text style={styles.escrowText}>
                ₹{order.total_amount?.toLocaleString()} secured in blockchain escrow
              </Text>
            </View>
          )}
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          {isFarmer && order.status === 'placed' && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleAction(confirmMut, 'Confirm this order?')}
              disabled={confirmMut.isPending}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>{confirmMut.isPending ? 'Confirming…' : 'Confirm Order'}</Text>
            </TouchableOpacity>
          )}

          {isBuyer && order.status === 'confirmed' && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#9333ea' }]}
              onPress={() => Alert.alert('Payment', 'Open payment screen?', [
                { text: 'Cancel' },
                { text: 'Pay Now', onPress: () => {} },
              ])}
              activeOpacity={0.8}
            >
              <Ionicons name="shield-outline" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Pay & Secure in Escrow</Text>
            </TouchableOpacity>
          )}

          {isBuyer && order.status === 'in_transit' && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#0d9488' }]}
              onPress={() => handleAction(deliverMut, 'Confirm you received the delivery?')}
              disabled={deliverMut.isPending}
              activeOpacity={0.8}
            >
              <Ionicons name="cube-outline" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>{deliverMut.isPending ? '…' : 'Confirm Delivery'}</Text>
            </TouchableOpacity>
          )}

          {isFarmer && order.status === 'delivered' && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#059669' }]}
              onPress={() => handleAction(completeMut, 'Mark this order as complete?')}
              disabled={completeMut.isPending}
              activeOpacity={0.8}
            >
              <Ionicons name="star-outline" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>{completeMut.isPending ? '…' : 'Mark Complete'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Blockchain timeline */}
        <View style={styles.timelineCard}>
          <View style={styles.timelineHeader}>
            <Ionicons name="git-branch-outline" size={18} color="#6b7280" />
            <Text style={styles.timelineTitle}>Blockchain Audit Trail</Text>
          </View>
          {histLoading
            ? <ActivityIndicator size="small" color="#16a34a" style={{ marginTop: 12 }} />
            : <BlockchainTimeline history={history} />
          }
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: '#f9fafb' },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navbar:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  navTitle:       { fontSize: 17, fontWeight: '600', color: '#111827' },
  scroll:         { padding: 16, gap: 14, paddingBottom: 40 },
  card:           { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  code:           { fontFamily: 'monospace', fontSize: 12, color: '#9ca3af' },
  grid:           { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridItem:       { minWidth: '45%', flex: 1 },
  gridLabel:      { fontSize: 11, color: '#9ca3af', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  gridValue:      { fontSize: 14, fontWeight: '600', color: '#111827' },
  escrowBanner:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#faf5ff', borderRadius: 10, padding: 10, marginTop: 12 },
  escrowText:     { fontSize: 13, color: '#7e22ce', flex: 1 },
  actions:        { gap: 10 },
  actionBtn:      { backgroundColor: '#16a34a', borderRadius: 14, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionBtnText:  { color: '#fff', fontSize: 15, fontWeight: '700' },
  timelineCard:   { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  timelineHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  timelineTitle:  { fontSize: 16, fontWeight: '700', color: '#111827' },
})
