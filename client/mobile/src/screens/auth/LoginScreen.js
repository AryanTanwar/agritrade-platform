import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../contexts/AuthContext'

export default function LoginScreen({ navigation }) {
  const { login } = useAuth()
  const [phone,    setPhone]    = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)

  const handleLogin = async () => {
    if (!phone || !password) { Alert.alert('Error', 'Please fill all fields.'); return }
    setLoading(true)
    try {
      await login({ phone, password })
      // Navigation handled by RootNavigator based on user state
    } catch (err) {
      Alert.alert('Login Failed', err.response?.data?.message ?? 'Invalid credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logoWrap}>
            <Ionicons name="leaf" size={32} color="#16a34a" />
          </View>
          <Text style={styles.title}>Welcome to AgriTrade</Text>
          <Text style={styles.subtitle}>Sign in to your account</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="+91 9876543210"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              autoCorrect={false}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                style={[styles.input, { flex: 1, borderWidth: 0, paddingRight: 0 }]}
                secureTextEntry={!showPass}
                value={password}
                onChangeText={setPassword}
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowPass(s => !s)} style={styles.eyeBtn}>
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9ca3af" />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.btnText}>{loading ? 'Signing in…' : 'Sign In'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.link}>Register</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0fdf4' },
  scroll:    { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header:    { alignItems: 'center', marginBottom: 40 },
  logoWrap:  { width: 72, height: 72, borderRadius: 24, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title:     { fontSize: 24, fontWeight: '700', color: '#111827', textAlign: 'center' },
  subtitle:  { fontSize: 14, color: '#6b7280', marginTop: 4 },
  form:      { backgroundColor: '#fff', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  field:     { marginBottom: 16 },
  label:     { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input:     { borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111827', backgroundColor: '#fafafa' },
  passwordWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10, backgroundColor: '#fafafa', paddingHorizontal: 14 },
  eyeBtn:    { padding: 4 },
  btn:       { backgroundColor: '#16a34a', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  btnDisabled: { backgroundColor: '#86efac' },
  btnText:   { color: '#fff', fontSize: 16, fontWeight: '700' },
  footer:    { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText:{ color: '#6b7280', fontSize: 14 },
  link:      { color: '#16a34a', fontWeight: '600', fontSize: 14 },
})
