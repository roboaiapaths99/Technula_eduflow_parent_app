import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator, RefreshControl
} from 'react-native';
import { theme } from '../theme';
import { parentApi } from '../api';

export default function TicketsScreen({ user = {}, activeChild = null } = {}) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [tickets, setTickets] = useState([]);

  const [showModal, setShowModal] = useState(false);
  const [category, setCategory] = useState('Academic');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');

  const schoolId = activeChild?.school_id || user?.school_id;
  const parentUserId = user?.id;

  const loadData = async () => {
    if (!schoolId || !parentUserId) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const res = await parentApi.getTickets(schoolId, parentUserId);
      setTickets(res || []);
    } catch (e) {
      setError(e.message || 'Failed to load support queries');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [schoolId, parentUserId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleCreate = async () => {
    if (!subject.trim() || !description.trim()) {
      Alert.alert('Required', 'Please enter a subject and detailed description.');
      return;
    }

    setSubmitting(true);
    try {
      await parentApi.createTicket({
        school_id: schoolId,
        parent_user_id: parentUserId,
        student_id: activeChild?.student_id,
        category,
        subject: subject.trim(),
        description: description.trim(),
      });

      setSubject('');
      setDescription('');
      setShowModal(false);
      Alert.alert('Query Submitted', 'Your ticket has been logged with the school administration. You will receive updates here.');
      loadData();
    } catch (err) {
      Alert.alert('Submission Failed', err.message || 'Could not submit ticket');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 36, marginBottom: 12 }}>💬</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadData}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Parent Support & Queries</Text>
          <Text style={styles.subtitle}>Direct Communication with School Administration</Text>
        </View>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => setShowModal(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.createBtnText}>+ Raise Query</Text>
        </TouchableOpacity>
      </View>

      {/* Tickets List */}
      {tickets.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={{ fontSize: 36, marginBottom: 10 }}>🎫</Text>
          <Text style={styles.emptyTitle}>No Queries Raised</Text>
          <Text style={styles.emptySubtitle}>Have a question regarding fees, academics, or transportation? Tap "+ Raise Query" above.</Text>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {tickets.map((t) => {
            const isResolved = (t.status || '').toUpperCase() === 'RESOLVED';
            const dateStr = t.created_at ? new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : (t.date || 'Recent');

            return (
              <View key={t.id} style={styles.ticketCard}>
                <View style={styles.cardTop}>
                  <View style={styles.pillRow}>
                    <View style={styles.categoryPill}>
                      <Text style={styles.categoryText}>{t.category || 'General'}</Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: isResolved ? theme.colors.emeraldLight : theme.colors.amberLight }]}>
                      <Text style={[styles.statusText, { color: isResolved ? theme.colors.emerald : theme.colors.amber }]}>
                        {t.status || 'OPEN'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.dateText}>{dateStr}</Text>
                </View>

                <Text style={styles.subjectText}>{t.subject}</Text>
                <Text style={styles.descText}>{t.description}</Text>

                {(t.resolution_notes || t.resolution) && (
                  <View style={styles.resolutionBox}>
                    <Text style={styles.resolutionTitle}>School Response:</Text>
                    <Text style={styles.resolutionText}>{t.resolution_notes || t.resolution}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Raise Query Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Raise Support Query</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Category Selector */}
            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.categoryRow}>
              {['Academic', 'Fees', 'Transport', 'General'].map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryOption, category === cat && styles.categoryOptionActive]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.categoryOptionText, category === cat && styles.categoryOptionTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Subject */}
            <Text style={styles.fieldLabel}>Subject / Topic</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Fee receipt acknowledgement..."
              placeholderTextColor={theme.colors.textMuted}
              value={subject}
              onChangeText={setSubject}
            />

            {/* Description */}
            <Text style={styles.fieldLabel}>Detailed Query</Text>
            <TextInput
              style={[styles.modalInput, { height: 100, textAlignVertical: 'top' }]}
              placeholder="Provide specific details so the school can assist promptly..."
              placeholderTextColor={theme.colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
            />

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.submitTicketBtn}
                onPress={handleCreate}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitTicketBtnText}>Submit Query →</Text>
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
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgMain,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 14,
    color: theme.colors.rose,
    textAlign: 'center',
    marginBottom: 12,
  },
  retryBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  createBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.lg,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  ticketCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 6,
  },
  categoryPill: {
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  dateText: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  subjectText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 6,
  },
  descText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  resolutionBox: {
    backgroundColor: '#F0FDF4',
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.emerald,
    padding: 10,
    borderRadius: 6,
    marginTop: 10,
  },
  resolutionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.emerald,
    marginBottom: 2,
  },
  resolutionText: {
    fontSize: 12,
    color: '#15803D',
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  closeBtn: {
    fontSize: 18,
    color: theme.colors.textMuted,
    padding: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginBottom: 6,
    marginTop: 10,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  categoryOption: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  categoryOptionActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  categoryOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  categoryOptionTextActive: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.colors.textPrimary,
    backgroundColor: '#F8FAFC',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  submitTicketBtn: {
    flex: 2,
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitTicketBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
