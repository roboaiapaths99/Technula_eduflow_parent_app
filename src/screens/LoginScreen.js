import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert, ScrollView, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { parentApi, formatUserError, getSavedSchool, clearSavedSchool } from '../api';
import { theme } from '../theme';
import SchoolSelectScreen from './SchoolSelectScreen';
import PrivacyPolicyModal from '../components/PrivacyPolicyModal';

export default function LoginScreen({ onLoginSuccess }) {
  // School Discovery State
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [schoolLoading, setSchoolLoading] = useState(true);

  // Mobile OTP State
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  // First-time Primary Confirmation Modal State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [detectedStudents, setDetectedStudents] = useState([]);
  const [confirmingPrimary, setConfirmingPrimary] = useState(false);

  // Legal & Privacy Policy Modal State
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [legalTab, setLegalTab] = useState('privacy');

  // Check for saved school on launch
  useEffect(() => {
    async function loadSchool() {
      try {
        const saved = await getSavedSchool();
        if (saved) {
          setSelectedSchool(saved);
        }
      } catch (e) {
        console.warn('Error loading saved school:', e);
      } finally {
        setSchoolLoading(false);
      }
    }
    loadSchool();
  }, []);

  // Countdown timer for OTP
  useEffect(() => {
    if (resendTimer > 0) {
      const interval = setInterval(() => {
        setResendTimer(t => t - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [resendTimer]);

  const handleSwitchSchool = async () => {
    await clearSavedSchool();
    setSelectedSchool(null);
    setOtpSent(false);
    setOtp('');
    setShowConfirmModal(false);
  };

  // ── OTP Handlers ─────────────────────────────────────
  const handleSendOtp = async (customPhone = null) => {
    const targetPhone = (customPhone || phone).trim().replace(/[^0-9]/g, '');
    const cleanPhone = targetPhone.slice(-10);

    if (cleanPhone.length !== 10 || !['6', '7', '8', '9'].includes(cleanPhone[0])) {
      Alert.alert('Invalid Mobile', 'Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.');
      return;
    }

    if (/^(\d)\1{9}$/.test(cleanPhone) || ['1234567890', '0123456789', '9876543210'].includes(cleanPhone) || new Set(cleanPhone).size < 3) {
      Alert.alert('Invalid Mobile', 'Please enter a genuine, registered mobile number (dummy and repetitive numbers are not allowed).');
      return;
    }

    if (!selectedSchool?.id) {
      Alert.alert('School Required', 'Please select your school first.');
      return;
    }

    setOtpLoading(true);
    try {
      const res = await parentApi.sendMobileOtp(selectedSchool.id, cleanPhone);
      setOtpSent(true);
      setResendTimer(60);
      Alert.alert('Verification Code Sent', res.message || 'Please enter the 6-digit OTP sent to your registered mobile number.');
    } catch (err) {
      Alert.alert('Lookup Failed', formatUserError(err, 'No student record found with this mobile number at this school.'));
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const cleanPhone = phone.trim().replace(/[^0-9]/g, '').slice(-10);
    const cleanOtp = otp.trim();

    if (!cleanOtp) {
      Alert.alert('Required', 'Please enter the 6-digit verification code.');
      return;
    }

    setOtpLoading(true);
    try {
      const res = await parentApi.verifyMobileOtp(selectedSchool.id, cleanPhone, cleanOtp);

      if (res.status === 'AUTHENTICATED') {
        onLoginSuccess(res.user);
      } else if (res.status === 'NEED_PRIMARY_CONFIRMATION') {
        setDetectedStudents(res.students || []);
        setShowConfirmModal(true);
      }
    } catch (err) {
      Alert.alert('Verification Failed', formatUserError(err, 'Invalid or expired OTP code.'));
    } finally {
      setOtpLoading(false);
    }
  };

  const handleConfirmPrimary = async () => {
    const cleanPhone = phone.trim().replace(/[^0-9]/g, '').slice(-10);
    setConfirmingPrimary(true);
    try {
      const res = await parentApi.confirmPrimaryPhone(
        selectedSchool.id,
        cleanPhone,
        detectedStudents.map(s => s.id)
      );
      setShowConfirmModal(false);
      onLoginSuccess(res.user);
    } catch (err) {
      Alert.alert('Confirmation Failed', formatUserError(err, 'Failed to link account as primary mobile.'));
    } finally {
      setConfirmingPrimary(false);
    }
  };

  if (schoolLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // If no school selected yet, render SchoolSelectScreen
  if (!selectedSchool) {
    return <SchoolSelectScreen onSchoolSelected={(school) => setSelectedSchool(school)} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Unified Campus Identity Card */}
        <View style={styles.campusCard}>
          <Image
            source={require('../../assets/logo.jpg')}
            style={styles.campusLogo}
            resizeMode="cover"
          />
          <View style={styles.campusDetails}>
            <View style={styles.badgeRow}>
              <View style={styles.schoolPill}>
                <Text style={styles.schoolPillText}>CONNECTED CAMPUS</Text>
              </View>
              {selectedSchool?.code ? (
                <View style={styles.codePill}>
                  <Text style={styles.codePillText}>{selectedSchool.code}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.campusName} numberOfLines={1}>{selectedSchool.name}</Text>
            <Text style={styles.campusMeta}>
              {selectedSchool.city ? `${selectedSchool.city} • ` : ''}Parent & Student Portal
            </Text>
          </View>
          <TouchableOpacity
            style={styles.switchSchoolBtn}
            onPress={handleSwitchSchool}
            activeOpacity={0.7}
          >
            <Text style={styles.switchSchoolBtnText}>Change</Text>
          </TouchableOpacity>
        </View>

        {/* ── MOBILE OTP LOGIN (DEDICATED FOR PARENTS) ── */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardHeader}>Parent Mobile Login</Text>
              <Text style={styles.cardSub}>
                Enter your registered mobile number to receive your secure OTP code.
              </Text>
            </View>
          </View>

          {/* Mobile Number Input */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>REGISTERED MOBILE NUMBER</Text>
            <View style={styles.phoneInputRow}>
              <View style={styles.countryCode}>
                <Text style={styles.countryCodeText}>🇮🇳 +91</Text>
              </View>
              <TextInput
                style={styles.phoneInput}
                value={phone}
                onChangeText={(val) => {
                  setPhone(val);
                  if (otpSent) setOtpSent(false);
                }}
                placeholder="98765 43210"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                maxLength={10}
                editable={!otpLoading}
              />
            </View>
          </View>

          {/* OTP Input (Visible when sent) */}
          {otpSent && (
            <View style={styles.fieldGroup}>
              <View style={styles.otpHeaderRow}>
                <Text style={styles.fieldLabel}>6-DIGIT VERIFICATION CODE</Text>
                {resendTimer > 0 ? (
                  <Text style={styles.timerText}>Resend in {resendTimer}s</Text>
                ) : (
                  <TouchableOpacity onPress={() => handleSendOtp()} disabled={otpLoading}>
                    <Text style={styles.resendLink}>Resend OTP</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TextInput
                style={styles.otpInput}
                value={otp}
                onChangeText={setOtp}
                placeholder="Enter 6-digit OTP"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                maxLength={6}
                editable={!otpLoading}
              />
            </View>
          )}

          {/* Actions */}
          {!otpSent ? (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => handleSendOtp()}
              disabled={otpLoading}
              activeOpacity={0.85}
            >
              {otpLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Send Verification Code →</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.verifyButton}
              onPress={handleVerifyOtp}
              disabled={otpLoading}
              activeOpacity={0.85}
            >
              {otpLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.verifyButtonText}>Verify & Open Dashboard ✓</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Security Trust & Legal Compliance Footer */}
        <View style={styles.trustFooter}>
          <Text style={styles.trustFooterText}>🔒 Official School Portal • Encrypted Session</Text>
          <View style={styles.legalLinksRow}>
            <TouchableOpacity onPress={() => { setLegalTab('privacy'); setShowPrivacyModal(true); }}>
              <Text style={styles.legalLinkText}>Privacy Policy</Text>
            </TouchableOpacity>
            <Text style={styles.legalDot}>•</Text>
            <TouchableOpacity onPress={() => { setLegalTab('terms'); setShowPrivacyModal(true); }}>
              <Text style={styles.legalLinkText}>Terms</Text>
            </TouchableOpacity>
            <Text style={styles.legalDot}>•</Text>
            <TouchableOpacity onPress={() => { setLegalTab('deletion'); setShowPrivacyModal(true); }}>
              <Text style={styles.legalLinkText}>Data Safety</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Google Play Verified Privacy Policy & Data Deletion Modal */}
      <PrivacyPolicyModal
        visible={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        initialTab={legalTab}
      />

      {/* Primary Mobile Confirmation Modal */}
      <Modal visible={showConfirmModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconWrap}>
                <Text style={{ fontSize: 24 }}>🎓</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Confirm Scholar Link</Text>
                <Text style={styles.modalSub}>
                  Mobile +91 {phone.slice(-10)} matches verified student record:
                </Text>
              </View>
            </View>

            <View style={styles.studentList}>
              {detectedStudents.map((st) => (
                <View key={st.id} style={styles.studentItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stName}>{st.name}</Text>
                    <Text style={styles.stMeta}>
                      Class {st.grade}-{st.section} • Roll #{st.roll_no || '1'} • Adm: {st.admission_no || 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.stTag}>
                    <Text style={styles.stTagText}>✓ Matched</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={{ gap: 10 }}>
              <TouchableOpacity
                style={styles.confirmModalBtn}
                onPress={handleConfirmPrimary}
                disabled={confirmingPrimary}
                activeOpacity={0.85}
              >
                {confirmingPrimary ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.confirmModalBtnText}>Confirm & Continue →</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setShowConfirmModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelModalBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  campusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    gap: 12,
  },
  campusLogo: {
    width: 46,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  campusDetails: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  schoolPill: {
    backgroundColor: 'rgba(99, 91, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  schoolPillText: {
    color: theme.colors.primary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  codePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  codePillText: {
    color: '#475569',
    fontSize: 9,
    fontWeight: '800',
    fontFamily: 'monospace',
    letterSpacing: 0.5,
  },
  campusName: {
    color: '#0A2540',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  campusMeta: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  switchSchoolBtn: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  switchSchoolBtnText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeaderRow: {
    marginBottom: 16,
  },
  cardHeader: {
    color: '#0A2540',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },
  cardSub: {
    color: '#64748B',
    fontSize: 12.5,
    lineHeight: 18,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  phoneInputRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    overflow: 'hidden',
  },
  countryCode: {
    backgroundColor: '#EEF2F6',
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRightWidth: 1.5,
    borderRightColor: '#CBD5E1',
  },
  countryCodeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0A2540',
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '700',
    color: '#0A2540',
    letterSpacing: 1,
  },
  otpHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  timerText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
  },
  resendLink: {
    fontSize: 11,
    color: theme.colors.primary,
    fontWeight: '800',
  },
  otpInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 20,
    fontWeight: '800',
    color: '#0A2540',
    letterSpacing: 4,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0A2540',
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  verifyButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  verifyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  trustFooter: {
    marginTop: 20,
    alignItems: 'center',
    gap: 8,
  },
  trustFooterText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  legalLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  legalLinkText: {
    fontSize: 11,
    color: theme.colors.primary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  legalDot: {
    fontSize: 10,
    color: '#94A3B8',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 37, 64, 0.65)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  modalIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 91, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0A2540',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  studentList: {
    gap: 8,
    marginBottom: 18,
  },
  studentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
  },
  stName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0A2540',
  },
  stMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  stTag: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
  },
  confirmModalBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmModalBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  cancelModalBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelModalBtnText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
});
