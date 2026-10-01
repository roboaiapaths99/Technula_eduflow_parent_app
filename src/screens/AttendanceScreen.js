import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity
} from 'react-native';
import { theme } from '../theme';
import { parentApi, formatUserError, isPlanRestrictedError } from '../api';
import CircularAttendanceCard from '../components/CircularAttendanceCard';
import FeatureUnavailableCard from '../components/FeatureUnavailableCard';

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function AttendanceScreen({ user = {}, activeChild = null } = {}) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [attendanceData, setAttendanceData] = useState(null);
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' | 'log'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDayRecord, setSelectedDayRecord] = useState(null);

  const studentId = activeChild?.student_id;

  const loadData = async () => {
    if (!studentId) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const res = await parentApi.getStudentAttendance(studentId, 90);
      setAttendanceData(res);
    } catch (e) {
      setError(formatUserError(e, 'Unable to load attendance records right now.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [studentId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Map history by date 'YYYY-MM-DD'
  const attendanceMap = useMemo(() => {
    const map = {};
    (attendanceData?.history || []).forEach(item => {
      if (item.date) {
        map[item.date] = item;
      }
    });
    return map;
  }, [attendanceData]);

  // Calendar calculations for currentDate
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDayRecord(null);
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDayRecord(null);
  };

  const calendarDays = useMemo(() => {
    const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0
    const totalDays = new Date(year, month + 1, 0).getDate();
    const days = [];

    // Empty lead slots
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ empty: true, key: `empty-lead-${i}` });
    }

    // Days of month
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const record = attendanceMap[dateStr];
      const dayOfWeek = (firstDayIndex + d - 1) % 7;
      const isSunday = dayOfWeek === 6;

      days.push({
        empty: false,
        day: d,
        dateStr,
        record,
        isSunday,
        key: `day-${d}`,
      });
    }

    return days;
  }, [year, month, attendanceMap]);

  const currentMonthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthRecords = useMemo(() => {
    return (attendanceData?.history || []).filter(item => item.date && item.date.startsWith(currentMonthPrefix));
  }, [attendanceData, currentMonthPrefix]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
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
            icon="📅"
            title="Attendance Tracking Not Activated"
            subtitle="The digital attendance tracking service has not been activated by your school administration yet. Records will display here once enabled."
            onRetry={loadData}
          />
        </ScrollView>
      );
    }
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 36, marginBottom: 12 }}>⚠️</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadData}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const attPct = attendanceData?.attendance_percentage != null
    ? attendanceData.attendance_percentage
    : 0.0;
  const isAboveThreshold = attPct >= 75;
  const history = attendanceData?.history || [];

  const monthTotal = monthRecords.length;
  const monthPresent = monthRecords.filter(r => (r.status || '').toLowerCase() === 'present').length;
  const monthAbsent = monthRecords.filter(r => (r.status || '').toLowerCase() === 'absent').length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Student Header */}
      <View style={styles.studentBadge}>
        <Text style={styles.studentText}>
          {activeChild?.name || 'Student'} • Class {activeChild?.grade || '—'}-{activeChild?.section || '—'}
        </Text>
      </View>

      {/* Circular Attendance Summary Gauge */}
      <CircularAttendanceCard
        rate={attPct}
        presentCount={attendanceData?.present_count || 0}
        absentCount={attendanceData?.absent_count || 0}
        totalSessions={attendanceData?.total_sessions || 0}
        recentStatus={attendanceData?.history?.[0]?.status || ''}
        studentName={activeChild?.name || 'Student'}
      />

      {/* Segmented View Mode Controller */}
      <View style={styles.viewModeToggle}>
        <TouchableOpacity
          style={[styles.toggleBtn, viewMode === 'calendar' && styles.toggleBtnActive]}
          onPress={() => setViewMode('calendar')}
        >
          <Text style={[styles.toggleBtnText, viewMode === 'calendar' && styles.toggleBtnTextActive]}>
            🗓 Monthly Calendar
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, viewMode === 'log' && styles.toggleBtnActive]}
          onPress={() => setViewMode('log')}
        >
          <Text style={[styles.toggleBtnText, viewMode === 'log' && styles.toggleBtnTextActive]}>
            📋 Daily Log
          </Text>
        </TouchableOpacity>
      </View>

      {/* VIEW 1: MONTHLY CALENDAR GRID */}
      {viewMode === 'calendar' && (
        <View style={styles.calendarCard}>
          {/* Month Navigation */}
          <View style={styles.monthNavRow}>
            <TouchableOpacity onPress={handlePrevMonth} style={styles.navBtn}>
              <Text style={styles.navBtnText}>‹ Prev</Text>
            </TouchableOpacity>
            <Text style={styles.monthTitle}>
              {MONTH_NAMES[month]} {year}
            </Text>
            <TouchableOpacity onPress={handleNextMonth} style={styles.navBtn}>
              <Text style={styles.navBtnText}>Next ›</Text>
            </TouchableOpacity>
          </View>

          {/* Weekday Header */}
          <View style={styles.weekHeaderRow}>
            {DAYS_OF_WEEK.map((d, i) => (
              <Text key={i} style={[styles.weekDayText, i === 6 && { color: theme.colors.rose }]}>
                {d}
              </Text>
            ))}
          </View>

          {/* Day Grid */}
          <View style={styles.daysGrid}>
            {calendarDays.map((item) => {
              if (item.empty) {
                return <View key={item.key} style={styles.dayCellEmpty} />;
              }

              const status = item.record?.status?.toLowerCase();
              let cellBg = '#f8fafc';
              let dotColor = null;

              if (status === 'present') {
                cellBg = '#ecfdf5';
                dotColor = theme.colors.emerald;
              } else if (status === 'absent') {
                cellBg = '#fef2f2';
                dotColor = theme.colors.rose;
              } else if (status === 'late') {
                cellBg = '#fffbeb';
                dotColor = theme.colors.amber;
              } else if (item.isSunday) {
                cellBg = '#f1f5f9';
              }

              const isSelected = selectedDayRecord?.dateStr === item.dateStr;

              return (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.dayCell,
                    { backgroundColor: cellBg },
                    isSelected && styles.dayCellSelected,
                  ]}
                  onPress={() => setSelectedDayRecord(item)}
                >
                  <Text style={[
                    styles.dayNumber,
                    item.isSunday && { color: theme.colors.textMuted },
                    status === 'present' && { color: theme.colors.emerald, fontWeight: '800' },
                    status === 'absent' && { color: theme.colors.rose, fontWeight: '800' },
                  ]}>
                    {item.day}
                  </Text>
                  {dotColor && <View style={[styles.statusDot, { backgroundColor: dotColor }]} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Calendar Legend */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: theme.colors.emerald }]} />
              <Text style={styles.legendText}>Present</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: theme.colors.rose }]} />
              <Text style={styles.legendText}>Absent</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: theme.colors.amber }]} />
              <Text style={styles.legendText}>Late</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#cbd5e1' }]} />
              <Text style={styles.legendText}>Weekend / Off</Text>
            </View>
          </View>

          {/* Selected Day Details Panel */}
          {selectedDayRecord ? (
            <View style={styles.dayDetailPanel}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={styles.dayDetailTitle}>
                  📅 {selectedDayRecord.dateStr}
                </Text>
                {selectedDayRecord.record ? (
                  <View style={[
                    styles.statusPill,
                    {
                      backgroundColor: (selectedDayRecord.record.status || '').toLowerCase() === 'present'
                        ? theme.colors.emeraldLight
                        : ((selectedDayRecord.record.status || '').toLowerCase() === 'absent' ? theme.colors.roseLight : theme.colors.amberLight),
                      paddingVertical: 2,
                      paddingHorizontal: 8,
                    }
                  ]}>
                    <Text style={{
                      fontSize: 11,
                      fontWeight: '800',
                      color: (selectedDayRecord.record.status || '').toLowerCase() === 'present'
                        ? theme.colors.emerald
                        : ((selectedDayRecord.record.status || '').toLowerCase() === 'absent' ? theme.colors.rose : theme.colors.amber),
                    }}>
                      ● {selectedDayRecord.record.status}
                    </Text>
                  </View>
                ) : null}
              </View>

              {selectedDayRecord.record ? (
                <View style={{ gap: 4 }}>
                  <Text style={styles.dayDetailReason}>
                    Official Status: <Text style={{ fontWeight: '700', color: theme.colors.textPrimary }}>{selectedDayRecord.record.status}</Text>
                  </Text>
                  {selectedDayRecord.record.reason ? (
                    <Text style={styles.dayDetailReason}>
                      Teacher Remark: <Text style={{ fontStyle: 'italic' }}>"{selectedDayRecord.record.reason}"</Text>
                    </Text>
                  ) : (
                    <Text style={{ fontSize: 11, color: theme.colors.textMuted }}>No special exception or remark filed.</Text>
                  )}
                </View>
              ) : (
                <Text style={styles.dayDetailEmpty}>
                  {selectedDayRecord.isSunday
                    ? 'Weekend / Holiday'
                    : 'No attendance marked for this day.'}
                </Text>
              )}
            </View>
          ) : (
            <View style={[styles.dayDetailPanel, { backgroundColor: '#F8FAFC', borderStyle: 'dashed' }]}>
              <Text style={{ fontSize: 12, color: theme.colors.textSecondary, textAlign: 'center' }}>
                💡 Tap any date above to see details
              </Text>
            </View>
          )}

          {/* Real Month Working Breakdown Strip */}
          <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {MONTH_NAMES[month]} {year} Overview
              </Text>
              <Text style={{ fontSize: 12, fontWeight: '800', color: theme.colors.textPrimary }}>
                {monthTotal > 0 ? `${monthTotal} Sessions Recorded` : 'No sessions logged yet'}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={[styles.statBox, { flex: 1, paddingVertical: 10 }]}>
                <Text style={[styles.statVal, { fontSize: 16, color: theme.colors.emerald }]}>{monthPresent}</Text>
                <Text style={styles.statLbl}>Present</Text>
              </View>
              <View style={[styles.statBox, { flex: 1, paddingVertical: 10 }]}>
                <Text style={[styles.statVal, { fontSize: 16, color: monthAbsent > 0 ? theme.colors.rose : '#64748B' }]}>{monthAbsent}</Text>
                <Text style={styles.statLbl}>Absent</Text>
              </View>
              <View style={[styles.statBox, { flex: 1, paddingVertical: 10 }]}>
                <Text style={[styles.statVal, { fontSize: 16 }]}>{attendanceData?.total_sessions || 0}</Text>
                <Text style={styles.statLbl}>Term Total</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* VIEW 2: DAILY RECORDS LIST */}
      {viewMode === 'log' && (
        <View style={styles.listCard}>
          <Text style={styles.listTitle}>Daily Session Log</Text>
          <Text style={styles.listSubtitle}>Chronological Attendance Log</Text>

          <View style={{ marginTop: 14 }}>
            {history.length === 0 ? (
              <Text style={styles.emptyNote}>No attendance logs recorded for this period.</Text>
            ) : (
              history.map((item, idx) => {
                const isPresent = (item.status || '').toLowerCase() === 'present';
                const isLate = (item.status || '').toLowerCase() === 'late';
                let pillBg = theme.colors.emeraldLight;
                let textColor = theme.colors.emerald;
                let label = '✓ Present';

                if (!isPresent) {
                  if (isLate) {
                    pillBg = theme.colors.amberLight;
                    textColor = theme.colors.amber;
                    label = '⏱ Late';
                  } else {
                    pillBg = theme.colors.roseLight;
                    textColor = theme.colors.rose;
                    label = '✗ Absent';
                  }
                }

                return (
                  <View key={idx} style={styles.itemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dateText}>{item.date}</Text>
                      {item.reason ? (
                        <Text style={styles.reasonText}>{item.reason}</Text>
                      ) : null}
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: pillBg }]}>
                      <Text style={[styles.statusText, { color: textColor }]}>
                        {label}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
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
  studentBadge: {
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  studentText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 16,
    ...theme.shadows.card,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.textMuted,
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 34,
    fontWeight: '800',
    marginTop: 4,
  },
  summarySub: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
    fontWeight: '600',
  },
  badgePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statCounters: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
    marginTop: 16,
    paddingTop: 12,
    justifyContent: 'space-around',
  },
  statBox: {
    alignItems: 'center',
  },
  statVal: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.emerald,
  },
  statLbl: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
    fontWeight: '600',
  },
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleBtnActive: {
    backgroundColor: '#FFFFFF',
    ...theme.shadows.card,
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  toggleBtnTextActive: {
    color: theme.colors.primary,
  },
  calendarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 16,
    ...theme.shadows.card,
  },
  monthNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  navBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
  },
  navBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  weekHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  weekDayText: {
    width: '14.2%',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  dayCell: {
    width: '14.2%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginVertical: 2,
  },
  dayCellSelected: {
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  dayCellEmpty: {
    width: '14.2%',
    aspectRatio: 1,
  },
  dayNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  statusDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  dayDetailPanel: {
    marginTop: 14,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  dayDetailTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  dayDetailRow: {
    gap: 2,
  },
  dayDetailStatus: {
    fontSize: 12,
    color: theme.colors.textPrimary,
  },
  dayDetailReason: {
    fontSize: 11,
    color: theme.colors.rose,
    marginTop: 2,
  },
  dayDetailEmpty: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  listCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  listSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  emptyNote: {
    fontSize: 13,
    color: theme.colors.textMuted,
    textAlign: 'center',
    paddingVertical: 20,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  reasonText: {
    fontSize: 12,
    color: theme.colors.rose,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
