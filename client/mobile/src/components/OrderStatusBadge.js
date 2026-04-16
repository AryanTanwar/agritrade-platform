import { View, Text, StyleSheet } from 'react-native'

const STATUS = {
  placed:       { label: 'Placed',          bg: '#eff6ff', text: '#1d4ed8' },
  confirmed:    { label: 'Confirmed',        bg: '#fffbeb', text: '#92400e' },
  escrow_held:  { label: 'Payment Secured',  bg: '#faf5ff', text: '#7e22ce' },
  in_transit:   { label: 'In Transit',       bg: '#fff7ed', text: '#c2410c' },
  delivered:    { label: 'Delivered',        bg: '#f0fdfa', text: '#0f766e' },
  completed:    { label: 'Completed',        bg: '#f0fdf4', text: '#15803d' },
  disputed:     { label: 'Disputed',         bg: '#fef2f2', text: '#b91c1c' },
  cancelled:    { label: 'Cancelled',        bg: '#f9fafb', text: '#6b7280' },
}

export default function OrderStatusBadge({ status, style }) {
  const cfg = STATUS[status] ?? { label: status, bg: '#f9fafb', text: '#6b7280' }
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }, style]}>
      <Text style={[styles.text, { color: cfg.text }]}>
        {cfg.label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  text:  { fontSize: 12, fontWeight: '600' },
})
