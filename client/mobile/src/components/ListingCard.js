import { TouchableOpacity, View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

const CATEGORY_EMOJI = {
  grains: '🌾', vegetables: '🥦', fruits: '🍎',
  dairy:  '🥛', spices: '🌶️',  pulses: '🫘',
  oilseeds: '🌻', other: '📦',
}

export default function ListingCard({ listing, onPress }) {
  const { title, category, price_per_unit, unit, quantity, location, is_organic } = listing

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.emoji}>
        <Text style={styles.emojiText}>{CATEGORY_EMOJI[category] ?? '📦'}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {is_organic && (
            <View style={styles.organicBadge}>
              <Ionicons name="leaf" size={10} color="#16a34a" />
              <Text style={styles.organicText}>Organic</Text>
            </View>
          )}
        </View>
        <Text style={styles.price}>
          ₹{price_per_unit?.toLocaleString()}<Text style={styles.unit}>/{unit}</Text>
        </Text>
        <View style={styles.meta}>
          <Text style={styles.metaText}>{quantity?.toLocaleString()} {unit}</Text>
          {location?.city && (
            <>
              <Text style={styles.dot}>·</Text>
              <Ionicons name="location-outline" size={11} color="#9ca3af" />
              <Text style={styles.metaText}>{location.city}</Text>
            </>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: '#f3f4f6',
    flexDirection: 'row', alignItems: 'center',
    padding: 12, gap: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    marginBottom: 10,
  },
  emoji: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center',
  },
  emojiText: { fontSize: 24 },
  body:      { flex: 1 },
  titleRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  title:     { fontSize: 14, fontWeight: '600', color: '#111827', flex: 1 },
  organicBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0',
    borderRadius: 99, paddingHorizontal: 6, paddingVertical: 2,
  },
  organicText: { fontSize: 10, color: '#16a34a', fontWeight: '600' },
  price:    { fontSize: 16, fontWeight: '700', color: '#16a34a' },
  unit:     { fontSize: 12, fontWeight: '400', color: '#6b7280' },
  meta:     { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  metaText: { fontSize: 11, color: '#9ca3af' },
  dot:      { color: '#d1d5db', fontSize: 11 },
})
