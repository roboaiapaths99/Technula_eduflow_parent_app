import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert
} from 'react-native';
import { theme } from '../theme';
import { parentApi } from '../api';

const CATEGORIES = ['ALL', 'Appreciation', 'Academic', 'Discipline', 'Homework', 'General'];

function safeFormatDate(dateStr, options) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-IN', options);
  } catch {
    return null;
  }
}

export default function DiaryScreen(props) {
  const user = (props && props.user) || {};
  const activeChild = (props && props.activeChild) || null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [entries, setEntries] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [acknowledgingId, setAcknowledgingId] = useState(null);
  const [error, setError] = useState(null);

  const studentId = activeChild ? activeChild.student_id : null;

  const loadDiary = async () => {
    if (!studentId) {
      setLoading(false);
      setRefreshing(false);
      setEntries([]);
      return;
    }
    try {
      setError(null);
      const res = await parentApi.getStudentDiary(studentId);
      const list = Array.isArray(res) ? res : (Array.isArray(res?.entries) ? res.entries : []);
      setEntries(list);
    } catch (e) {
      console.warn('Failed to load diary entries:', e);
      setError(e?.message || 'Failed to load remarks');
      setEntries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDiary();
  }, [studentId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDiary();
  };

  const handleAcknowledge = async (entryId) => {
    if (!entryId) return;
    setAcknowledgingId(entryId);
    try {
      await parentApi.acknowledgeDiaryEntry(entryId);
      setEntries(prev => {
        const arr = Array.isArray(prev) ? prev : [];
        return arr.map(item =>
          item.id === entryId
            ? { ...item, acknowledged_by_parent: true, parent_acknowledged: true, acknowledged_at: new Date().toISOString() }
            : item
        );
      });
    } catch (e) {
      Alert.alert('Notice', e?.message || 'Failed to acknowledge remark note.');
    } finally {
      setAcknowledgingId(null);
    }
  };

  const getCategoryColor = (cat) => {
    const c = String(cat || '').toLowerCase();
    if (c.includes('appreciation')) return { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0', icon: '🌟' };
    if (c.includes('academic')) return { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE', icon: '📚' };
    if (c.includes('discipline')) return { bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA', icon: '⚠️' };
    if (c.includes('homework')) return { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A', icon: '📝' };
    return { bg: '#F8FAFC', text: '#475569', border: '#E2E8F0', icon: '💬' };
  };

  const safeEntries = Array.isArray(entries) ? entries : [];
  const filteredEntries = safeEntries.filter(e => {
    if (!e) return false;
    if (selectedCategory === 'ALL') return true;
    const cat = String(e.category || '').toLowerCase();
    return cat.includes(selectedCategory.toLowerCase());
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const childName = activeChild?.name || 'Student';
  const childMeta = activeChild
    ? `Grade ${activeChild.grade || '—'}-${activeChild.section || '—'} • Adm #${activeChild.admission_no || '—'}`
    : 'No student selected';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header Banner */}
      <View style={styles.header}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={styles.title}>Student Remarks Diary</Text>
          <Text style={styles.subtitle}>{childName} • {childMeta}</Text>
        </View>
        <View style={styles.totalBadge}>
          <Text style={styles.totalBadgeText}>{safeEntries.length} Remarks</Text>
        </View>
      </View>

      {/* Category Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryScroll}
      >
        {CATEGORIES.map(cat => {
          const isSelected = selectedCategory === cat;
          return (
            <TouchableOpacity
              key={cat}
              onPress={() => setSelectedCategory(cat)}
              style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
              activeOpacity={0.7}
            >
              <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Diary Entries List */}
      {filteredEntries.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={{ fontSize: 38, marginBottom: 10 }}>📖</Text>
          <Text style={styles.emptyTitle}>No Remarks Found</Text>
          <Text style={styles.emptySubtitle}>
            {selectedCategory === 'ALL'
              ? "Your child's teachers haven't posted any remarks to the digital diary yet."
              : `No remarks found under the "${selectedCategory}" category.`}
          </Text>
        </View>
      ) : (
        <View style={styles.listGap}>
          {filteredEntries.map(entry => {
            if (!entry) return null;
            const styleInfo = getCategoryColor(entry.category);
            const isAck = Boolean(entry.acknowledged_by_parent || entry.parent_acknowledged);
            const ackDate = safeFormatDate(entry.acknowledged_at, { day: 'numeric', month: 'short' });
            const createdDate = safeFormatDate(entry.created_at || entry.entry_date, { weekday: 'short', day: 'numeric', month: 'short' }) || 'Recent';

            return (
              <View key={String(entry.id || Math.random())} style={[styles.entryCard, { borderColor: styleInfo.border }]}>
                {/* Entry Top Row */}
                <View style={styles.entryTopRow}>
                  <View style={[styles.categoryBadge, { backgroundColor: styleInfo.bg, borderColor: styleInfo.border }]}>
                    <Text style={{ fontSize: 11 }}>{styleInfo.icon}</Text>
                    <Text style={[styles.categoryBadgeText, { color: styleInfo.text }]}>
                      {entry.category || 'General'}
                    </Text>
                  </View>

                  <Text style={styles.entryDate}>{createdDate}</Text>
                </View>

                {/* Remarks Content */}
                <Text style={styles.remarksText}>
                  {entry.remark || entry.remarks || 'Remark recorded.'}
                </Text>

                {/* Teacher Details */}
                <View style={styles.authorRow}>
                  <Text style={styles.authorText}>
                    Logged by <Text style={{ fontWeight: '700', color: theme.colors.textPrimary }}>{entry.teacher_name || 'Class Teacher'}</Text>
                  </Text>
                </View>

                {/* Parent Acknowledgment Action */}
                <View style={styles.ackSection}>
                  {isAck ? (
                    <View style={styles.ackStatusRow}>
                      <Text style={styles.ackStatusIcon}>✓</Text>
                      <Text style={styles.ackStatusText}>
                        Acknowledged by Guardian {ackDate ? `on ${ackDate}` : ''}
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.ackButton}
                      onPress={() => handleAcknowledge(entry.id)}
                      disabled={acknowledgingId === entry.id}
                      activeOpacity={0.8}
                    >
                      {acknowledgingId === entry.id ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.ackButtonText}>✓ Confirm & Acknowledge Note</Text>
                      )}
                    </TouchableOpacity>
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
    padding: 32,
    backgroundColor: theme.colors.bgMain,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  totalBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  totalBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  categoryScroll: {
    paddingBottom: 14,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  listGap: {
    marginTop: 4,
  },
  entryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 14,
    shadowColor: '#0A2540',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  entryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginLeft: 4,
  },
  entryDate: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  remarksText: {
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  authorRow: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
    marginBottom: 12,
  },
  authorText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  ackSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  ackStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ackStatusIcon: {
    color: '#059669',
    fontWeight: '800',
    fontSize: 14,
    marginRight: 6,
  },
  ackStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
  },
  ackButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  ackButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 36,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0A2540',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
