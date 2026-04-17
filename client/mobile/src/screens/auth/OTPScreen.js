import { useState, useRef, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { authApi } from '../../api'

export default function OTPScreen({ navigation, route }) {
  const phone   = route.params?.phone ?? ''
  const [digits, setDigits]   = useState(Array(6).fill(''))
  const [loading, setLoading] = useState(false)
  const refs = useRef([])

  useEffect(() => { refs.current[0]?.focus() }, [])

  const handleChange = (i, val) => {
    if (!/^\d*$/.test(val)) return
    const next = [...digits]
    next[i] = val.slice(-1)
    setDigits(next)
    if (val && i < 5) refs.current[i + 1]?.focus()
    if (next.every(d => d) && i === 5) submitCode(next.join(''))
  }

  const handleKeyPress = (i, key) => {
    if (key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus()
  }

  const submitCode = async (code) => {
    setLoading(true)
    try {
      await authApi.verifyOTP(phone, code)
      navigation.navigate('Login')
    } catch (err) {
      Alert.alert('Invalid Code', err.response?.data?.message ?? 'Try again.')
      setDigits(Array(6).fill(''))
      refs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    try {
      await authApi.sendOTP(phone)
      Alert.alert('Sent', 'A new code was sent to ' + phone)
    } catch { Alert.alert('Error', 'Could not resend code.') }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.inner}>
        <View style={styles.logoWrap}>
          <Ionicons name="chatbubble-ellipses-outline" size={30} color="#16a34a" />
        </View>
        <Text style={styles.title}>Verify Phone</Text>
        <Text style={styles.sub}>Enter the 6-digit code sent to{'\n'}<Text style={{ fontWeight: '700' }}>{phone}</Text></Text>

        <View style={styles.boxes}>
          {digits.map((d, i) => (
            <TextInput
              key={i}
              ref={el => refs.current[i] = el}
              style={[styles.box, d ? styles.boxFilled : {}]}
              value={d}
              onChangeText={val => handleChange(i, val)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
              keyboardType="number-pad"
              maxLength={1}
              editable={!loading}
              selectTextOnFocus
            />
          ))}
        </View>

        <TouchableOpacity onPress={handleResend} style={styles.resend}>
          <Text style={styles.resendText}>Resend code</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0fdf4' },
  inner:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  logoWrap:  { width: 68, height: 68, borderRadius: 22, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title:     { fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 8 },
  sub:       { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 20, marginBottom: 36 },
  boxes:     { flexDirection: 'row', gap: 10, marginBottom: 28 },
  box:       { width: 48, height: 56, borderRadius: 12, borderWidth: 2, borderColor: '#d1fae5', backgroundColor: '#fff', textAlign: 'center', fontSize: 22, fontWeight: '700', color: '#111827' },
  boxFilled: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  resend:    { marginTop: 4 },
  resendText:{ color: '#16a34a', fontWeight: '600', fontSize: 14, textDecorationLine: 'underline' },
})
