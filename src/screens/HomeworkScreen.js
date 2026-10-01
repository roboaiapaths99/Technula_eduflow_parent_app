import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, Linking, Alert
} from 'react-native';
import { theme } from '../theme';
import { parentApi, getApiBase, formatUserError, isPlanRestrictedError } from '../api';
import FeatureUnavailableCard from '../components/FeatureUnavailableCard';

export default function HomeworkScreen({ user = {}, activeChild = null } = {}) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [homework, setHomework] = useState([]);

  const studentId = activeChild?.student_id;

  const loadData = async () => {
    if (!studentId) { setLoading(false); return; }
    try {
      setError(null);
      const res = await parentApi.getStudentHomework(studentId);
      setHomework(res || []);
    } catch (e) {
      setError(formatUserError(e, 'No homework assignments currently recorded.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, [studentId]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const getPriorityColor = (priority) => {
    switch ((priority || '').toLowerCase()) {
      case 'high': return theme.colors.rose;
      case 'medium': return theme.colors.amber;
      default: return theme.colors.emerald;
    }
  };

  const isOverdue = (dueDate) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
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
            icon="📚"
            title="Homework Module Not Activated"
            subtitle="The digital homework and assignment diary has not been activated by your school administration yet. Assignments will appear here once enabled."
            onRetry={loadData}
          />
        </ScrollView>
      );
    }
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>📚</Text>
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
      <View style={styles.header}>
        <Text style={styles.title}>Homework Diary</Text>
        <Text style={styles.subtitle}>
          {activeChild?.name} • Grade {activeChild?.grade}-{activeChild?.section}
        </Text>
      </View>

      {homework.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>🎉</Text>
          <Text style={styles.emptyText}>No pending homework assignments!</Text>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {homework.map((hw) => {
            const overdue = isOverdue(hw.due_date);
            const pColor = getPriorityColor(hw.priority);
            return (
              <View key={hw.id} style={[styles.hwCard, overdue && styles.overdueCard]}>
                <View style={styles.hwTop}>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                    <View style={[styles.pill, { backgroundColor: theme.colors.primaryLight }]}>
                      <Text style={[styles.pillText, { color: theme.colors.primary }]}>
                        {hw.subject_name || 'Subject'}
                      </Text>
                    </View>
                    <View style={[styles.pill, { backgroundColor: pColor + '1A' }]}>
                      <Text style={[styles.pillText, { color: pColor }]}>
                        {hw.priority || 'Normal'}
                      </Text>
                    </View>
                    {overdue && (
                      <View style={[styles.pill, { backgroundColor: theme.colors.roseLight }]}>
                        <Text style={[styles.pillText, { color: theme.colors.rose }]}>Overdue</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.dateText}>
                    Due: {hw.due_date ? new Date(hw.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'N/A'}
                  </Text>
                </View>

                <Text style={styles.hwTitle}>{hw.title}</Text>
                {hw.description ? (
                  <Text style={styles.hwDesc} numberOfLines={3}>{hw.description}</Text>
                ) : null}

                {/* Submission status & Grade Badge */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  {hw.submission_status && (
                    <View style={[styles.submissionPill, {
                      backgroundColor: hw.submission_status === 'Submitted' ? theme.colors.emeraldLight : (hw.submission_status === 'Overdue' ? theme.colors.roseLight : theme.colors.amberLight)
                    }]}>
                      <Text style={[styles.submissionText, {
                        color: hw.submission_status === 'Submitted' ? theme.colors.emerald : (hw.submission_status === 'Overdue' ? theme.colors.rose : theme.colors.amber)
                      }]}>
                        {hw.submission_status === 'Submitted' ? '✓ Submitted' : (hw.submission_status === 'Overdue' ? '⚠️ Overdue' : '⏳ Pending Submission')}
                      </Text>
                    </View>
                  )}
                  {hw.grade && (
                    <View style={[styles.submissionPill, { backgroundColor: '#EDE9FE' }]}>
                      <Text style={[styles.submissionText, { color: '#6D28D9' }]}>
                        ⭐ Grade: {hw.grade}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Teacher evaluation remarks */}
                {hw.remarks ? (
                  <View style={styles.remarksBox}>
                    <Text style={styles.remarksLabel}>Teacher Evaluation Feedback:</Text>
                    <Text style={styles.remarksText}>"{hw.remarks}"</Text>
                  </View>
                ) : null}

                {hw.attachment_url ? (
                  <TouchableOpacity
                    style={styles.attachmentBtn}
                    onPress={() => {
                      const fullUrl = hw.attachment_url.startsWith('http')
                        ? hw.attachment_url
                        : `${getApiBase()}${hw.attachment_url}`;
                      Linking.openURL(fullUrl).catch(() => Alert.alert('Cannot Open', 'Could not open attachment.'));
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.attachmentBtnText}>📎 View Worksheet / Assignment Document</Text>
                  </TouchableOpacity>
                ) : null}

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <Text style={styles.teacherName}>
                    Assigned by: {hw.teacher_name || 'Class Educator'}
                  </Text>
                  {hw.submitted_at && (
                    <Text style={{ fontSize: 11, color: theme.colors.textMuted }}>
                      Turned in {new Date(hw.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
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
  header: { marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', color: theme.colors.textPrimary },
  subtitle: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  emptyCard: {
    backgroundColor: '#FFFFFF', borderRadius: theme.radius.lg, padding: 40,
    alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border, ...theme.shadows.card,
  },
  hwCard: {
    backgroundColor: '#FFFFFF', borderRadius: theme.radius.lg, padding: 16,
    borderWidth: 1, borderColor: theme.colors.border, ...theme.shadows.card,
  },
  overdueCard: { borderLeftWidth: 4, borderLeftColor: theme.colors.rose },
  hwTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  pillText: { fontSize: 11, fontWeight: '700' },
  dateText: { fontSize: 12, color: theme.colors.textMuted, fontWeight: '600' },
  hwTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 4 },
  hwDesc: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 19, marginBottom: 8 },
  submissionPill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginBottom: 8 },
  submissionText: { fontSize: 12, fontWeight: '700' },
  attachmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  attachmentBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  teacherName: { fontSize: 11, color: theme.colors.textMuted, fontWeight: '600' },
  remarksBox: {
    backgroundColor: '#F8FAFC',
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
    padding: 10,
    borderRadius: 6,
    marginBottom: 10,
  },
  remarksLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  remarksText: {
    fontSize: 12,
    color: theme.colors.textPrimary,
    fontStyle: 'italic',
  },
});
