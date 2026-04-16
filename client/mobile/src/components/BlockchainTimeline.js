import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { format } from 'date-fns'

const STATUS_CONFIG = {
  placed:       { label: 'Order Placed',         icon: 'cart-outline',          color: '#3b82f6', bg: '#eff6ff' },
  confirmed:    { label: 'Farmer Confirmed',      icon: 'checkmark-circle-outline', color: '#16a34a', bg: '#f0fdf4' },
  escrow_held:  { label: 'Payment Secured',       icon: 'shield-checkmark-outline', color: '#9333ea', bg: '#faf5ff' },
  in_transit:   { label: 'Shipment In Transit',   icon: 'car-outline',           color: '#ea580c', bg: '#fff7ed' },
  delivered:    { label: 'Delivered',             icon: 'cube-outline',          color: '#0d9488', bg: '#f0fdfa' },
  completed:    { label: 'Trade Completed',       icon: 'star-outline',          color: '#059669', bg: '#ecfdf5' },
  disputed:     { label: 'Under Dispute',         icon: 'warning-outline',       color: '#dc2626', bg: '#fef2f2' },
  cancelled:    { label: 'Cancelled',             icon: 'close-circle-outline',  color: '#6b7280', bg: '#f9fafb' },
}

export default function BlockchainTimeline({ history = [] }) {
  if (!history.length) {
    return (
      <Text style={styles.empty}>No on-chain history available yet.</Text>
    )
  }

  return (
    <View>
      {history.map((entry, i) => {
        const status = entry.value?.status ?? entry.status
        const cfg    = STATUS_CONFIG[status] ?? { label: status, icon: 'ellipse-outline', color: '#6b7280', bg: '#f9fafb' }
        const ts     = entry.timestamp ? new Date(entry.timestamp) : null
        const isLast = i === history.length - 1

        return (
          <View key={entry.txId ?? i} style={styles.row}>
            {/* Timeline line */}
            <View style={styles.lineCol}>
              <View style={[styles.dot, { backgroundColor: cfg.bg, borderColor: cfg.color }]}>
                <Ionicons name={cfg.icon} size={14} color={cfg.color} />
              </View>
              {!isLast && <View style={styles.line} />}
            </View>

            {/* Content */}
            <View style={[styles.card, isLast ? styles.cardLast : {}]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.label, { color: cfg.color }]}>{cfg.label}</Text>
                {ts && (
                  <Text style={styles.time}>{format(ts, 'dd MMM · HH:mm')}</Text>
                )}
              </View>
              {entry.value?.actor?.mspId && (
                <Text style={styles.org}>org: {entry.value.actor.mspId}</Text>
              )}
              {entry.txId && (
                <View style={styles.txRow}>
                  <Ionicons name="lock-closed-outline" size={10} color="#9ca3af" />
                  <Text style={styles.txId}>
                    {entry.txId.slice(0, 8)}…{entry.txId.slice(-6)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  empty: { color: '#9ca3af', fontStyle: 'italic', fontSize: 13, paddingVertical: 12 },
  row:   { flexDirection: 'row', gap: 12 },
  lineCol: { alignItems: 'center', width: 28 },
  dot: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
  },
  line: { width: 1.5, flex: 1, backgroundColor: '#e5e7eb', marginVertical: 2 },
  card: {
    flex: 1, backgroundColor: '#fff', borderRadius: 10,
    borderWidth: 1, borderColor: '#f3f4f6',
    padding: 12, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardLast: { marginBottom: 0 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 },
  label: { fontSize: 13, fontWeight: '600', flex: 1 },
  time:  { fontSize: 11, color: '#9ca3af', marginLeft: 8 },
  org:   { fontSize: 11, color: '#6b7280', marginTop: 2 },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  txId:  { fontSize: 11, fontFamily: 'monospace', color: '#6b7280' },
})
