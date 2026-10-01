import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Linking, ActivityIndicator, RefreshControl, Modal, Image
} from 'react-native';
import { theme } from '../theme';
import { parentApi, getApiBase, formatUserError, isPlanRestrictedError } from '../api';
import FeatureUnavailableCard from '../components/FeatureUnavailableCard';

export default function ReportCardScreen({ user = {}, activeChild = null } = {}) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null);
  const [examSheets, setExamSheets] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState(null);

  const studentId = activeChild?.student_id;

  const loadData = async () => {
    if (!studentId) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const [reportRes, sheetsRes] = await Promise.allSettled([
        parentApi.getReportCard(studentId, 'latest'),
        user?.id ? parentApi.getStudentExamSheets(studentId, user.id) : Promise.resolve({ sheets: [] }),
      ]);

      if (reportRes.status === 'fulfilled') {
        setReport(reportRes.value);
      } else {
        console.log('Report card notice:', reportRes.reason);
      }

      if (sheetsRes.status === 'fulfilled') {
        setExamSheets(sheetsRes.value?.sheets || []);
      }
    } catch (e) {
      setError(formatUserError(e, 'Academic records are being prepared by the examination cell.'));
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

  const handleOpenPdf = () => {
    const examId = report?.exam?.id || 'latest';
    const url = `${getApiBase()}/report-cards/student/${studentId}/exam/${examId}/html`;
    Linking.openURL(url).catch(err => console.warn('Cannot open URL:', err));
  };

  const handleOpenProgressLetter = () => {
    const url = parentApi.getProgressLetterHtmlUrl(studentId);
    Linking.openURL(url).catch(err => console.warn('Cannot open progress letter:', err));
  };

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
            icon="📊"
            title="Academic Reports Not Activated"
            subtitle="The digital examination and report card module has not been activated by your school administration yet. Term scorecards will appear here once published."
            onRetry={loadData}
          />
        </ScrollView>
      );
    }
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 36, marginBottom: 12 }}>📄</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadData}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!report) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 36, marginBottom: 12 }}>📄</Text>
        <Text style={styles.emptyText}>No report card published for this term yet.</Text>
      </View>
    );
  }

  const s = report.student || {};
  const school = report.school || {};
  const exam = report.exam || {};
  const marks = report.marks || [];

  const totalMax = marks.reduce((sum, m) => sum + (m.max_marks || 0), 0);
  const totalObtained = marks.reduce((sum, m) => sum + (m.marks_obtained || 0), 0);
  const overallPct = totalMax > 0 ? ((totalObtained / totalMax) * 100).toFixed(1) : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Report Card Paper */}
      <View style={styles.cardPaper}>
        {/* School Header */}
        <View style={styles.schoolHeader}>
          <Text style={styles.schoolName}>{school.name || activeChild?.school_name || ''}</Text>
          <Text style={styles.schoolMeta}>
            {school.address || 'CBSE Affiliated'}
          </Text>
          <View style={styles.examTag}>
            <Text style={styles.examTagText}>
              Official {exam.name || 'Term Evaluation'} ({exam.term || '2025-26'})
            </Text>
          </View>
        </View>

        {/* Student Info */}
        <View style={styles.metaBox}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Student Name:</Text>
            <Text style={styles.metaVal}>{s.name || activeChild?.name}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Class & Sec:</Text>
            <Text style={styles.metaVal}>Class {s.grade || activeChild?.grade} - {s.section || activeChild?.section} (Roll #{s.roll_no || activeChild?.roll_no || 1})</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Admission No:</Text>
            <Text style={styles.metaVal}>{s.admission_no || activeChild?.admission_no}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Overall Score:</Text>
            <Text style={[styles.metaVal, { color: theme.colors.primary, fontWeight: '800' }]}>
              {overallPct}%
            </Text>
          </View>
        </View>

        {/* Marks Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { flex: 2 }]}>Subject</Text>
            <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>Max</Text>
            <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>Marks</Text>
            <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>Grade</Text>
          </View>

          {marks.map((m, idx) => (
            <View key={idx} style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}>
              <Text style={[styles.tdSubject, { flex: 2 }]}>{m.subject_name || m.subject}</Text>
              <Text style={[styles.td, { flex: 1, textAlign: 'center' }]}>{m.max_marks || m.max}</Text>
              <Text style={[styles.tdBold, { flex: 1, textAlign: 'center' }]}>{m.marks_obtained || m.marks}</Text>
              <Text style={[styles.tdGrade, { flex: 1, textAlign: 'center' }]}>{m.grade_letter || m.grade || 'A'}</Text>
            </View>
          ))}

          {/* Grand Total */}
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { flex: 2 }]}>Grand Total:</Text>
            <Text style={[styles.totalVal, { flex: 1, textAlign: 'center' }]}>{totalMax}</Text>
            <Text style={[styles.totalScore, { flex: 1, textAlign: 'center' }]}>{totalObtained}</Text>
            <Text style={[styles.totalGrade, { flex: 1, textAlign: 'center' }]}>
              {overallPct >= 90 ? 'A+' : overallPct >= 80 ? 'A' : overallPct >= 70 ? 'B+' : 'B'}
            </Text>
          </View>
        </View>

        {/* Teacher Feedback Note */}
        {(report.class_teacher_remarks || report.ai_remarks || report.remarks) && (
          <View style={styles.feedbackBox}>
            <Text style={styles.feedbackTitle}>Class Teacher Remarks:</Text>
            <Text style={styles.feedbackText}>
              "{report.class_teacher_remarks || report.ai_remarks || report.remarks}"
            </Text>
          </View>
        )}

        {/* Signatures */}
        <View style={styles.signRow}>
          <View style={styles.signCol}>
            <View style={styles.signLine} />
            <Text style={styles.signText}>Class Teacher</Text>
          </View>
          <View style={styles.signCol}>
            <View style={styles.signLine} />
            <Text style={styles.signText}>Principal</Text>
          </View>
        </View>
      </View>

      {/* Visual Subject Mastery Graph */}
      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>📊 Subject Mastery & Score Distribution</Text>
          <Text style={styles.chartSubtitle}>Comparing student marks against 70% proficiency line</Text>
        </View>
        <View style={{ marginTop: 12, gap: 12 }}>
          {marks.map((m, idx) => {
            const pct = m.max_marks > 0 ? Math.round((m.marks_obtained / m.max_marks) * 100) : 0;
            const barColor = pct >= 80 ? '#10B981' : pct >= 65 ? theme.colors.primary : '#F59E0B';
            return (
              <View key={idx} style={styles.barItem}>
                <View style={styles.barLabelRow}>
                  <Text style={styles.barSubject}>{m.subject_name || m.subject}</Text>
                  <Text style={[styles.barPct, { color: barColor }]}>
                    {m.marks_obtained}/{m.max_marks} ({pct}%)
                  </Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${Math.min(100, Math.max(8, pct))}%`, backgroundColor: barColor }]} />
                  <View style={styles.benchmarkLine} />
                </View>
              </View>
            );
          })}
        </View>
        <View style={styles.benchmarkLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
            <Text style={styles.legendText}>≥80% Distinction</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.colors.primary }]} />
            <Text style={styles.legendText}>65-79% Proficient</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
            <Text style={styles.legendText}>&lt;65% Focus Area</Text>
          </View>
        </View>
      </View>

      {/* Visual Academic Highlights */}
      <View style={styles.aiDiagCard}>
        <View style={styles.aiDiagHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 18 }}>🎯</Text>
            <Text style={styles.aiDiagTitle}>Term Performance Summary</Text>
          </View>
          <View style={styles.aiBadge}>
            <Text style={styles.aiBadgeText}>
              {overallPct >= 80 ? 'Distinction' : (overallPct >= 60 ? 'First Division' : 'Passing')}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <View style={[styles.strengthBox, { flex: 1, padding: 10, alignItems: 'center' }]}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: theme.colors.primary }}>{overallPct}%</Text>
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#64748B', marginTop: 2 }}>Overall Score</Text>
          </View>
          <View style={[styles.growthBox, { flex: 1, padding: 10, alignItems: 'center' }]}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#10B981' }}>
              {marks.filter(m => (m.marks_obtained / (m.max_marks || 100)) >= 0.8).length} / {marks.length}
            </Text>
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#64748B', marginTop: 2 }}>Distinctions</Text>
          </View>
          <View style={[styles.strengthBox, { flex: 1, padding: 10, alignItems: 'center', backgroundColor: '#F0FDF4' }]}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#059669' }}>{report.class_rank || '--'}</Text>
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#64748B', marginTop: 2 }}>Class Rank</Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={{ gap: 10, marginBottom: 16 }}>
        <TouchableOpacity
          style={styles.pdfBtn}
          onPress={handleOpenPdf}
          activeOpacity={0.85}
        >
          <Text style={styles.pdfBtnText}>📄 Open & Print Official PDF Format</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.pdfBtn, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}
          onPress={handleOpenProgressLetter}
          activeOpacity={0.85}
        >
          <Text style={[styles.pdfBtnText, { color: '#047857' }]}>
            💌 Open Official Mid-Term Progress Letter (HTML/A4)
          </Text>
        </TouchableOpacity>
      </View>

      {/* Evaluated Exam Answer Sheets */}
      <View style={styles.sheetsSection}>
        <View style={styles.sheetsHeaderRow}>
          <View>
            <Text style={styles.sheetsTitle}>📑 Evaluated Answer Papers</Text>
            <Text style={styles.sheetsSubtitle}>
              Official answer papers evaluated and verified by teachers
            </Text>
          </View>
          <View style={styles.secureBadge}>
            <Text style={styles.secureBadgeText}>Verified</Text>
          </View>
        </View>

        {examSheets.length === 0 ? (
          <View style={styles.emptySheetsBox}>
            <Text style={{ fontSize: 28, marginBottom: 8 }}>📝</Text>
            <Text style={styles.emptySheetsText}>
              No evaluated answer sheets uploaded for this term yet.
            </Text>
            <Text style={styles.emptySheetsSubtext}>
              When teachers upload your child's evaluated exam papers, they will appear here.
            </Text>
          </View>
        ) : (
          <View style={styles.sheetsList}>
            {examSheets.map((sheet) => (
              <View key={sheet.id} style={styles.sheetCard}>
                <View style={styles.sheetTopRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetSubject}>{sheet.subject}</Text>
                    <Text style={styles.sheetExam}>{sheet.exam_name || 'Term Exam'}</Text>
                  </View>
                  <View style={styles.sheetScoreBox}>
                    <Text style={styles.sheetScoreVal}>
                      {sheet.marks_obtained !== null && sheet.marks_obtained !== undefined
                        ? sheet.marks_obtained
                        : '—'}
                    </Text>
                    <Text style={styles.sheetScoreMax}>/{sheet.max_marks || 100}</Text>
                  </View>
                </View>

                <View style={styles.sheetMetaRow}>
                  <View style={styles.verifiedTag}>
                    <Text style={styles.verifiedTagText}>✓ Evaluated & Verified</Text>
                  </View>
                  <Text style={styles.sheetDate}>
                    Date: {sheet.created_at ? sheet.created_at.split('T')[0] : 'Recent'}
                  </Text>
                </View>

                {sheet.evaluator_notes ? (
                  <Text style={styles.sheetNotes} numberOfLines={2}>
                    💬 Teacher: "{sheet.evaluator_notes}"
                  </Text>
                ) : null}

                <TouchableOpacity
                  style={styles.sheetViewBtn}
                  onPress={() => setSelectedSheet(sheet)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.sheetViewBtnText}>🔍 View Evaluated Paper</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Evaluated Sheet Detail Modal */}
      <Modal
        visible={!!selectedSheet}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedSheet(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>📄 Evaluated Answer Sheet</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedSheet?.subject} • {selectedSheet?.exam_name}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setSelectedSheet(null)}
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Security / Confidentiality Banner */}
              <View style={styles.securityBanner}>
                <Text style={styles.securityBannerText}>
                  🔒 Official academic record for parent of{' '}
                  <Text style={{ fontWeight: '800' }}>{s.name || activeChild?.name}</Text> (Adm #{s.admission_no || activeChild?.admission_no}).
                </Text>
              </View>

              {/* Sheet Summary Grid */}
              <View style={styles.metaGrid}>
                <View style={styles.metaCol}>
                  <Text style={styles.metaColLabel}>Subject</Text>
                  <Text style={styles.metaColVal}>{selectedSheet?.subject}</Text>
                </View>
                <View style={styles.metaCol}>
                  <Text style={styles.metaColLabel}>Marks</Text>
                  <Text style={[styles.metaColVal, { color: theme.colors.emerald, fontWeight: '800' }]}>
                    {selectedSheet?.marks_obtained} / {selectedSheet?.max_marks}
                  </Text>
                </View>
                <View style={styles.metaCol}>
                  <Text style={styles.metaColLabel}>Status</Text>
                  <Text style={styles.metaColVal}>Verified</Text>
                </View>
              </View>

              {selectedSheet?.evaluator_notes ? (
                <View style={styles.evalNotesBox}>
                  <Text style={styles.evalNotesTitle}>Evaluator Remarks & Corrections:</Text>
                  <Text style={styles.evalNotesBody}>"{selectedSheet.evaluator_notes}"</Text>
                </View>
              ) : null}

              {/* Action Buttons */}
              <TouchableOpacity
                style={styles.openStreamBtn}
                onPress={() => {
                  if (selectedSheet) {
                    const url = parentApi.getExamSheetViewUrl(selectedSheet.id, user?.id);
                    Linking.openURL(url).catch(err => console.warn('Cannot open sheet:', err));
                  }
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.openStreamBtnText}>📄 Open Evaluated Answer Sheet</Text>
              </TouchableOpacity>
            </ScrollView>
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
  emptyText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
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
  cardPaper: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  schoolHeader: {
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary,
    paddingBottom: 14,
    marginBottom: 14,
  },
  schoolName: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  schoolMeta: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 3,
    textAlign: 'center',
  },
  examTag: {
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 8,
  },
  examTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  metaBox: {
    backgroundColor: theme.colors.bgSubtle,
    borderRadius: theme.radius.md,
    padding: 12,
    marginBottom: 16,
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  metaVal: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  table: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: theme.colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  th: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
    alignItems: 'center',
  },
  tableRowAlt: {
    backgroundColor: theme.colors.bgSubtle,
  },
  tdSubject: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  td: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  tdBold: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  tdGrade: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  totalRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.primaryLight,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  totalVal: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  totalScore: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  totalGrade: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.emerald,
  },
  feedbackBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: theme.radius.md,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.emerald,
    marginBottom: 16,
  },
  feedbackTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.emerald,
    marginBottom: 4,
  },
  feedbackText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  signRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
    paddingTop: 10,
  },
  signCol: {
    alignItems: 'center',
  },
  signLine: {
    width: 100,
    height: 1,
    backgroundColor: theme.colors.border,
    marginBottom: 4,
  },
  signText: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  pdfBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    ...theme.shadows.card,
  },
  pdfBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  /* 🔒 Exam Sheets Section */
  sheetsSection: {
    marginTop: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  sheetsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  sheetsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  sheetsSubtitle: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  secureBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  secureBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4F46E5',
  },
  emptySheetsBox: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#F8FAFC',
    borderRadius: theme.radius.md,
    paddingHorizontal: 16,
  },
  emptySheetsText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  emptySheetsSubtext: {
    fontSize: 11,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  sheetsList: {
    gap: 12,
  },
  sheetCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: theme.radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sheetTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  sheetSubject: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  sheetExam: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  sheetScoreBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  sheetScoreVal: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.emerald,
  },
  sheetScoreMax: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginLeft: 2,
  },
  sheetMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  verifiedTag: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
  },
  verifiedTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.emerald,
  },
  sheetDate: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  sheetNotes: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: theme.radius.sm,
    marginBottom: 10,
  },
  sheetViewBtn: {
    backgroundColor: '#EEF2FF',
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  sheetViewBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },
  /* Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  modalBody: {
    padding: 20,
  },
  securityBanner: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: theme.radius.md,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    marginBottom: 16,
  },
  securityBannerText: {
    fontSize: 11,
    color: '#92400E',
    lineHeight: 16,
  },
  metaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: theme.radius.md,
    padding: 14,
    marginBottom: 16,
  },
  metaCol: {
    alignItems: 'center',
  },
  metaColLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginBottom: 4,
  },
  metaColVal: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  evalNotesBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: theme.radius.md,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  evalNotesTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  evalNotesBody: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  openStreamBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    ...theme.shadows.card,
  },
  openStreamBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.lg,
    padding: 18,
    marginVertical: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  chartHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 10,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  chartSubtitle: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  barItem: {
    gap: 4,
  },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  barSubject: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  barPct: {
    fontSize: 12,
    fontWeight: '800',
  },
  barTrack: {
    height: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 5,
    overflow: 'hidden',
    position: 'relative',
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
  },
  benchmarkLine: {
    position: 'absolute',
    left: '70%',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#94A3B8',
  },
  benchmarkLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  aiDiagCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: theme.radius.lg,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    ...theme.shadows.card,
  },
  aiDiagHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  aiDiagTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#065F46',
  },
  aiDiagSub: {
    fontSize: 11,
    color: '#047857',
  },
  aiBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
  },
  aiSummaryText: {
    fontSize: 12,
    color: '#166534',
    lineHeight: 18,
    marginBottom: 12,
  },
  strengthsGrid: {
    gap: 8,
  },
  strengthBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#10B981',
  },
  strengthHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#047857',
    marginBottom: 2,
  },
  strengthBody: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    lineHeight: 16,
  },
  growthBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  growthHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B45309',
    marginBottom: 2,
  },
  growthBody: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    lineHeight: 16,
  },
});
