import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useMutation } from '@tanstack/react-query'
import { orderApi } from '../../api'

export default function PlaceOrderScreen({ navigation, route }) {
  const { listing } = route.params
  const { id: listingId, title, price_per_unit, unit, quantity: stock } = listing

  const [qty,   setQty]   = useState(1)
  const [line1, setLine1] = useState('')
  const [city,  setCity]  = useState('')
  const [state, setState] = useState('')
  const [pin,   setPin]   = useState('')

  const placeMut = useMutation({
    mutationFn: () => orderApi.place({
      listing_id:       listingId,
      quantity:         qty,
      delivery_address: `${line1}, ${city}, ${state}`,
      delivery_pincode: pin,
    }),
  })

  const total = (qty * price_per_unit).toFixed(2)

  const handlePlaceOrder = async () => {
    if (!line1 || !city || !pin) { Alert.alert('Error', 'Fill in delivery address.'); return }
    try {
      const { data } = await placeMut.mutateAsync()
      navigation.replace('OrderDetail', { orderId: data.id })
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message ?? 'Could not place order.')
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.navbar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Place Order</Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Listing summary */}
          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>{title}</Text>
            <Text style={styles.summaryPrice}>₹{price_per_unit?.toLocaleString()} / {unit}</Text>
            <Text style={styles.summaryStock}>{stock?.toLocaleString()} {unit} available</Text>
          </View>

          {/* Quantity */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Quantity ({unit})</Text>
            <View style={styles.qtyRow}>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => setQty(q => Math.max(1, q - 1))}>
                <Text style={styles.qtyBtnText}>−</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.qtyInput}
                value={String(qty)}
                onChangeText={v => setQty(Math.min(stock, Math.max(1, parseInt(v) || 1)))}
                keyboardType="number-pad"
                textAlign="center"
              />
              <TouchableOpacity style={styles.qtyBtn} onPress={() => setQty(q => Math.min(stock, q + 1))}>
                <Text style={styles.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Address */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Delivery Address</Text>
            <TextInput style={styles.input} placeholder="Street address" value={line1} onChangeText={setLine1} />
            <View style={styles.row}>
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="City"  value={city}  onChangeText={setCity} />
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="State" value={state} onChangeText={setState} />
            </View>
            <TextInput style={styles.input} placeholder="Pincode" value={pin} onChangeText={setPin} keyboardType="number-pad" maxLength={6} />
          </View>

          {/* Total */}
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>₹{total}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.btn, placeMut.isPending && styles.btnDisabled]}
          onPress={handlePlaceOrder}
          disabled={placeMut.isPending}
          activeOpacity={0.85}
        >
          <Text style={styles.btnText}>{placeMut.isPending ? 'Placing…' : `Confirm Order · ₹${total}`}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: '#f9fafb' },
  navbar:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  navTitle:      { fontSize: 17, fontWeight: '600', color: '#111827' },
  scroll:        { padding: 16, gap: 16, paddingBottom: 120 },
  summary:       { backgroundColor: '#f0fdf4', borderRadius: 14, padding: 14 },
  summaryTitle:  { fontSize: 16, fontWeight: '600', color: '#111827' },
  summaryPrice:  { fontSize: 20, fontWeight: '700', color: '#16a34a', marginTop: 4 },
  summaryStock:  { fontSize: 12, color: '#6b7280', marginTop: 2 },
  section:       { gap: 10 },
  sectionLabel:  { fontSize: 14, fontWeight: '600', color: '#374151' },
  qtyRow:        { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyBtn:        { width: 44, height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  qtyBtnText:    { fontSize: 22, color: '#374151', lineHeight: 28 },
  qtyInput:      { width: 80, height: 44, borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12, backgroundColor: '#fff', fontSize: 18, fontWeight: '700', color: '#111827' },
  input:         { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#111827' },
  row:           { flexDirection: 'row', gap: 10 },
  totalCard:     { backgroundColor: '#fff', borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel:    { fontSize: 15, fontWeight: '600', color: '#374151' },
  totalValue:    { fontSize: 22, fontWeight: '700', color: '#16a34a' },
  footer:        { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  btn:           { backgroundColor: '#16a34a', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnDisabled:   { backgroundColor: '#86efac' },
  btnText:       { color: '#fff', fontSize: 16, fontWeight: '700' },
})
