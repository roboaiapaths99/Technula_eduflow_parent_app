import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput, Alert
} from 'react-native';
import { theme } from '../theme';
import { parentApi, formatUserError } from '../api';

export default function GatePassScreen({ user, activeChild }) {
  const [passes, setPasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('ALL'); // ALL, PENDING, APPROVED, COMPLETED
  const [selectedPass, setSelectedPass] = useState(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [reasonCategory, setReasonCategory] = useState('Medical');
  const [reasonDetails, setReasonDetails] = useState('');
  const [pickupPerson, setPickupPerson] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [expectedReturnTime, setExpectedReturnTime] = useState('');

  const studentId = activeChild?.student_id;

  const loadPasses = async () => {
    if (!studentId) {
      setLoading(false);
      return;
    }
    try {
      const res = await parentApi.getStudentGatePasses(studentId);
      setPasses(Array.isArray(res) ? res : (res?.passes || []));
    } catch (e) {
      console.warn('Failed to load gate passes:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadPasses();
  }, [studentId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadPasses();
  };

  const handleCreateRequest = async () => {
    if (!reasonDetails.trim() || reasonDetails.trim().length < 3) {
      Alert.alert('Details Required', 'Please provide a clear reason for the gate pass (minimum 3 characters).');
      return;
    }
    const cleanPickup = pickupPerson.trim();
    if (!cleanPickup || cleanPickup.length < 2) {
      Alert.alert('Details Required', 'Please specify the full name of the authorized pickup person.');
      return;
    }
    if (!/^[a-zA-Z\s.'-]+$/.test(cleanPickup) || ['test', 'testing', 'dummy', 'fake', 'na', 'n/a', 'null', 'nobody'].includes(cleanPickup.toLowerCase())) {
      Alert.alert('Invalid Name', 'Please provide a genuine, real name for the pickup person.');
      return;
    }
    try {
      setSubmitting(true);
      const payload = {
        student_id: studentId,
        parent_user_id: user.id,
        reason_category: reasonCategory,
        reason: reasonDetails,
        authorized_pickup_person: pickupPerson,
        departure_time: departureTime || new Date(Date.now() + 30 * 60000).toISOString(),
        expected_return_time: expectedReturnTime || null,
        school_id: activeChild.school_id || user.school_id
      };
      await parentApi.requestGatePass(payload);
      Alert.alert('Request Submitted', 'Gate pass request sent to school administration for approval.');
      setShowRequestModal(false);
      setReasonDetails('');
      setPickupPerson('');
      setDepartureTime('');
      setExpectedReturnTime('');
      loadPasses();
    } catch (e) {
      Alert.alert('Submission Notice', formatUserError(e, 'Failed to submit gate pass request'));
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status) => {
    switch ((status || '').toUpperCase()) {
      case 'APPROVED': return { bg: '#DCFCE7', text: '#15803D', border: '#86EFAC' };
      case 'PENDING': return { bg: '#FEF3C7', text: '#B45309', border: '#FCD34D' };
      case 'OUT': return { bg: '#E0F2FE', text: '#0369A1', border: '#7DD3FC' };
      case 'RETURNED': return { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' };
      case 'REJECTED': return { bg: '#FEE2E2', text: '#B91C1C', border: '#FCA5A5' };
      default: return { bg: '#F1F5F9', text: '#64748B', border: '#E2E8F0' };
    }
  };

  const filteredPasses = passes.filter(p => {
    if (filter === 'ALL') return true;
    if (filter === 'PENDING') return (p.status || '').toUpperCase() === 'PENDING';
    if (filter === 'APPROVED') return (p.status || '').toUpperCase() === 'APPROVED';
    if (filter === 'COMPLETED') return ['OUT', 'RETURNED', 'REJECTED'].includes((p.status || '').toUpperCase());
    return true;
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Banner & Request Action */}
      <View style={styles.headerBanner}>
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>Digital Gate Passes</Text>
          <Text style={styles.bannerSub}>
            Request official leave/early exit pass for {activeChild?.name || 'child'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.requestBtn}
          onPress={() => setShowRequestModal(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.requestBtnText}>+ Request Pass</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {['ALL', 'PENDING', 'APPROVED', 'COMPLETED'].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Passes List */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {filteredPasses.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 36, marginBottom: 10 }}>🎫</Text>
            <Text style={styles.emptyTitle}>No Gate Passes Found</Text>
            <Text style={styles.emptySub}>
              {filter === 'ALL'
                ? 'No early exit or departure requests have been submitted yet.'
                : `No passes found under the ${filter.toLowerCase()} filter.`}
            </Text>
            <TouchableOpacity
              style={styles.emptyActionBtn}
              onPress={() => setShowRequestModal(true)}
            >
              <Text style={styles.emptyActionBtnText}>Create Gate Pass</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredPasses.map((pass) => {
            const colors = getStatusColor(pass.status);
            return (
              <TouchableOpacity
                key={pass.id || pass.pass_code}
                style={styles.passCard}
                onPress={() => setSelectedPass(pass)}
                activeOpacity={0.85}
              >
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.passCode}>{pass.pass_code || `GP-#${pass.id}`}</Text>
                    <Text style={styles.passCategory}>{pass.reason_category || 'General Exit'}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                    <Text style={[styles.statusText, { color: colors.text }]}>
                      {(pass.status || 'PENDING').toUpperCase()}
                    </Text>
                  </View>
                </View>

                <Text style={styles.passReason} numberOfLines={2}>
                  {pass.reason || 'No description provided'}
                </Text>

                <View style={styles.cardFooter}>
                  <View style={styles.footerItem}>
                    <Text style={styles.footerLabel}>Departure</Text>
                    <Text style={styles.footerVal}>
                      {pass.departure_time ? new Date(pass.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'ASAP'}
                    </Text>
                  </View>
                  <View style={styles.footerItem}>
                    <Text style={styles.footerLabel}>Pickup Person</Text>
                    <Text style={styles.footerVal}>{pass.authorized_pickup_person || 'Parent'}</Text>
                  </View>
                  <View style={styles.footerItem}>
                    <Text style={styles.footerLabel}>Action</Text>
                    <Text style={[styles.footerVal, { color: theme.colors.primary, fontWeight: '700' }]}>
                      View QR ›
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* View Digital QR Pass Modal */}
      <Modal visible={!!selectedPass} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.passModalBox}>
            <View style={styles.passModalHeader}>
              <Text style={styles.passModalTitle}>Official School Gate Pass</Text>
              <TouchableOpacity onPress={() => setSelectedPass(null)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedPass && (
              <ScrollView contentContainerStyle={styles.passModalContent}>
                {/* QR Visual Card */}
                <View style={styles.qrContainer}>
                  <Text style={styles.qrHeader}>SCAN AT CAMPUS GATE</Text>
                  <View style={styles.qrPlaceholderBox}>
                    <Text style={{ fontSize: 48 }}>📱</Text>
                    <Text style={styles.qrTokenText}>{selectedPass.qr_code || selectedPass.pass_code}</Text>
                    <Text style={styles.qrHint}>Present to security scanner upon departure</Text>
                  </View>
                  <View style={[styles.modalStatusBadge, { backgroundColor: getStatusColor(selectedPass.status).bg }]}>
                    <Text style={[styles.modalStatusText, { color: getStatusColor(selectedPass.status).text }]}>
                      STATUS: {(selectedPass.status || 'PENDING').toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Details Breakdown */}
                <View style={styles.detailGrid}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Student Name:</Text>
                    <Text style={styles.detailValue}>{activeChild?.name || 'Student'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Class & Roll:</Text>
                    <Text style={styles.detailValue}>Grade {activeChild?.grade}-{activeChild?.section} (Roll: {activeChild?.roll_number || '-'})</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Authorized Escort:</Text>
                    <Text style={styles.detailValue}>{selectedPass.authorized_pickup_person || 'Parent'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Departure Scheduled:</Text>
                    <Text style={styles.detailValue}>
                      {selectedPass.departure_time ? new Date(selectedPass.departure_time).toLocaleString() : 'Immediate'}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Reason:</Text>
                    <Text style={styles.detailValue}>{selectedPass.reason || selectedPass.reason_category}</Text>
                  </View>
                  {selectedPass.admin_review_notes && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Admin Notes:</Text>
                      <Text style={[styles.detailValue, { color: '#B45309' }]}>{selectedPass.admin_review_notes}</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.securityNotice}>
                  🔒 Verified cryptographic SchoolOS security token. Valid strictly for the authorized student and guardian.
                </Text>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Request Early Exit Pass Modal */}
      <Modal visible={showRequestModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.passModalBox}>
            <View style={styles.passModalHeader}>
              <Text style={styles.passModalTitle}>Request Gate Pass</Text>
              <TouchableOpacity onPress={() => setShowRequestModal(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.formScroll}>
              <Text style={styles.inputLabel}>Reason Category</Text>
              <View style={styles.categoryRow}>
                {['Medical', 'Family Emergency', 'Official Appointment', 'Personal'].map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.catBtn, reasonCategory === cat && styles.catBtnActive]}
                    onPress={() => setReasonCategory(cat)}
                  >
                    <Text style={[styles.catBtnText, reasonCategory === cat && styles.catBtnTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Detailed Reason / Explanation *</Text>
              <TextInput
                style={styles.textArea}
                multiline
                numberOfLines={3}
                placeholder="Doctor's appointment, urgent family event..."
                value={reasonDetails}
                onChangeText={setReasonDetails}
              />

              <Text style={styles.inputLabel}>Authorized Pickup Guardian Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Rajesh Kumar (Father) or Priya Sharma (Mother)"
                value={pickupPerson}
                onChangeText={setPickupPerson}
              />

              <Text style={styles.inputLabel}>Departure Time (Optional if now)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 12:30 PM"
                value={departureTime}
                onChangeText={setDepartureTime}
              />

              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={handleCreateRequest}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitBtnText}>Submit Pass for Approval</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bgMain },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerBanner: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary },
  bannerSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  requestBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: theme.radius.md,
  },
  requestBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    backgroundColor: '#F1F5F9',
  },
  filterChipActive: { backgroundColor: theme.colors.primary },
  filterChipText: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },
  filterChipTextActive: { color: '#FFFFFF' },
  scrollContent: { padding: 16, gap: 12 },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    padding: 32,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary },
  emptySub: { fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center', marginVertical: 8 },
  emptyActionBtn: {
    marginTop: 8,
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
  },
  emptyActionBtnText: { color: theme.colors.primary, fontWeight: '700', fontSize: 13 },
  passCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  passCode: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary },
  passCategory: { fontSize: 12, color: theme.colors.textMuted, marginTop: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radius.sm, borderWidth: 1 },
  statusText: { fontSize: 11, fontWeight: '800' },
  passReason: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 10, lineHeight: 18 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
  },
  footerItem: { flex: 1 },
  footerLabel: { fontSize: 11, color: theme.colors.textMuted },
  footerVal: { fontSize: 12, fontWeight: '600', color: theme.colors.textPrimary, marginTop: 2 },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 37, 64, 0.65)',
    justifyContent: 'flex-end',
  },
  passModalBox: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  passModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  passModalTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.textPrimary },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 18, color: theme.colors.textSecondary, fontWeight: '700' },
  passModalContent: { padding: 20, alignItems: 'center' },
  qrContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: theme.radius.lg,
    padding: 20,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  qrHeader: { fontSize: 12, fontWeight: '800', letterSpacing: 1, color: theme.colors.textSecondary },
  qrPlaceholderBox: {
    marginVertical: 14,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    width: '90%',
  },
  qrTokenText: { fontSize: 16, fontWeight: '800', color: theme.colors.primary, marginVertical: 6 },
  qrHint: { fontSize: 11, color: theme.colors.textMuted, textAlign: 'center' },
  modalStatusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radius.full },
  modalStatusText: { fontSize: 12, fontWeight: '800' },
  detailGrid: { width: '100%', marginTop: 16, gap: 10 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailLabel: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: '500' },
  detailValue: { fontSize: 13, color: theme.colors.textPrimary, fontWeight: '700' },
  securityNotice: {
    fontSize: 11,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 16,
  },

  // Form styles
  formScroll: { padding: 20 },
  inputLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary, marginTop: 12, marginBottom: 6 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  catBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: theme.radius.md,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  catBtnActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
  catBtnText: { fontSize: 12, color: theme.colors.textSecondary, fontWeight: '600' },
  catBtnTextActive: { color: theme.colors.primary, fontWeight: '700' },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  textArea: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.colors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    marginTop: 20,
    ...theme.shadows.card,
  },
  submitBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
