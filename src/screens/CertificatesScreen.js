import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, Modal, TextInput, Linking, Alert
} from 'react-native';
import { theme } from '../theme';
import { parentApi, getApiBase } from '../api';

export default function CertificatesScreen({ user = {}, activeChild = null } = {}) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [certificates, setCertificates] = useState([]);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Application form
  const [certType, setCertType] = useState('BONAFIDE');
  const [reason, setReason] = useState('');
  const [deliveryMode, setDeliveryMode] = useState('ONLINE_APP');

  const studentId = activeChild?.student_id;
  const parentUserId = user?.id;

  const loadCertificates = async () => {
    if (!studentId) { setLoading(false); return; }
    try {
      const res = await parentApi.getStudentCertificates(studentId);
      setCertificates(res || []);
    } catch (e) {
      console.warn('Failed to load certificates:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadCertificates(); }, [studentId]);

  const onRefresh = () => { setRefreshing(true); loadCertificates(); };

  const handleApply = async () => {
    if (!reason.trim()) {
      Alert.alert('Required', 'Please enter a purpose / reason for the certificate request.');
      return;
    }

    setSubmitting(true);
    try {
      await parentApi.applyCertificate({
        student_id: studentId,
        parent_user_id: parentUserId,
        certificate_type: certType,
        purpose_reason: reason.trim(),
        delivery_mode: deliveryMode,
      });

      Alert.alert('Application Submitted!', 'Your request has been routed to the Principal\'s Office for review and digital seal.');
      setShowApplyModal(false);
      setReason('');
      loadCertificates();
    } catch (err) {
      Alert.alert('Application Notice', err.message || 'Could not submit certificate application.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenCertificate = (certNo) => {
    const url = parentApi.getCertificateViewUrl(certNo);
    Linking.openURL(url).catch(e => Alert.alert('Cannot Open', 'Could not open certificate URL.'));
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header with Apply Button */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Digital School Certificates</Text>
          <Text style={styles.subtitle}>
            Transfer Certificates, Bonafide & Character Documents with Digital Seal
          </Text>
        </View>

        <TouchableOpacity
          style={styles.applyBtn}
          onPress={() => setShowApplyModal(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.applyBtnText}>+ Request Certificate</Text>
        </TouchableOpacity>
      </View>

      {/* Certificates List */}
      {certificates.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={{ fontSize: 36, marginBottom: 10 }}>🎓</Text>
          <Text style={styles.emptyTitle}>No Certificates Requested</Text>
          <Text style={styles.emptySubtitle}>
            Need a Bonafide Certificate for passport or scholarship, or a Transfer Certificate? Tap "+ Request Certificate" above.
          </Text>
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          {certificates.map((c) => {
            const isApproved = c.status === 'APPROVED';
            const isPending = c.status === 'PENDING';
            const isRejected = c.status === 'REJECTED';

            return (
              <View key={c.id} style={styles.certCard}>
                <View style={styles.certTop}>
                  <View>
                    <Text style={styles.certTypeTitle}>{c.certificate_name}</Text>
                    {c.certificate_number && (
                      <Text style={styles.certNumber}>Doc #{c.certificate_number}</Text>
                    )}
                  </View>

                  <View style={[
                    styles.statusPill,
                    { backgroundColor: isApproved ? '#ECFDF5' : isPending ? '#FEF3C7' : '#FFF1F2' }
                  ]}>
                    <Text style={[
                      styles.statusText,
                      { color: isApproved ? '#059669' : isPending ? '#D97706' : '#E11D48' }
                    ]}>
                      {isApproved ? '✓ Approved' : isPending ? '● Under Review' : '✕ Rejected'}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Purpose:</Text>
                  <Text style={styles.detailVal}>"{c.purpose_reason}"</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Delivery Method:</Text>
                  <Text style={styles.detailVal}>
                    {c.delivery_mode === 'ONLINE_APP' ? '📱 Digital Download in App' : '🏫 Collect Physical Stamped Copy'}
                  </Text>
                </View>

                {c.rejection_reason && (
                  <View style={styles.rejectBox}>
                    <Text style={styles.rejectTitle}>Admin Notice:</Text>
                    <Text style={styles.rejectText}>{c.rejection_reason}</Text>
                  </View>
                )}

                {isApproved && (
                  <View style={styles.actionRow}>
                    <View style={styles.sealedTag}>
                      <Text style={styles.sealedText}>🛡️ Cryptographically Sealed & Stamped</Text>
                    </View>

                    <TouchableOpacity
                      style={styles.downloadBtn}
                      onPress={() => handleOpenCertificate(c.certificate_number)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.downloadBtnText}>📄 View & Print Certificate →</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Request Modal */}
      <Modal visible={showApplyModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Request Official School Certificate</Text>
            <Text style={styles.modalSub}>
              For {activeChild?.name} (Class {activeChild?.grade}-{activeChild?.section})
            </Text>

            {/* Certificate Type Picker */}
            <Text style={styles.fieldLabel}>Certificate Type</Text>
            <View style={styles.typeGrid}>
              {[
                { id: 'BONAFIDE', label: 'Bonafide Certificate' },
                { id: 'TRANSFER_CERTIFICATE', label: 'Transfer Certificate (TC)' },
                { id: 'CHARACTER', label: 'Character Certificate' },
                { id: 'FEE_CLEARANCE', label: 'Fee Clearance (NOC)' },
              ].map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.typeOption, certType === t.id && styles.typeOptionActive]}
                  onPress={() => setCertType(t.id)}
                >
                  <Text style={[styles.typeOptionText, certType === t.id && styles.typeOptionTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Delivery Preference */}
            <Text style={styles.fieldLabel}>Delivery Preference</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
              <TouchableOpacity
                style={[styles.deliveryBtn, deliveryMode === 'ONLINE_APP' && styles.deliveryBtnActive]}
                onPress={() => setDeliveryMode('ONLINE_APP')}
              >
                <Text style={[styles.deliveryText, deliveryMode === 'ONLINE_APP' && styles.deliveryTextActive]}>
                  📱 App Digital Copy
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.deliveryBtn, deliveryMode === 'OFFLINE_COUNTER' && styles.deliveryBtnActive]}
                onPress={() => setDeliveryMode('OFFLINE_COUNTER')}
              >
                <Text style={[styles.deliveryText, deliveryMode === 'OFFLINE_COUNTER' && styles.deliveryTextActive]}>
                  🏫 School Counter Pickup
                </Text>
              </TouchableOpacity>
            </View>

            {/* Purpose */}
            <Text style={styles.fieldLabel}>Purpose / Reason *</Text>
            <TextInput
              style={styles.modalInput}
              value={reason}
              onChangeText={setReason}
              placeholder="e.g. Required for Passport renewal / Olympiad registration..."
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowApplyModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSubmit}
                onPress={handleApply}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitText}>Submit Request →</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bgMain },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
    gap: 12,
  },
  title: { fontSize: 18, fontWeight: '800', color: theme.colors.textPrimary },
  subtitle: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 },
  applyBtn: { backgroundColor: theme.colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  applyBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: theme.radius.lg, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 4 },
  emptySubtitle: { fontSize: 12, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 18 },
  certCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  certTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  certTypeTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary },
  certNumber: { fontSize: 12, fontWeight: '700', color: theme.colors.primary, marginTop: 2 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: '700' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  detailLabel: { fontSize: 12, color: theme.colors.textSecondary },
  detailVal: { fontSize: 12, fontWeight: '600', color: theme.colors.textPrimary, maxWidth: '65%' },
  rejectBox: { backgroundColor: '#FFF1F2', padding: 8, borderRadius: 6, marginTop: 6, borderLeftWidth: 3, borderLeftColor: theme.colors.rose },
  rejectTitle: { fontSize: 11, fontWeight: '700', color: theme.colors.rose },
  rejectText: { fontSize: 11, color: '#9F1239' },
  actionRow: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.borderSubtle },
  sealedTag: { alignSelf: 'flex-start', backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, marginBottom: 10 },
  sealedText: { fontSize: 10, fontWeight: '700', color: '#059669' },
  downloadBtn: { backgroundColor: theme.colors.primary, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  downloadBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 36 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.textPrimary },
  modalSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2, marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 6 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  typeOption: { width: '48%', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#F8FAFC' },
  typeOptionActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryLight },
  typeOptionText: { fontSize: 11, fontWeight: '600', color: theme.colors.textSecondary, textAlign: 'center' },
  typeOptionTextActive: { color: theme.colors.primary, fontWeight: '800' },
  deliveryBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', backgroundColor: '#F8FAFC' },
  deliveryBtnActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryLight },
  deliveryText: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },
  deliveryTextActive: { color: theme.colors.primary, fontWeight: '800' },
  modalInput: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, padding: 12, height: 75, textAlignVertical: 'top', fontSize: 13, backgroundColor: '#F8FAFC', marginBottom: 20 },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalCancel: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: theme.colors.textSecondary },
  modalSubmit: { flex: 2, backgroundColor: theme.colors.primary, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  modalSubmitText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
});
