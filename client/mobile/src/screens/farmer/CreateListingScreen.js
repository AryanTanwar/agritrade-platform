import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, Switch,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { listingApi } from '../../api'

const CATEGORIES = ['grains', 'vegetables', 'fruits', 'dairy', 'spices', 'pulses', 'oilseeds', 'other']
const UNITS      = ['kg', 'quintal', 'tonne', 'litre', 'dozen', 'piece']

export default function CreateListingScreen({ navigation }) {
  const qc  = useQueryClient()
  const [form, setForm] = useState({
    title: '', category: 'grains', quantity: '', unit: 'kg',
    price_per_unit: '', is_organic: false, description: '',
    location_city: '', location_state: '',
  })

  const set = (field) => (val) => setForm(f => ({ ...f, [field]: val }))

  const createMut = useMutation({
    mutationFn: () => listingApi.create({
      title:          form.title,
      category:       form.category,
      quantity:       parseFloat(form.quantity),
      unit:           form.unit,
      price_per_unit: parseFloat(form.price_per_unit),
      is_organic:     form.is_organic,
      description:    form.description,
      location:       { city: form.location_city, state: form.location_state },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['myListings'] })
      navigation.goBack()
    },
  })

  const handleCreate = async () => {
    if (!form.title || !form.quantity || !form.price_per_unit) {
      Alert.alert('Error', 'Fill in title, quantity, and price.')
      return
    }
    try {
      await createMut.mutateAsync()
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message ?? 'Failed to create listing.')
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.navbar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>New Listing</Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <Field label="Title *">
            <TextInput style={styles.input} placeholder="e.g. Premium Basmati Rice" value={form.title} onChangeText={set('title')} />
          </Field>

          <Field label="Category">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.chip, form.category === cat && styles.chipActive]}
                  onPress={() => set('category')(cat)}
                >
                  <Text style={[styles.chipText, form.category === cat && styles.chipTextActive]}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Field>

          <View style={styles.row}>
            <Field label="Quantity *" style={{ flex: 1 }}>
              <TextInput style={styles.input} placeholder="100" value={form.quantity} onChangeText={set('quantity')} keyboardType="decimal-pad" />
            </Field>
            <Field label="Unit" style={{ flex: 1 }}>
              <View style={styles.select}>
                {UNITS.map(u => (
                  <TouchableOpacity key={u} onPress={() => set('unit')(u)} style={[styles.unitBtn, form.unit === u && styles.unitBtnActive]}>
                    <Text style={[styles.unitText, form.unit === u && styles.unitTextActive]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Field>
          </View>

          <Field label={`Price per ${form.unit} (₹) *`}>
            <TextInput style={styles.input} placeholder="2500" value={form.price_per_unit} onChangeText={set('price_per_unit')} keyboardType="decimal-pad" />
          </Field>

          <Field label="Organic Certified">
            <View style={styles.switchRow}>
              <Ionicons name="leaf-outline" size={18} color={form.is_organic ? '#16a34a' : '#9ca3af'} />
              <Text style={styles.switchLabel}>Mark as organic</Text>
              <Switch
                value={form.is_organic}
                onValueChange={set('is_organic')}
                trackColor={{ false: '#e5e7eb', true: '#86efac' }}
                thumbColor={form.is_organic ? '#16a34a' : '#fff'}
              />
            </View>
          </Field>

          <Field label="Description">
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Quality, variety, farming method…"
              value={form.description}
              onChangeText={set('description')}
              multiline numberOfLines={3}
              textAlignVertical="top"
            />
          </Field>

          <View style={styles.row}>
            <Field label="City" style={{ flex: 1 }}>
              <TextInput style={styles.input} placeholder="Amritsar" value={form.location_city} onChangeText={set('location_city')} />
            </Field>
            <Field label="State" style={{ flex: 1 }}>
              <TextInput style={styles.input} placeholder="Punjab" value={form.location_state} onChangeText={set('location_state')} />
            </Field>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.btn, createMut.isPending && styles.btnDisabled]}
          onPress={handleCreate}
          disabled={createMut.isPending}
          activeOpacity={0.85}
        >
          <Text style={styles.btnText}>{createMut.isPending ? 'Publishing…' : 'Publish Listing'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

function Field({ label, children, style }) {
  return (
    <View style={[{ gap: 6 }, style]}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151' }}>{label}</Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: '#f9fafb' },
  navbar:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  navTitle:      { fontSize: 17, fontWeight: '600', color: '#111827' },
  scroll:        { padding: 16, gap: 16, paddingBottom: 120 },
  input:         { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#111827' },
  textarea:      { height: 80, textAlignVertical: 'top' },
  row:           { flexDirection: 'row', gap: 12 },
  chip:          { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, backgroundColor: '#f3f4f6' },
  chipActive:    { backgroundColor: '#16a34a' },
  chipText:      { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  chipTextActive:{ color: '#fff', fontWeight: '600' },
  select:        { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  unitBtn:       { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  unitBtnActive: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  unitText:      { fontSize: 12, color: '#6b7280' },
  unitTextActive:{ color: '#16a34a', fontWeight: '600' },
  switchRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1.5, borderColor: '#e5e7eb' },
  switchLabel:   { flex: 1, fontSize: 14, color: '#374151' },
  footer:        { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  btn:           { backgroundColor: '#16a34a', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnDisabled:   { backgroundColor: '#86efac' },
  btnText:       { color: '#fff', fontSize: 16, fontWeight: '700' },
})
