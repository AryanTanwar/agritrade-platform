import { useState } from 'react'
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { listingApi } from '../../api'
import ListingCard from '../../components/ListingCard'

const CATEGORIES = ['all', 'grains', 'vegetables', 'fruits', 'dairy', 'spices', 'pulses', 'oilseeds']

export default function MarketplaceScreen({ navigation }) {
  const [search,   setSearch]   = useState('')
  const [category, setCategory] = useState('all')
  const [organic,  setOrganic]  = useState(false)

  const params = {
    ...(search && { search }),
    ...(category !== 'all' && { category }),
    ...(organic && { is_organic: true }),
    limit: 20,
  }

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['listings', params],
    queryFn:  () => listingApi.list(params).then(r => r.data),
  })

  const listings = data?.listings ?? data?.data ?? []

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Marketplace</Text>
        <Text style={styles.sub}>Fresh produce, direct from farms</Text>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color="#9ca3af" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search produce…"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color="#9ca3af" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Category chips */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[styles.chip, category === cat && styles.chipActive]}
            onPress={() => setCategory(cat)}
          >
            <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.chip, organic && styles.chipOrganic]}
          onPress={() => setOrganic(o => !o)}
        >
          <Ionicons name="leaf-outline" size={12} color={organic ? '#16a34a' : '#6b7280'} />
          <Text style={[styles.chipText, organic && styles.chipTextOrganic]}> Organic</Text>
        </TouchableOpacity>
      </ScrollView>

      {isLoading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#16a34a" />
        </View>
      )}

      {isError && (
        <View style={styles.center}>
          <Text style={styles.errorText}>Failed to load listings.</Text>
          <TouchableOpacity onPress={refetch} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isLoading && !isError && (
        <FlatList
          data={listings}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <ListingCard
              listing={item}
              onPress={() => navigation.navigate('ListingDetail', { listing: item })}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyEmoji}>🌾</Text>
              <Text style={styles.emptyText}>No listings found.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: '#f9fafb' },
  header:         { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title:          { fontSize: 24, fontWeight: '700', color: '#111827' },
  sub:            { fontSize: 13, color: '#6b7280', marginTop: 2 },
  searchWrap:     { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e7eb', paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
  searchIcon:     { marginRight: 8 },
  searchInput:    { flex: 1, fontSize: 15, color: '#111827' },
  chips:          { paddingHorizontal: 20, gap: 8, marginBottom: 16 },
  chip:           { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99, backgroundColor: '#f3f4f6', flexDirection: 'row', alignItems: 'center' },
  chipActive:     { backgroundColor: '#16a34a' },
  chipOrganic:    { backgroundColor: '#dcfce7', borderWidth: 1, borderColor: '#86efac' },
  chipText:       { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  chipTextOrganic:{ color: '#16a34a', fontWeight: '600' },
  list:           { paddingHorizontal: 20, paddingBottom: 32 },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyEmoji:     { fontSize: 40, marginBottom: 8 },
  emptyText:      { color: '#9ca3af', fontSize: 15 },
  errorText:      { color: '#ef4444', marginBottom: 12 },
  retryBtn:       { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#16a34a', borderRadius: 8 },
  retryText:      { color: '#fff', fontWeight: '600' },
})
