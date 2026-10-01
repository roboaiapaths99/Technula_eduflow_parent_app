import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, TextInput, Modal, Alert, Platform
} from 'react-native';
import { theme } from '../theme';
import { parentApi, getApiBase, formatUserError, isPlanRestrictedError } from '../api';
import FeatureUnavailableCard from '../components/FeatureUnavailableCard';

export default function LeaveScreen({ user = {}, activeChild = null } = {}) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    from_date: '',
    to_date: '',
    leave_type: 'SICK',
    reason: '',
    attachment_url: '',
  });
  const [proofName, setProofName] = useState('');

  const studentId = activeChild?.student_id;
  const schoolId = activeChild?.school_id;

  const loadData = async () => {
    if (!studentId) { setLoading(false); return; }
    try {
      setError(null);
      const res = await parentApi.getStudentLeaves(studentId);
      setLeaves(res || []);
    } catch (e) {
      setError(formatUserError(e, 'Failed to load leave history.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, [studentId]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const handlePickProof = async () => {
    try {
      // 1. Web file picker
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*,application/pdf';
        input.onchange = async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            const formData = new FormData();
            formData.append('file', file);
            const uploadRes = await fetch(`${getApiBase()}/upload/file`, {
              method: 'POST',
              body: formData,
            }).then(r => r.json());
            if (uploadRes.url) {
              setForm(prev => ({ ...prev, attachment_url: uploadRes.url }));
              setProofName(file.name);
            }
          } catch (err) {
            Alert.alert('Upload Failed', formatUserError(err, 'Could not upload attachment'));
          }
        };
        input.click();
        return;
      }

      // 2. Native Expo ImagePicker (safe dynamic check)
      let ImagePicker = null;
      try {
        ImagePicker = require('expo-image-picker');
      } catch (e) {
        ImagePicker = null;
      }

      if (ImagePicker && ImagePicker.launchImageLibraryAsync) {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 0.7,
        });
        if (!result.canceled && result.assets?.[0]) {
          const asset = result.assets[0];
          const uploadRes = await parentApi.uploadFile(
            asset.uri,
            asset.fileName || 'proof.jpg',
            asset.mimeType || 'image/jpeg'
          );
          setForm(prev => ({ ...prev, attachment_url: uploadRes.url }));
          setProofName(asset.fileName || 'proof.jpg');
        }
      } else {
        Alert.alert(
          'Document Attachment',
          'Document attachment is optional. You may also provide a written reason below or share medical certificates directly with the school office.'
        );
      }
    } catch (e) {
      Alert.alert('Attachment Notice', formatUserError(e, 'Could not attach proof document'));
    }
  };

  const handleSubmit = async () => {
    if (!form.from_date || !form.to_date || !form.reason) {
      Alert.alert('Details Required', 'Please fill in from date, to date, and reason for leave.');
      return;
    }
    setSubmitting(true);
    try {
      await parentApi.applyLeave({
        student_id: studentId,
        school_id: schoolId,
        ...form,
      });
      Alert.alert('Application Submitted', 'Your leave request has been submitted to the school administration.');
      setShowModal(false);
      setForm({ from_date: '', to_date: '', leave_type: 'SICK', reason: '', attachment_url: '' });
      setProofName('');
      loadData();
    } catch (e) {
      Alert.alert('Submission Notice', formatUserError(e, 'Failed to submit leave application'));
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status) => {
    switch ((status || '').toUpperCase()) {
      case 'APPROVED': return theme.colors.emerald;
      case 'REJECTED': return theme.colors.rose;
      default: return theme.colors.amber;
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;
  }

  if (error) {
    if (isPlanRestrictedError(error)) {
      return (
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <FeatureUnavailableCard
            icon="📝"
            title="Leave Management Not Activated"
            subtitle="The digital leave application module has not been activated by your school administration yet. You will be able to apply and track leaves here once enabled."
            onRetry={loadData}
          />
        </ScrollView>
      );
    }
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>📝</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadData}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Leave Applications</Text>
          <Text style={styles.subtitle}>{activeChild?.name} • Grade {activeChild?.grade}-{activeChild?.section}</Text>
        </View>
        <TouchableOpacity style={styles.applyBtn} onPress={() => setShowModal(true)} activeOpacity={0.8}>
          <Text style={styles.applyBtnText}>+ Apply Leave</Text>
        </TouchableOpacity>
      </View>

      {leaves.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>✅</Text>
          <Text style={styles.emptyText}>No leave applications this session.</Text>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {leaves.map((l) => {
            const sColor = getStatusColor(l.status);
            return (
              <View key={l.id} style={styles.leaveCard}>
                <View style={styles.leaveTop}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <View style={[styles.pill, { backgroundColor: theme.colors.primaryLight }]}>
                      <Text style={[styles.pillText, { color: theme.colors.primary }]}>{l.leave_type}</Text>
                    </View>
                    <View style={[styles.pill, { backgroundColor: sColor + '1A' }]}>
                      <Text style={[styles.pillText, { color: sColor }]}>{l.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.dateRange}>
                    {l.from_date} → {l.to_date}
                  </Text>
                </View>
                <Text style={styles.reasonText}>{l.reason}</Text>
                {l.remarks && (
                  <View style={styles.remarksBox}>
                    <Text style={styles.remarksLabel}>School Response:</Text>
                    <Text style={styles.remarksText}>{l.remarks}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Apply Leave Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Apply for Student Leave</Text>

            <Text style={styles.label}>From Date *</Text>
            <TextInput
              style={styles.input}
              value={form.from_date}
              onChangeText={(v) => setForm({ ...form, from_date: v })}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.colors.textMuted}
            />

            <Text style={styles.label}>To Date *</Text>
            <TextInput
              style={styles.input}
              value={form.to_date}
              onChangeText={(v) => setForm({ ...form, to_date: v })}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.colors.textMuted}
            />

            <Text style={styles.label}>Leave Type</Text>
            <View style={styles.typeRow}>
              {['SICK', 'PLANNED', 'FAMILY', 'EMERGENCY'].map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeBtn, form.leave_type === t && styles.typeBtnActive]}
                  onPress={() => setForm({ ...form, leave_type: t })}
                >
                  <Text style={[styles.typeBtnText, form.leave_type === t && styles.typeBtnTextActive]}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Reason *</Text>
            <TextInput
              style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
              value={form.reason}
              onChangeText={(v) => setForm({ ...form, reason: v })}
              placeholder="Describe the reason for leave..."
              placeholderTextColor={theme.colors.textMuted}
              multiline
            />

            <Text style={styles.label}>Proof Document (Optional)</Text>
            <TouchableOpacity style={styles.uploadBtn} onPress={handlePickProof}>
              <Text style={styles.uploadBtnText}>
                {proofName ? `📎 ${proofName}` : '📷 Attach Photo / Document'}
              </Text>
            </TouchableOpacity>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                <Text style={styles.submitBtnText}>{submitting ? 'Submitting...' : 'Submit Leave'}</Text>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorText: { fontSize: 14, color: theme.colors.rose, textAlign: 'center', marginBottom: 16 },
  emptyText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center' },
  retryBtn: { backgroundColor: theme.colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: theme.radius.md },
  retryText: { color: '#fff', fontWeight: '700' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 },
  title: { fontSize: 20, fontWeight: '800', color: theme.colors.textPrimary },
  subtitle: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  applyBtn: { backgroundColor: theme.colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radius.md },
  applyBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  emptyCard: {
    backgroundColor: '#FFFFFF', borderRadius: theme.radius.lg, padding: 40,
    alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border, ...theme.shadows.card,
  },
  leaveCard: {
    backgroundColor: '#FFFFFF', borderRadius: theme.radius.lg, padding: 16,
    borderWidth: 1, borderColor: theme.colors.border, ...theme.shadows.card,
  },
  leaveTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  pillText: { fontSize: 11, fontWeight: '700' },
  dateRange: { fontSize: 12, color: theme.colors.textMuted, fontWeight: '600' },
  reasonText: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 19 },
  remarksBox: { backgroundColor: '#F0FDF4', borderLeftWidth: 3, borderLeftColor: theme.colors.emerald, padding: 10, borderRadius: 6, marginTop: 10 },
  remarksLabel: { fontSize: 11, fontWeight: '700', color: '#15803D', marginBottom: 2 },
  remarksText: { fontSize: 12, color: '#166534', lineHeight: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#fff', borderRadius: theme.radius.lg, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 12,
  },
  typeRow: { flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap' },
  typeBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: theme.colors.border },
  typeBtnActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
  typeBtnText: { fontSize: 11, fontWeight: '600', color: theme.colors.textSecondary },
  typeBtnTextActive: { color: theme.colors.primary, fontWeight: '700' },
  uploadBtn: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, padding: 12, marginBottom: 14, borderStyle: 'dashed' },
  uploadBtnText: { fontSize: 13, color: theme.colors.primary, fontWeight: '600', textAlign: 'center' },
  modalBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: theme.colors.textSecondary },
  submitBtn: { backgroundColor: theme.colors.primary, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8 },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
