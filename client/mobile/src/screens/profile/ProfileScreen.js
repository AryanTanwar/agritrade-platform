import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../contexts/AuthContext'

function Row({ icon, label, value, onPress, destructive }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} disabled={!onPress} activeOpacity={0.7}>
      <Ionicons name={icon} size={20} color={destructive ? '#ef4444' : '#6b7280'} style={styles.rowIcon} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, destructive && { color: '#ef4444' }]}>{label}</Text>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      </View>
      {onPress && !destructive && <Ionicons name="chevron-forward" size={16} color="#d1d5db" />}
    </TouchableOpacity>
  )
}

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth()

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ])
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{user?.name}</Text>
          <View style={styles.roleBadge}>
            <Ionicons name={user?.role === 'farmer' ? 'leaf' : 'bag'} size={12} color="#16a34a" />
            <Text style={styles.roleText}>{user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}</Text>
          </View>
        </View>

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Row icon="call-outline"   label="Phone"  value={user?.phone} />
          <Row icon="person-outline" label="Name"   value={user?.name} />
          <Row icon="shield-outline" label="KYC Status" value={user?.kyc_status ?? 'Not submitted'} />
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <Row icon="lock-closed-outline"  label="Change Password"  onPress={() => {}} />
          <Row icon="notifications-outline" label="Notifications"   onPress={() => {}} />
        </View>

        <View style={styles.section}>
          <Row icon="log-out-outline" label="Sign Out" onPress={handleLogout} destructive />
        </View>

        <Text style={styles.version}>AgriTrade v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: '#f9fafb' },
  scroll:        { padding: 20, gap: 20, paddingBottom: 40 },
  avatarSection: { alignItems: 'center', paddingVertical: 12 },
  avatar:        { width: 80, height: 80, borderRadius: 40, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText:    { fontSize: 32, fontWeight: '700', color: '#16a34a' },
  name:          { fontSize: 20, fontWeight: '700', color: '#111827' },
  roleBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, marginTop: 6 },
  roleText:      { fontSize: 12, fontWeight: '600', color: '#16a34a' },
  section:       { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  sectionTitle:  { fontSize: 12, fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  row:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#f9fafb' },
  rowIcon:       { marginRight: 12 },
  rowLabel:      { fontSize: 15, fontWeight: '500', color: '#111827' },
  rowValue:      { fontSize: 13, color: '#6b7280', marginTop: 1 },
  version:       { textAlign: 'center', fontSize: 12, color: '#d1d5db' },
})
