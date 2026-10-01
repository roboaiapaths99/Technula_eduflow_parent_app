import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity
} from 'react-native';
import { theme } from '../theme';
import { parentApi } from '../api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PERIOD_TIMES = ['8:00', '8:45', '9:30', '10:30', '11:15', '12:00', '1:00', '1:45'];

export default function TimetableScreen({ user = {}, activeChild = null } = {}) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [timetable, setTimetable] = useState({});
  const [todaySchedule, setTodaySchedule] = useState([]);

  const schoolId = activeChild?.school_id;
  const grade = activeChild?.grade;
  const section = activeChild?.section;

  const loadData = async () => {
    if (!schoolId || !grade || !section) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const [tt, today] = await Promise.all([
        parentApi.getClassTimetable(schoolId, grade, section).catch(() => ({})),
        parentApi.getTodaySchedule(schoolId, grade, section).catch(() => ({ periods: [] })),
      ]);

      // Normalize weekly grid into { Monday: { 1: slot, 2: slot } }
      const scheduleRaw = tt?.schedule || tt || {};
      const parsedGrid = {};
      for (const d of DAYS) {
        parsedGrid[d] = {};
        const rawDay = scheduleRaw[d];
        if (Array.isArray(rawDay)) {
          rawDay.forEach((slot) => {
            const pNum = slot.period_number || slot.period;
            if (pNum) parsedGrid[d][pNum] = slot;
          });
        } else if (typeof rawDay === 'object' && rawDay !== null) {
          parsedGrid[d] = rawDay;
        }
      }
      setTimetable(parsedGrid);

      // Normalize today's periods array
      const periods = today?.periods || (Array.isArray(today) ? today : []);
      setTodaySchedule(periods);
    } catch (e) {
      setError(e.message || 'Failed to load timetable');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, [schoolId, grade, section]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const todayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>📅</Text>
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
        <Text style={styles.title}>Class Timetable</Text>
        <Text style={styles.subtitle}>
          {activeChild?.name} • Grade {grade}-{section}
        </Text>
      </View>

      {/* Today's Schedule Highlight */}
      <View style={styles.todayCard}>
        <Text style={styles.todayLabel}>📍 TODAY'S SCHEDULE — {todayName.toUpperCase()}</Text>
        {todaySchedule.length > 0 ? (
          <View style={{ marginTop: 10, gap: 8 }}>
            {todaySchedule.map((slot, idx) => (
              <View key={idx} style={styles.todaySlot}>
                <View style={styles.periodBadge}>
                  <Text style={styles.periodText}>P{slot.period || slot.period_number || idx + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.slotSubject}>{slot.subject || slot.subject_name || '—'}</Text>
                  <Text style={styles.slotTeacher}>
                    {slot.teacher || slot.teacher_name || 'Class Teacher'} {slot.room || slot.room_number ? `• ${slot.room || slot.room_number}` : ''}
                  </Text>
                </View>
                <Text style={styles.slotTime}>
                  {slot.time || `${slot.start_time || ''} - ${slot.end_time || ''}` || PERIOD_TIMES[idx] || ''}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.noClass}>No classes scheduled today</Text>
        )}
      </View>

      {/* Weekly Timetable Grid */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>📋 Weekly Timetable</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            {/* Header Row */}
            <View style={styles.gridRow}>
              <View style={[styles.gridCell, styles.gridHeader, { width: 80 }]}>
                <Text style={styles.gridHeaderText}>Day</Text>
              </View>
              {Array.from({ length: 8 }).map((_, i) => (
                <View key={i} style={[styles.gridCell, styles.gridHeader, { width: 90 }]}>
                  <Text style={styles.gridHeaderText}>P{i + 1}</Text>
                </View>
              ))}
            </View>

            {/* Day Rows */}
            {DAYS.map((day) => {
              const daySlots = timetable[day] || {};
              const isToday = day === todayName;
              return (
                <View key={day} style={[styles.gridRow, isToday && styles.todayRow]}>
                  <View style={[styles.gridCell, { width: 80 }]}>
                    <Text style={[styles.dayName, isToday && { color: theme.colors.primary, fontWeight: '800' }]}>
                      {day.substring(0, 3)}
                    </Text>
                  </View>
                  {Array.from({ length: 8 }).map((_, pIdx) => {
                    const slot = daySlots[pIdx + 1] || daySlots[String(pIdx + 1)];
                    return (
                      <View key={pIdx} style={[styles.gridCell, { width: 90 }]}>
                        {slot ? (
                          <>
                            <Text style={styles.cellSubject} numberOfLines={1}>
                              {slot.subject_name || slot.subject || '—'}
                            </Text>
                            <Text style={styles.cellTeacher} numberOfLines={1}>
                              {slot.teacher_name || ''}
                            </Text>
                          </>
                        ) : (
                          <Text style={styles.cellEmpty}>—</Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bgMain },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorText: { fontSize: 14, color: theme.colors.rose, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: theme.colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: theme.radius.md },
  retryText: { color: '#fff', fontWeight: '700' },
  header: { marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', color: theme.colors.textPrimary },
  subtitle: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  todayCard: {
    backgroundColor: theme.colors.primaryLight, borderWidth: 1, borderColor: theme.colors.primaryBorder,
    borderRadius: theme.radius.lg, padding: 16, marginBottom: 16,
  },
  todayLabel: { fontSize: 12, fontWeight: '800', color: theme.colors.primary, letterSpacing: 0.4 },
  noClass: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 8 },
  todaySlot: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 8, padding: 10 },
  periodBadge: { backgroundColor: theme.colors.primary, width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  periodText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  slotSubject: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  slotTeacher: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 1 },
  slotTime: { fontSize: 12, color: theme.colors.textMuted, fontWeight: '600' },
  sectionCard: {
    backgroundColor: '#FFFFFF', borderRadius: theme.radius.lg, padding: 18,
    borderWidth: 1, borderColor: theme.colors.border, ...theme.shadows.card,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 14 },
  gridRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.colors.borderSubtle },
  todayRow: { backgroundColor: 'rgba(99,91,255,0.04)' },
  gridCell: { paddingVertical: 10, paddingHorizontal: 6, justifyContent: 'center' },
  gridHeader: { backgroundColor: '#F1F5F9' },
  gridHeaderText: { fontSize: 11, fontWeight: '800', color: theme.colors.textSecondary, textAlign: 'center' },
  dayName: { fontSize: 12, fontWeight: '700', color: theme.colors.textPrimary },
  cellSubject: { fontSize: 11, fontWeight: '700', color: theme.colors.textPrimary, textAlign: 'center' },
  cellTeacher: { fontSize: 10, color: theme.colors.textMuted, textAlign: 'center' },
  cellEmpty: { fontSize: 12, color: theme.colors.textMuted, textAlign: 'center' },
});
