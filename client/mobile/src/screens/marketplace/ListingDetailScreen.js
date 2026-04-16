import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { format } from 'date-fns'
import { useAuth } from '../../contexts/AuthContext'

const CATEGORY_EMOJI = {
  grains: '🌾', vegetables: '🥦', fruits: '🍎',
  dairy: '🥛', spices: '🌶️', pulses: '🫘', oilseeds: '🌻', other: '📦',
}

export default function ListingDetailScreen({ navigation, route }) {
  const { listing } = route.params
  const { user }    = useAuth()

  const {
    id, title, category, price_per_unit, unit,
    quantity, location, is_organic, description,
    harvest_date, expiry_date, farmer, status,
  } = listing

  const canOrder = status === 'active' && user?.role === 'buyer'

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.navbar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>{title}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>{CATEGORY_EMOJI[category] ?? '📦'}</Text>
          {is_organic && (
            <View style={styles.organicBadge}>
              <Ionicons name="leaf" size={12} color="#16a34a" />
              <Text style={styles.organicText}> Organic</Text>
            </View>
          )}
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>{title}</Text>

          {/* Price + Stock */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: '#f0fdf4' }]}>
              <Text style={styles.statLabel}>Price per {unit}</Text>
              <Text style={[styles.statValue, { color: '#16a34a' }]}>₹{price_per_unit?.toLocaleString()}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#f9fafb' }]}>
              <Text style={styles.statLabel}>Available</Text>
              <Text style={styles.statValue}>{quantity?.toLocaleString()} {unit}</Text>
            </View>
          </View>

          {/* Details */}
          <View style={styles.details}>
            {location?.city && (
              <View style={styles.detailRow}>
                <Ionicons name="location-outline" size={16} color="#9ca3af" />
                <Text style={styles.detailText}>{location.city}{location.state ? `, ${location.state}` : ''}</Text>
              </View>
            )}
            {harvest_date && (
              <View style={styles.detailRow}>
                <Ionicons name="calendar-outline" size={16} color="#9ca3af" />
                <Text style={styles.detailText}>Harvested: {format(new Date(harvest_date), 'dd MMM yyyy')}</Text>
              </View>
            )}
            {expiry_date && (
              <View style={styles.detailRow}>
                <Ionicons name="time-outline" size={16} color="#9ca3af" />
                <Text style={styles.detailText}>Best before: {format(new Date(expiry_date), 'dd MMM yyyy')}</Text>
              </View>
            )}
          </View>

          {description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About this produce</Text>
              <Text style={styles.desc}>{description}</Text>
            </View>
          ) : null}

          {farmer?.name && (
            <View style={styles.farmerRow}>
              <View style={styles.farmerAvatar}>
                <Text style={styles.farmerInitial}>{farmer.name[0].toUpperCase()}</Text>
              </View>
              <View>
                <Text style={styles.farmerName}>{farmer.name}</Text>
                <Text style={styles.farmerLabel}>Verified Farmer</Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {canOrder && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.orderBtn}
            onPress={() => navigation.navigate('PlaceOrder', { listing })}
            activeOpacity={0.85}
          >
            <Ionicons name="cart-outline" size={20} color="#fff" />
            <Text style={styles.orderBtnText}>Place Order</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: '#fff' },
  navbar:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  backBtn:      { marginRight: 12 },
  navTitle:     { flex: 1, fontSize: 16, fontWeight: '600', color: '#111827' },
  scroll:       { paddingBottom: 100 },
  hero:         { height: 200, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center' },
  heroEmoji:    { fontSize: 80 },
  organicBadge: { position: 'absolute', top: 16, right: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  organicText:  { fontSize: 12, fontWeight: '600', color: '#16a34a' },
  body:         { padding: 20, gap: 16 },
  title:        { fontSize: 22, fontWeight: '700', color: '#111827' },
  statsRow:     { flexDirection: 'row', gap: 12 },
  statCard:     { flex: 1, borderRadius: 14, padding: 14 },
  statLabel:    { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  statValue:    { fontSize: 22, fontWeight: '700', color: '#111827' },
  details:      { gap: 8 },
  detailRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailText:   { fontSize: 14, color: '#374151' },
  section:      { gap: 6 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  desc:         { fontSize: 14, color: '#4b5563', lineHeight: 22 },
  farmerRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  farmerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center' },
  farmerInitial:{ fontSize: 18, fontWeight: '700', color: '#16a34a' },
  farmerName:   { fontSize: 15, fontWeight: '600', color: '#111827' },
  farmerLabel:  { fontSize: 12, color: '#6b7280' },
  footer:       { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  orderBtn:     { backgroundColor: '#16a34a', borderRadius: 14, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  orderBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
