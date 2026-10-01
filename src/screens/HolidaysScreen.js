import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl
} from 'react-native';
import { theme } from '../theme';
import { parentApi } from '../api';

export default function HolidaysScreen({ user, activeChild }) {
  const [holidays, setHolidays] = useState([]);
  const [nextHoliday, setNextHoliday] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const schoolId = activeChild?.school_id || user?.school_id || 1;

  const loadHolidays = async () => {
    try {
      const res = await parentApi.getSchoolHolidays(schoolId);
      const list = Array.isArray(res) ? res : (res?.holidays || []);
      setHolidays(list);
      setNextHoliday(res?.next_holiday || calculateNextHoliday(list));
    } catch (e) {
      console.warn('Failed to load holidays:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateNextHoliday = (list) => {
    const today = new Date().toISOString().split('T')[0];
    const upcoming = list
      .filter(h => (h.end_date || h.start_date) >= today)
      .sort((a, b) => a.start_date.localeCompare(b.start_date));
    return upcoming[0] || null;
  };

  useEffect(() => {
    loadHolidays();
  }, [schoolId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadHolidays();
  };

  const getDaysCountdown = (startDate) => {
    if (!startDate) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const target = new Date(startDate);
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today!';
    if (diffDays === 1) return 'Tomorrow!';
    if (diffDays < 0) return 'Ongoing';
    return `In ${diffDays} days`;
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Holiday Calendar</Text>
        <Text style={styles.headerSub}>Official academic calendar of leaves and gazetted breaks</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Next Upcoming Holiday Countdown Card */}
        {nextHoliday && (
          <View style={styles.countdownCard}>
            <View style={styles.countdownHeaderRow}>
              <Text style={styles.countdownPill}>UPCOMING HOLIDAY</Text>
              <Text style={styles.countdownDays}>{getDaysCountdown(nextHoliday.start_date)}</Text>
            </View>

            <Text style={styles.countdownTitle}>{nextHoliday.title || nextHoliday.name}</Text>
            <Text style={styles.countdownDates}>
              📅 {nextHoliday.start_date ? new Date(nextHoliday.start_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
              {nextHoliday.end_date && nextHoliday.end_date !== nextHoliday.start_date
                ? ` — ${new Date(nextHoliday.end_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`
                : ''}
            </Text>
            {nextHoliday.description && (
              <Text style={styles.countdownDesc}>{nextHoliday.description}</Text>
            )}
          </View>
        )}

        {/* All Holidays Roster */}
        <Text style={styles.listHeader}>Academic Session Holidays</Text>
        {holidays.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>🏖️</Text>
            <Text style={styles.emptyTitle}>No Holidays Listed</Text>
            <Text style={styles.emptySub}>Academic coordinator has not published holidays for this term yet.</Text>
          </View>
        ) : (
          holidays.map((h, i) => (
            <View key={h.id || i} style={styles.holidayRow}>
              <View style={styles.dateCircle}>
                <Text style={styles.circleDay}>
                  {h.start_date ? new Date(h.start_date).getDate() : '-'}
                </Text>
                <Text style={styles.circleMonth}>
                  {h.start_date ? new Date(h.start_date).toLocaleDateString([], { month: 'short' }).toUpperCase() : ''}
                </Text>
              </View>

              <View style={styles.holidayDetails}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={styles.holidayName}>{h.title || h.name}</Text>
                  <View style={styles.categoryPill}>
                    <Text style={styles.categoryText}>{h.category || 'Gazetted'}</Text>
                  </View>
                </View>

                <Text style={styles.holidaySub}>
                  {h.start_date ? new Date(h.start_date).toLocaleDateString([], { weekday: 'long' }) : ''}
                  {h.end_date && h.end_date !== h.start_date
                    ? ` through ${new Date(h.end_date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}`
                    : ''}
                </Text>
                {h.description && <Text style={styles.descText}>{h.description}</Text>}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bgMain },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.textPrimary },
  headerSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  scrollContent: { padding: 16, gap: 12 },
  countdownCard: {
    backgroundColor: '#4F46E5',
    borderRadius: theme.radius.lg,
    padding: 18,
    ...theme.shadows.card,
  },
  countdownHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  countdownPill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  countdownDays: { fontSize: 13, fontWeight: '800', color: '#FDE047' },
  countdownTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginTop: 12 },
  countdownDates: { fontSize: 13, color: '#E0E7FF', marginTop: 4, fontWeight: '600' },
  countdownDesc: { fontSize: 12, color: '#C7D2FE', marginTop: 8, lineHeight: 16 },
  listHeader: { fontSize: 14, fontWeight: '800', color: theme.colors.textSecondary, marginTop: 10, marginBottom: 4 },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    padding: 32,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary },
  emptySub: { fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 6 },
  holidayRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.md,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  dateCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  circleDay: { fontSize: 16, fontWeight: '800', color: '#4F46E5', lineHeight: 18 },
  circleMonth: { fontSize: 9, fontWeight: '800', color: '#6366F1' },
  holidayDetails: { flex: 1, marginLeft: 14 },
  holidayName: { fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary },
  categoryPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
  },
  categoryText: { fontSize: 10, fontWeight: '700', color: theme.colors.textSecondary },
  holidaySub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  descText: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 4, fontStyle: 'italic' },
});
