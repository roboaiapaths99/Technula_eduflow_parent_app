import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Linking, Alert
} from 'react-native';
import { theme } from '../theme';
import { parentApi, getApiBase } from '../api';

export default function DatesheetScreen({ user, activeChild }) {
  const [datesheets, setDatesheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);

  const grade = activeChild?.grade || '10';

  const loadDatesheets = async () => {
    try {
      const res = await parentApi.getGradeDatesheets(grade);
      setDatesheets(Array.isArray(res) ? res : (res?.datesheets || []));
    } catch (e) {
      console.log('[Datesheet Notice] load failed:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDatesheets();
  }, [grade]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDatesheets();
  };

  const handleOpenPdf = (pdfUrl) => {
    if (!pdfUrl) {
      Alert.alert('No PDF Attached', 'School has published the digital timetable entries below.');
      return;
    }
    const fullUrl = pdfUrl.startsWith('http') ? pdfUrl : `${getApiBase()}${pdfUrl}`;
    Linking.openURL(fullUrl).catch(() => {
      Alert.alert('Document Notice', 'Unable to open PDF link on this device.');
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const currentSheet = datesheets[activeSheetIndex];

  return (
    <View style={styles.container}>
      {/* Top Header Card */}
      <View style={styles.topCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.topGradeBadge}>Class {grade} Timetable</Text>
          <Text style={styles.topTitle}>Exam Datesheets</Text>
          <Text style={styles.topSub}>
            Official exam routines, room allocations, and schedules for {activeChild?.name || 'student'}
          </Text>
        </View>
      </View>

      {/* Datesheet Selector (if multiple exams scheduled) */}
      {datesheets.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
          {datesheets.map((ds, idx) => (
            <TouchableOpacity
              key={ds.id || idx}
              style={[styles.examTab, activeSheetIndex === idx && styles.examTabActive]}
              onPress={() => setActiveSheetIndex(idx)}
            >
              <Text style={[styles.examTabText, activeSheetIndex === idx && styles.examTabTextActive]}>
                {ds.exam_title || `Exam #${idx + 1}`}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {!currentSheet ? (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 36, marginBottom: 10 }}>📅</Text>
            <Text style={styles.emptyTitle}>No Upcoming Exams Scheduled</Text>
            <Text style={styles.emptySub}>
              There are no published exam datesheets for Class {grade} right now. Once announced by the academic coordinator, subjects and timetables will appear here.
            </Text>
          </View>
        ) : (
          <View style={styles.sheetContainer}>
            {/* Sheet Banner */}
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>{currentSheet.exam_title}</Text>
                <Text style={styles.sheetMeta}>
                  Academic Term: {currentSheet.academic_term || 'Current'} • Session: {currentSheet.session_year || '2025-26'}
                </Text>
              </View>
              {currentSheet.pdf_url && (
                <TouchableOpacity
                  style={styles.pdfBtn}
                  onPress={() => handleOpenPdf(currentSheet.pdf_url)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.pdfBtnText}>📄 PDF</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Timetable Table Entries */}
            <View style={styles.entriesList}>
              <Text style={styles.entriesSectionHeader}>Schedule of Examinations</Text>
              {(currentSheet.entries || []).length === 0 ? (
                <Text style={styles.noEntriesText}>Detailed subject rows are being finalized by the school office.</Text>
              ) : (
                currentSheet.entries.map((entry, i) => (
                  <View key={entry.id || i} style={styles.entryRow}>
                    <View style={styles.dateBox}>
                      <Text style={styles.dateDay}>
                        {entry.exam_date ? new Date(entry.exam_date).toLocaleDateString([], { month: 'short', day: 'numeric' }) : `Day ${i+1}`}
                      </Text>
                      <Text style={styles.dateWeekday}>
                        {entry.exam_date ? new Date(entry.exam_date).toLocaleDateString([], { weekday: 'short' }) : ''}
                      </Text>
                    </View>

                    <View style={styles.subjectBox}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.subjectName}>{entry.subject_name}</Text>
                        {entry.subject_code && (
                          <Text style={styles.subjectCode}>({entry.subject_code})</Text>
                        )}
                      </View>
                      <Text style={styles.examTiming}>
                        ⏰ {entry.start_time || '09:00 AM'} - {entry.end_time || '12:00 PM'}
                        {entry.room_no ? ` • Room ${entry.room_no}` : ''}
                      </Text>
                    </View>

                    {entry.max_marks && (
                      <View style={styles.marksBadge}>
                        <Text style={styles.marksText}>{entry.max_marks} M</Text>
                      </View>
                    )}
                  </View>
                ))
              )}
            </View>

            {currentSheet.instructions && (
              <View style={styles.instructionBox}>
                <Text style={styles.instructionHeader}>📝 Student Guidelines & Instructions:</Text>
                <Text style={styles.instructionContent}>{currentSheet.instructions}</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bgMain },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  topGradeBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  topTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.textPrimary },
  topSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  tabsScroll: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
    maxHeight: 52,
  },
  examTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
  },
  examTabActive: { backgroundColor: theme.colors.primary },
  examTabText: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },
  examTabTextActive: { color: '#FFFFFF', fontWeight: '700' },
  scrollContent: { padding: 16 },
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
  emptySub: { fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 18 },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    ...theme.shadows.card,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.textPrimary },
  sheetMeta: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  pdfBtn: {
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.primaryBorder,
  },
  pdfBtnText: { fontSize: 12, fontWeight: '700', color: theme.colors.primary },
  entriesList: { marginTop: 14 },
  entriesSectionHeader: { fontSize: 13, fontWeight: '800', color: theme.colors.textSecondary, marginBottom: 10 },
  noEntriesText: { fontSize: 13, color: theme.colors.textMuted, fontStyle: 'italic', paddingVertical: 10 },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dateBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: theme.radius.md,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
    minWidth: 64,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dateDay: { fontSize: 12, fontWeight: '800', color: theme.colors.textPrimary },
  dateWeekday: { fontSize: 10, color: theme.colors.textMuted, fontWeight: '600' },
  subjectBox: { flex: 1, marginLeft: 12 },
  subjectName: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  subjectCode: { fontSize: 12, color: theme.colors.textMuted },
  examTiming: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  marksBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  marksText: { fontSize: 11, fontWeight: '800', color: '#059669' },
  instructionBox: {
    marginTop: 16,
    backgroundColor: '#FFFBEB',
    borderRadius: theme.radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  instructionHeader: { fontSize: 12, fontWeight: '800', color: '#92400E', marginBottom: 4 },
  instructionContent: { fontSize: 12, color: '#78350F', lineHeight: 18 },
});
