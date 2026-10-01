import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Switch, Alert, Modal
} from 'react-native';
import { theme } from '../theme';
import { parentApi } from '../api';

export default function ProfileEditScreen({ user, activeChild }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);

  // Phone Change Request State
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [phoneReason, setPhoneReason] = useState('Changed primary mobile carrier');
  const [submittingPhone, setSubmittingPhone] = useState(false);

  // Form Fields
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');

  // Notification Channel Opt-ins
  const [allowWhatsApp, setAllowWhatsApp] = useState(true);
  const [allowEmail, setAllowEmail] = useState(true);
  const [allowSms, setAllowSms] = useState(false);

  const parentUserId = user?.id;

  const loadProfile = async () => {
    try {
      const [profileRes, prefsRes] = await Promise.allSettled([
        parentApi.getParentProfile(parentUserId),
        parentApi.getNotificationPreferences(parentUserId),
      ]);

      if (profileRes.status === 'fulfilled' && profileRes.value) {
        const p = profileRes.value;
        setPhone(p.phone || user.phone || '');
        setEmail(p.email || user.email || '');
        setAddress(p.address || '');
        setEmergencyContactName(p.emergency_contact_name || '');
        setEmergencyContactPhone(p.emergency_contact_phone || '');
        if (p.has_pending_request || p.pending_review) {
          setPendingApproval(true);
        }
      }

      if (prefsRes.status === 'fulfilled' && prefsRes.value) {
        const c = prefsRes.value;
        setAllowWhatsApp(c.allow_whatsapp !== false);
        setAllowEmail(c.allow_email !== false);
        setAllowSms(c.allow_sms === true);
      }
    } catch (e) {
      console.warn('Failed to load parent profile:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [parentUserId]);

  const isValidMobile = (val) => {
    if (!val) return true;
    const clean = val.replace(/[^0-9]/g, '').slice(-10);
    if (clean.length !== 10 || !['6', '7', '8', '9'].includes(clean[0])) return false;
    if (/^(\d)\1{9}$/.test(clean) || ['1234567890', '0123456789', '9876543210'].includes(clean) || new Set(clean).size < 3) return false;
    return true;
  };

  const handleSave = async () => {
    if (phone && !isValidMobile(phone)) {
      Alert.alert('Invalid Mobile', 'Please enter a genuine 10-digit mobile number starting with 6, 7, 8, or 9.');
      return;
    }
    if (emergencyContactPhone && !isValidMobile(emergencyContactPhone)) {
      Alert.alert('Invalid Contact', 'Emergency contact phone must be a genuine 10-digit mobile number starting with 6-9.');
      return;
    }
    if (emergencyContactName && emergencyContactName.trim().length > 0 && emergencyContactName.trim().length < 2) {
      Alert.alert('Invalid Name', 'Emergency contact name must be at least 2 characters.');
      return;
    }

    try {
      setSaving(true);
      // 1. Update Profile Information
      const updateData = {
        phone: phone.replace(/[^0-9]/g, '').slice(-10),
        address,
        emergency_contact_name: emergencyContactName.trim(),
        emergency_contact_phone: emergencyContactPhone ? emergencyContactPhone.replace(/[^0-9]/g, '').slice(-10) : '',
      };
      const res = await parentApi.updateParentProfile(parentUserId, updateData);

      // 2. Update Channel Notification Preferences
      await parentApi.updateNotificationPreferences(parentUserId, {
        allow_whatsapp: allowWhatsApp,
        allow_email: allowEmail,
        allow_sms: allowSms,
      });

      if (res?.requires_approval || res?.status === 'PENDING') {
        setPendingApproval(true);
        Alert.alert(
          'Submitted for Verification',
          'Your profile change request has been submitted to the school administration for verification and will reflect once approved.'
        );
      } else {
        Alert.alert('Success', 'Profile and communication channels updated successfully.');
      }
    } catch (e) {
      Alert.alert('Profile Update Notice', e.message || 'Failed to update profile settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleRequestPhoneChange = async () => {
    const clean = newPhone.replace(/[^0-9]/g, '').slice(-10);
    if (!clean || !isValidMobile(clean)) {
      Alert.alert('Invalid Mobile', 'Please enter a genuine 10-digit mobile number starting with 6, 7, 8, or 9.');
      return;
    }
    setSubmittingPhone(true);
    try {
      const res = await parentApi.requestPhoneChange(clean, phoneReason);
      setShowPhoneModal(false);
      setPendingApproval(true);
      Alert.alert('Request Submitted', res.message || 'Change request submitted for School Admin approval.');
    } catch (err) {
      Alert.alert('Submission Failed', err.message || 'Failed to submit phone change request.');
    } finally {
      setSubmittingPhone(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Top Banner */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Guardian Profile & Channels</Text>
        <Text style={styles.headerSub}>
          Manage registered contact info, emergency contacts & notification channels
        </Text>
      </View>

      {/* Pending Approval Notice */}
      {pendingApproval && (
        <View style={styles.pendingNoticeBox}>
          <Text style={{ fontSize: 20 }}>⏳</Text>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.pendingTitle}>Change Request Pending Admin Verification</Text>
            <Text style={styles.pendingDesc}>
              A recent change to your primary mobile or address is awaiting review by the school administration desk.
            </Text>
          </View>
        </View>
      )}

      {/* Form Card */}
      <View style={styles.card}>
        <Text style={styles.sectionHeader}>Personal Contact Details</Text>

        <Text style={styles.label}>Parent / Guardian Full Name</Text>
        <TextInput
          style={[styles.input, styles.readOnlyInput]}
          value={user.full_name || user.name || 'Guardian'}
          editable={false}
        />

        <Text style={styles.label}>Registered Email (Account Login)</Text>
        <TextInput
          style={[styles.input, styles.readOnlyInput]}
          value={email}
          editable={false}
        />

        <Text style={styles.label}>Registered Primary Mobile (Account Login) 🔒</Text>
        <View style={styles.lockedPhoneBox}>
          <View style={{ flex: 1 }}>
            <Text style={styles.lockedPhoneText}>
              {phone ? `+91 ${phone.replace(/[^0-9]/g, '').slice(-10)}` : 'Not configured'}
            </Text>
            <Text style={styles.lockedPhoneNote}>
              Protected contact. Used for OTP authentication and security alerts.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.changePhoneBtn}
            onPress={() => {
              setNewPhone('');
              setShowPhoneModal(true);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.changePhoneBtnText}>Request Change</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Residential Address</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={address}
          onChangeText={setAddress}
          multiline
          numberOfLines={2}
          placeholder="House No, Apartment, Street, City"
        />

        <Text style={[styles.sectionHeader, { marginTop: 24 }]}>Emergency Contact Details</Text>
        <Text style={styles.subtext}>
          Used exclusively by campus clinic & front gate in case primary guardian is unreachable.
        </Text>

        <Text style={styles.label}>Emergency Contact Person</Text>
        <TextInput
          style={styles.input}
          value={emergencyContactName}
          onChangeText={setEmergencyContactName}
          placeholder="e.g. Ramesh Kumar (Uncle)"
        />

        <Text style={styles.label}>Emergency Contact Phone</Text>
        <TextInput
          style={styles.input}
          value={emergencyContactPhone}
          onChangeText={setEmergencyContactPhone}
          keyboardType="phone-pad"
          placeholder="+91 98765 00000"
        />
      </View>

      {/* Notification Channel Permissions Card */}
      <View style={styles.card}>
        <Text style={styles.sectionHeader}>Communication Channel Permissions</Text>
        <Text style={styles.subtext}>
          Choose how the school delivers alerts, report cards & daily updates to you.
        </Text>

        <View style={styles.channelRow}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 16 }}>💬</Text>
              <Text style={styles.channelTitle}>WhatsApp Alerts</Text>
            </View>
            <Text style={styles.channelSub}>Receive instant homework, attendance, & gate pass updates on WhatsApp.</Text>
          </View>
          <Switch
            value={allowWhatsApp}
            onValueChange={setAllowWhatsApp}
            trackColor={{ true: theme.colors.emerald, false: '#CBD5E1' }}
          />
        </View>

        <View style={styles.channelRow}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 16 }}>✉️</Text>
              <Text style={styles.channelTitle}>Email Circulars</Text>
            </View>
            <Text style={styles.channelSub}>Receive official notices, fee receipts, & term report cards.</Text>
          </View>
          <Switch
            value={allowEmail}
            onValueChange={setAllowEmail}
            trackColor={{ true: theme.colors.emerald, false: '#CBD5E1' }}
          />
        </View>

        <View style={styles.channelRow}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 16 }}>📱</Text>
              <Text style={styles.channelTitle}>SMS Alerts</Text>
            </View>
            <Text style={styles.channelSub}>Emergency weather closures & urgent school campus alerts.</Text>
          </View>
          <Switch
            value={allowSms}
            onValueChange={setAllowSms}
            trackColor={{ true: theme.colors.emerald, false: '#CBD5E1' }}
          />
        </View>

        <View style={[styles.channelRow, { borderBottomWidth: 0 }]}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 16 }}>🔔</Text>
              <Text style={styles.channelTitle}>In-App Push Feed</Text>
            </View>
            <Text style={styles.channelSub}>Always active to ensure compliance, auditing, & security logs.</Text>
          </View>
          <View style={styles.lockedPill}>
            <Text style={styles.lockedPillText}>Always On</Text>
          </View>
        </View>
      </View>

      {/* Save Changes Button */}
      <TouchableOpacity
        style={[styles.saveBtn, saving && { opacity: 0.7 }]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.saveBtnText}>Save Profile & Channel Preferences</Text>
        )}
      </TouchableOpacity>

      {/* Phone Change Modal */}
      <Modal
        visible={showPhoneModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPhoneModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Request Primary Phone Change</Text>
            <Text style={styles.modalDesc}>
              For security, changing your login mobile requires verification by the School Administration.
            </Text>

            <Text style={styles.label}>NEW 10-DIGIT MOBILE NUMBER *</Text>
            <View style={styles.phoneInputRow}>
              <View style={styles.countryCode}>
                <Text style={styles.countryCodeText}>🇮🇳 +91</Text>
              </View>
              <TextInput
                style={styles.modalInput}
                value={newPhone}
                onChangeText={setNewPhone}
                placeholder="98765 00000"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
                maxLength={10}
              />
            </View>

            <Text style={[styles.label, { marginTop: 12 }]}>REASON FOR CHANGE</Text>
            <TextInput
              style={[styles.modalInput, { marginBottom: 16 }]}
              value={phoneReason}
              onChangeText={setPhoneReason}
              placeholder="e.g. Changed primary SIM / mobile operator"
              placeholderTextColor="#94a3b8"
            />

            <TouchableOpacity
              style={[styles.modalSubmitBtn, submittingPhone && { opacity: 0.7 }]}
              onPress={handleRequestPhoneChange}
              disabled={submittingPhone}
            >
              {submittingPhone ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.modalSubmitBtnText}>Submit to School Admin →</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setShowPhoneModal(false)}
            >
              <Text style={styles.modalCancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: theme.colors.bgMain, gap: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { marginBottom: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.textPrimary },
  headerSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  pendingNoticeBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: theme.radius.md,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  pendingTitle: { fontSize: 13, fontWeight: '800', color: '#92400E' },
  pendingDesc: { fontSize: 11, color: '#B45309', marginTop: 2, lineHeight: 15 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  sectionHeader: { fontSize: 14, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 4 },
  subtext: { fontSize: 11, color: theme.colors.textMuted, marginBottom: 12, lineHeight: 16 },
  label: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginTop: 10, marginBottom: 4 },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  readOnlyInput: { backgroundColor: '#F1F5F9', color: '#64748B' },
  textArea: { minHeight: 60, textAlignVertical: 'top' },
  lockedPhoneBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F1F5F9',
    borderRadius: theme.radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    gap: 10,
  },
  lockedPhoneText: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    fontFamily: 'monospace',
  },
  lockedPhoneNote: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 2,
    lineHeight: 14,
  },
  changePhoneBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  changePhoneBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  channelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  channelTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },
  channelSub: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2, paddingRight: 10, lineHeight: 15 },
  lockedPill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  lockedPillText: { fontSize: 11, fontWeight: '800', color: '#059669' },
  saveBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    marginBottom: 20,
    ...theme.shadows.card,
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.lg,
    padding: 20,
    ...theme.shadows.card,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  modalDesc: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: 14,
    lineHeight: 17,
  },
  phoneInputRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
  },
  countryCode: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
  },
  countryCodeText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  modalSubmitBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    marginTop: 6,
  },
  modalSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  modalCancelBtn: {
    marginTop: 12,
    alignItems: 'center',
  },
  modalCancelBtnText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
});
