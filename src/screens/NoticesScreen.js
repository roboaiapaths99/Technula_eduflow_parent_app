import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, Linking
} from 'react-native';
import { theme } from '../theme';
import { parentApi } from '../api';

export default function NoticesScreen({ user = {}, activeChild = null } = {}) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [notices, setNotices] = useState([]);

  const schoolId = activeChild?.school_id || user?.school_id;

  const loadData = async () => {
    if (!schoolId) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const res = await parentApi.getAnnouncements(schoolId);
      setNotices(res || []);
    } catch (e) {
      setError(e.message || 'Failed to load school circulars');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [schoolId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
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
        <Text style={{ fontSize: 36, marginBottom: 12 }}>📢</Text>
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
      <View style={styles.header}>
        <Text style={styles.title}>Official School Circulars</Text>
        <Text style={styles.subtitle}>
          {activeChild?.school_name || user?.school_name || 'School'} • Administration
        </Text>
      </View>

      {notices.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={{ fontSize: 32, marginBottom: 8 }}>📭</Text>
          <Text style={styles.emptyText}>No circulars published at this time.</Text>
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          {notices.map((n) => {
            const isPinned = n.is_pinned || n.pinned;
            const dateStr = n.created_at ? new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : (n.date || 'Recent');
            return (
              <View
                key={n.id}
                style={[styles.noticeCard, isPinned && styles.pinnedBorder]}
              >
                <View style={styles.topRow}>
                  <View style={[styles.tagPill, isPinned && styles.pinnedPill]}>
                    <Text style={[styles.tagText, isPinned && styles.pinnedTagText]}>
                      {isPinned ? '📌 PINNED NOTICE' : (n.target_role || 'General')}
                    </Text>
                  </View>
                  <Text style={styles.dateText}>{dateStr}</Text>
                </View>

                <Text style={styles.noticeTitle}>{n.title}</Text>
                <Text style={styles.noticeContent}>{n.content}</Text>

                <View style={styles.noticeFooterRow}>
                  <TouchableOpacity
                    style={styles.noticeWaBtn}
                    onPress={() => {
                      const msg = encodeURIComponent(`Regarding School Notice: *${n.title}*\n"${n.content}"\n(Student: ${activeChild?.name || 'Child'}, Grade ${activeChild?.grade || ''})`);
                      const phone = activeChild?.school_phone ? String(activeChild.school_phone).replace(/[^0-9]/g, '') : '919876543210';
                      const targetPhone = phone.startsWith('91') ? phone : `91${phone}`;
                      Linking.openURL(`https://wa.me/${targetPhone}?text=${msg}`).catch(() => {});
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.noticeWaBtnText}>💬 Inquire on WhatsApp</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.noticeShareBtn}
                    onPress={() => {
                      const msg = encodeURIComponent(`*${n.title}*\n${n.content}\n— Sent via ${activeChild?.school_name || 'School App'}`);
                      Linking.openURL(`whatsapp://send?text=${msg}`).catch(() => {
                        Linking.openURL(`https://wa.me/?text=${msg}`).catch(() => {});
                      });
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.noticeShareBtnText}>↗️ Forward</Text>
                  </TouchableOpacity>
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
    marginBottom: 20,
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
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.lg,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  noticeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  pinnedBorder: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tagPill: {
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pinnedPill: {
    backgroundColor: '#EEF2FF',
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  pinnedTagText: {
    color: '#4F46E5',
  },
  dateText: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 6,
  },
  noticeContent: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 19,
  },
  noticeFooterRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  noticeWaBtn: {
    flex: 2,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  noticeWaBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  noticeShareBtn: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  noticeShareBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
});
