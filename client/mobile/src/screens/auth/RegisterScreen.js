import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../contexts/AuthContext'

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth()
  const [role,     setRole]     = useState('buyer')
  const [name,     setName]     = useState('')
  const [phone,    setPhone]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)

  const handleRegister = async () => {
    if (!name || !phone || !password) { Alert.alert('Error', 'Fill all fields.'); return }
    if (password.length < 8) { Alert.alert('Error', 'Password must be at least 8 characters.'); return }
    setLoading(true)
    try {
      await register(role, { name, phone, password })
      navigation.navigate('OTP', { phone })
    } catch (err) {
      Alert.alert('Registration Failed', err.response?.data?.message ?? 'Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logoWrap}>
            <Ionicons name="person-add" size={28} color="#16a34a" />
          </View>
          <Text style={styles.title}>Create Account</Text>
        </View>

        {/* Role selector */}
        <View style={styles.roleRow}>
          {['buyer', 'farmer'].map(r => (
            <TouchableOpacity
              key={r}
              style={[styles.roleBtn, role === r && styles.roleBtnActive]}
              onPress={() => setRole(r)}
            >
              <Ionicons
                name={r === 'farmer' ? 'leaf-outline' : 'bag-outline'}
                size={18}
                color={role === r ? '#16a34a' : '#9ca3af'}
              />
              <Text style={[styles.roleText, role === r && styles.roleTextActive]}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.form}>
          {[
            { label: 'Full Name',     value: name,     setter: setName,     placeholder: 'Ramesh Kumar', keyboardType: 'default' },
            { label: 'Phone Number',  value: phone,    setter: setPhone,    placeholder: '+91 9876543210', keyboardType: 'phone-pad' },
            { label: 'Password',      value: password, setter: setPassword, placeholder: 'Min 8 characters', keyboardType: 'default', secure: true },
          ].map(({ label, value, setter, placeholder, keyboardType, secure }) => (
            <View key={label} style={styles.field}>
              <Text style={styles.label}>{label}</Text>
              <TextInput
                style={styles.input}
                placeholder={placeholder}
                value={value}
                onChangeText={setter}
                keyboardType={keyboardType}
                secureTextEntry={!!secure}
                autoCorrect={false}
              />
            </View>
          ))}

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.btnText}>{loading ? 'Registering…' : `Register as ${role}`}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.link}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#f0fdf4' },
  scroll:         { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header:         { alignItems: 'center', marginBottom: 24 },
  logoWrap:       { width: 64, height: 64, borderRadius: 20, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title:          { fontSize: 22, fontWeight: '700', color: '#111827' },
  roleRow:        { flexDirection: 'row', gap: 12, marginBottom: 20 },
  roleBtn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  roleBtnActive:  { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  roleText:       { fontSize: 15, fontWeight: '600', color: '#9ca3af' },
  roleTextActive: { color: '#16a34a' },
  form:           { backgroundColor: '#fff', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  field:          { marginBottom: 14 },
  label:          { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input:          { borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111827', backgroundColor: '#fafafa' },
  btn:            { backgroundColor: '#16a34a', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  btnDisabled:    { backgroundColor: '#86efac' },
  btnText:        { color: '#fff', fontSize: 15, fontWeight: '700' },
  footer:         { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText:     { color: '#6b7280', fontSize: 14 },
  link:           { color: '#16a34a', fontWeight: '600', fontSize: 14 },
})
