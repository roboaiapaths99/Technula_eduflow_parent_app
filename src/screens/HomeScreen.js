import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Image, Linking, Alert
} from 'react-native';
import { theme } from '../theme';
import { parentApi, getApiBase } from '../api';

export default function HomeScreen({
  user,
  activeChild,
  children = [],
  pendingLinks = [],
  onSelectChild,
  onRefreshChildren,
  onNavigate,
  onLinkChild,
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [dailyDigest, setDailyDigest] = useState(null);
  const [isBirthday, setIsBirthday] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAllServices, setShowAllServices] = useState(false);
  const [latestNotice, setLatestNotice] = useState(null);

  const studentId = activeChild?.student_id;

  const loadStudentData = async () => {
    if (!studentId) {
      setLoading(false);
      setData(null);
      return;
    }
    try {
      const [overviewRes, digestRes] = await Promise.allSettled([
        parentApi.getChildOverview(studentId),
        parentApi.getDailyDigest(studentId),
      ]);

      if (overviewRes.status === 'fulfilled' && overviewRes.value?.student) {
        setData(overviewRes.value);
      } else if (activeChild) {
        setData({
          student: activeChild,
          school: {
            name: activeChild?.school_name || user?.school_name || '',
            board: activeChild?.school_board || 'CBSE'
          },
          attendance: {
            rate: activeChild?.attendance_rate ?? null,
            recent_status: 'Scheduled'
          },
          overall_percentage: null,
          subjects: [],
          trend: [],
        });
      }

      if (digestRes.status === 'fulfilled' && digestRes.value) {
        setDailyDigest(digestRes.value);
      }

      // Check student birthday & latest announcement
      const schoolId = activeChild?.school_id || user?.school_id;
      if (schoolId) {
        parentApi.getTodaysBirthdays(schoolId).then((bRes) => {
          const bList = Array.isArray(bRes) ? bRes : (bRes?.birthdays || []);
          const match = bList.find(b => b.id === studentId || b.student_id === studentId);
          if (match) {
            setIsBirthday(true);
          } else if (activeChild?.dob) {
            const todayStr = new Date().toISOString().slice(5, 10);
            if (activeChild.dob.slice(5, 10) === todayStr) setIsBirthday(true);
          }
        }).catch(() => {});

        parentApi.getAnnouncements(schoolId).then((nRes) => {
          const list = Array.isArray(nRes) ? nRes : [];
          setLatestNotice(list.length > 0 ? list[0] : null);
        }).catch(() => {});
      }
    } catch (e) {
      console.log('[Home Notice] child overview load:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadStudentData();
  }, [studentId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadStudentData();
    if (onRefreshChildren) {
      onRefreshChildren();
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  // If no child is linked at all
  if (!activeChild && !studentId) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={{ fontSize: 44, marginBottom: 14 }}>👨‍👩‍👧</Text>
        <Text style={styles.emptyTitle}>Welcome</Text>
        <Text style={styles.emptySubtitle}>
          Link your child's profile using admission credentials to start tracking attendance, marks, homework and fees.
        </Text>
        <TouchableOpacity
          style={styles.linkChildBtn}
          onPress={onLinkChild}
          activeOpacity={0.85}
        >
          <Text style={styles.linkChildBtnText}>+ Link Child Profile</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const s = data?.student || activeChild || {};
  const att = data?.attendance || {};
  const subjects = data?.subjects || [];
  const attRate = att.rate != null ? Number(att.rate).toFixed(0) : (activeChild?.attendance_rate != null ? Number(activeChild.attendance_rate).toFixed(0) : '--');
  const overallPct = data?.overall_percentage != null ? Number(data.overall_percentage).toFixed(0) : '--';

  const initials = (s.name || 'Student')
    .split(' ')
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const rawPhoto = s.photo_url || s.photo;
  const photoUrl = rawPhoto ? (rawPhoto.startsWith('http') ? rawPhoto : `${getApiBase()}${rawPhoto}`) : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* ── 0. MULTI-CHILD SIBLING SWITCHER BAR ── */}
      {(children.length > 1 || pendingLinks.length > 0) && (
        <View style={styles.childBarContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.childBarScroll}>
            {children.map((child) => {
              const isActive = activeChild?.student_id === child.student_id;
              return (
                <TouchableOpacity
                  key={child.student_id}
                  style={[styles.childChip, isActive && styles.childChipActive]}
                  onPress={() => onSelectChild && onSelectChild(child)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.childChipDot, isActive && { backgroundColor: '#10B981' }]} />
                  <Text style={[styles.childChipText, isActive && styles.childChipTextActive]}>
                    {child.name.split(' ')[0]} ({child.grade}-{child.section})
                  </Text>
                  {isActive && <Text style={styles.childChipCheck}>✓</Text>}
                </TouchableOpacity>
              );
            })}

            {pendingLinks.map((p) => (
              <View key={p.link_id} style={styles.pendingChip}>
                <Text style={styles.pendingChipText}>⏳ {p.student_name.split(' ')[0]} (Pending)</Text>
              </View>
            ))}

            <TouchableOpacity
              style={styles.addChildChip}
              onPress={onLinkChild}
              activeOpacity={0.8}
            >
              <Text style={styles.addChildChipText}>+ Link Child</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* Pending Approval Heads-Up Banner */}
      {pendingLinks.length > 0 && (
        <View style={styles.pendingAlertBanner}>
          <Text style={{ fontSize: 18, marginRight: 8 }}>⏳</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.pendingAlertTitle}>
              {pendingLinks.length === 1
                ? `Link request for ${pendingLinks[0].student_name} is awaiting school approval`
                : `${pendingLinks.length} child link requests awaiting school verification`}
            </Text>
            <Text style={styles.pendingAlertSub}>
              School office must verify before full records unlock. Once approved, it activates here automatically.
            </Text>
          </View>
        </View>
      )}

      {/* ── 1. STUDENT PROFILE HEADER CARD ── */}
      <View style={styles.profileCard}>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.studentName} numberOfLines={1}>{s.name || 'Student'}</Text>
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>✓ Active</Text>
              </View>
            </View>
            <Text style={styles.studentMeta}>
              Class {s.grade || '--'}-{s.section || '--'} {s.roll_no ? `• Roll #${s.roll_no}` : ''} {s.admission_no ? `• Adm: ${s.admission_no}` : ''}
            </Text>
            <Text style={styles.schoolName} numberOfLines={1}>
              {data?.school?.name || activeChild?.school_name || user?.school_name || ''}
            </Text>
          </View>
        </View>
      </View>

      {/* ── 🎂 BIRTHDAY BOOM CELEBRATION BANNER (IF ACTIVE) ── */}
      {isBirthday && (
        <View style={styles.birthdayBanner}>
          <View style={styles.birthdayIconBox}>
            <Text style={{ fontSize: 28 }}>🎂</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.birthdayBadge}>🎉 Birthday Today!</Text>
              <Text style={{ fontSize: 13 }}>🎈🎉</Text>
            </View>
            <Text style={styles.birthdayTitle}>Happy Birthday, {s.name || 'Student'}! 🥳</Text>
            <Text style={styles.birthdaySub}>
              {activeChild?.birthday_message || "Wishing you a wonderful and happy birthday!"}
            </Text>
          </View>
        </View>
      )}

      {/* ── 2. VISUAL 4-METRIC KEY CARDS ── */}
      <View style={styles.metricsGrid}>
        {/* Attendance Metric */}
        <TouchableOpacity
          style={styles.metricCard}
          onPress={() => onNavigate && onNavigate('attendance')}
          activeOpacity={0.8}
        >
          <View style={styles.metricTopRow}>
            <Text style={styles.metricLabel}>Attendance</Text>
            <View style={[styles.metricDot, { backgroundColor: '#10B981' }]} />
          </View>
          <Text style={[styles.metricValue, { color: attRate === '--' ? '#94A3B8' : '#059669' }]}>{attRate === '--' ? '--' : `${attRate}%`}</Text>
          <Text style={styles.metricSub}>{dailyDigest?.today_attendance?.status || (attRate === '--' ? 'Not Marked' : 'Overall Rate')}</Text>
        </TouchableOpacity>

        {/* Academic Score Metric */}
        <TouchableOpacity
          style={styles.metricCard}
          onPress={() => onNavigate && onNavigate('report')}
          activeOpacity={0.8}
        >
          <View style={styles.metricTopRow}>
            <Text style={styles.metricLabel}>Academic</Text>
            <Text style={styles.metricIcon}>📊</Text>
          </View>
          <Text style={[styles.metricValue, { color: theme.colors.primary }]}>
            {overallPct === '--' ? '--' : `${overallPct}%`}
          </Text>
          <Text style={styles.metricSub}>Overall Score</Text>
        </TouchableOpacity>

        {/* Active Homework */}
        <TouchableOpacity
          style={styles.metricCard}
          onPress={() => onNavigate && onNavigate('homework')}
          activeOpacity={0.8}
        >
          <View style={styles.metricTopRow}>
            <Text style={styles.metricLabel}>Homework</Text>
            <Text style={styles.metricIcon}>📚</Text>
          </View>
          <Text style={[styles.metricValue, { color: '#D97706' }]}>
            {dailyDigest?.homework_count ?? 0}
          </Text>
          <Text style={styles.metricSub}>Pending Review</Text>
        </TouchableOpacity>

        {/* Fee Dues */}
        <TouchableOpacity
          style={styles.metricCard}
          onPress={() => onNavigate && onNavigate('fees')}
          activeOpacity={0.8}
        >
          <View style={styles.metricTopRow}>
            <Text style={styles.metricLabel}>Fee Status</Text>
            <Text style={styles.metricIcon}>💳</Text>
          </View>
          <Text style={[styles.metricValue, {
            color: dailyDigest?.pending_fee?.amount != null
              ? ((dailyDigest.pending_fee.amount || 0) > 0 ? '#DC2626' : '#059669')
              : '#94A3B8',
            fontSize: 16,
          }]}>
            {dailyDigest?.pending_fee?.amount != null
              ? ((dailyDigest.pending_fee.amount || 0) > 0 ? `₹${dailyDigest.pending_fee.amount}` : 'Cleared ✓')
              : '--'}
          </Text>
          <Text style={styles.metricSub}>Current Term</Text>
        </TouchableOpacity>
      </View>

      {/* ── 3. TODAY'S PULSE SNAPSHOT ── */}
      <View style={styles.pulseCard}>
        <View style={styles.pulseHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 16 }}>☀️</Text>
            <Text style={styles.pulseTitle}>Today at School</Text>
          </View>
          <Text style={styles.pulseDate}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
          </Text>
        </View>

        <View style={styles.pulseContentRow}>
          <View style={styles.pulseStatusBadge}>
            <View style={styles.pulseDot} />
            <Text style={styles.pulseStatusText}>
              {dailyDigest?.today_attendance?.status === 'Absent'
                ? 'Absent Today'
                : dailyDigest?.today_attendance?.status === 'Present'
                  ? 'Marked Present • In Session'
                  : 'No attendance record yet'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => onNavigate && onNavigate('attendance')}
            activeOpacity={0.7}
          >
            <Text style={styles.pulseLink}>View Register ›</Text>
          </TouchableOpacity>
        </View>

        {/* Teacher Note preview if any */}
        {dailyDigest?.latest_diary_remark && (
          <TouchableOpacity
            style={styles.teacherNotePill}
            onPress={() => onNavigate && onNavigate('diary')}
            activeOpacity={0.8}
          >
            <Text style={styles.teacherNoteIcon}>📖</Text>
            <Text style={styles.teacherNoteText} numberOfLines={1}>
              {dailyDigest.latest_diary_remark.teacher_name || 'Teacher'}: "{dailyDigest.latest_diary_remark.remark || dailyDigest.latest_diary_remark.remarks || 'Note added'}"
            </Text>
            <Text style={styles.teacherNoteChevron}>›</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── REAL ADMINISTRATIVE CIRCULAR / NOTICE BANNER ── */}
      {latestNotice && (
        <TouchableOpacity
          style={styles.noticeBanner}
          onPress={() => onNavigate && onNavigate('notices')}
          activeOpacity={0.85}
        >
          <View style={styles.noticeBannerLeft}>
            <Text style={{ fontSize: 18 }}>📢</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <View style={styles.noticeBannerPill}>
                <Text style={styles.noticeBannerPillText}>
                  {latestNotice.is_pinned ? 'PINNED CIRCULAR' : 'OFFICIAL NOTICE'}
                </Text>
              </View>
              <Text style={styles.noticeBannerDate}>
                {latestNotice.created_at ? new Date(latestNotice.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Recent'}
              </Text>
            </View>
            <Text style={styles.noticeBannerTitle} numberOfLines={1}>
              {latestNotice.title}
            </Text>
          </View>
          <Text style={styles.noticeBannerChevron}>›</Text>
        </TouchableOpacity>
      )}

      {/* ── 4. QUICK SERVICES (8 CORE VISUAL ICONS) ── */}
      <View style={styles.servicesCard}>
        <Text style={styles.servicesHeader}>Quick Services</Text>

        <View style={styles.servicesGrid}>
          <TouchableOpacity
            style={styles.serviceBtn}
            onPress={() => onNavigate && onNavigate('attendance')}
            activeOpacity={0.75}
          >
            <View style={[styles.serviceIconBg, { backgroundColor: '#ECFDF5' }]}>
              <Text style={styles.serviceIcon}>📋</Text>
            </View>
            <Text style={styles.serviceLabel}>Attendance</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.serviceBtn}
            onPress={() => onNavigate && onNavigate('report')}
            activeOpacity={0.75}
          >
            <View style={[styles.serviceIconBg, { backgroundColor: '#EEF2FF' }]}>
              <Text style={styles.serviceIcon}>📄</Text>
            </View>
            <Text style={styles.serviceLabel}>Report Card</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.serviceBtn}
            onPress={() => onNavigate && onNavigate('homework')}
            activeOpacity={0.75}
          >
            <View style={[styles.serviceIconBg, { backgroundColor: '#FEF3C7' }]}>
              <Text style={styles.serviceIcon}>📚</Text>
            </View>
            <Text style={styles.serviceLabel}>Homework</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.serviceBtn}
            onPress={() => onNavigate && onNavigate('fees')}
            activeOpacity={0.75}
          >
            <View style={[styles.serviceIconBg, { backgroundColor: '#F0FDF4' }]}>
              <Text style={styles.serviceIcon}>💳</Text>
            </View>
            <Text style={styles.serviceLabel}>Fee Dues</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.serviceBtn}
            onPress={() => onNavigate && onNavigate('timetable')}
            activeOpacity={0.75}
          >
            <View style={[styles.serviceIconBg, { backgroundColor: '#F0F9FF' }]}>
              <Text style={styles.serviceIcon}>🗓️</Text>
            </View>
            <Text style={styles.serviceLabel}>Timetable</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.serviceBtn}
            onPress={() => onNavigate && onNavigate('diary')}
            activeOpacity={0.75}
          >
            <View style={[styles.serviceIconBg, { backgroundColor: '#EDE9FE' }]}>
              <Text style={styles.serviceIcon}>📖</Text>
            </View>
            <Text style={styles.serviceLabel}>Diary</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.serviceBtn}
            onPress={() => onNavigate && onNavigate('chat')}
            activeOpacity={0.75}
          >
            <View style={[styles.serviceIconBg, { backgroundColor: '#FAF5FF' }]}>
              <Text style={styles.serviceIcon}>💬</Text>
            </View>
            <Text style={styles.serviceLabel}>Teacher Chat</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.serviceBtn}
            onPress={() => onNavigate && onNavigate('gate_pass')}
            activeOpacity={0.75}
          >
            <View style={[styles.serviceIconBg, { backgroundColor: '#FFF1F2' }]}>
              <Text style={styles.serviceIcon}>🎫</Text>
            </View>
            <Text style={styles.serviceLabel}>Gate Pass</Text>
          </TouchableOpacity>
        </View>

        {/* Expandable More Services */}
        {showAllServices && (
          <View style={[styles.servicesGrid, { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' }]}>
            <TouchableOpacity style={styles.serviceBtn} onPress={() => onNavigate && onNavigate('notices')}>
              <View style={[styles.serviceIconBg, { backgroundColor: '#FFFBEB' }]}>
                <Text style={styles.serviceIcon}>📢</Text>
              </View>
              <Text style={styles.serviceLabel}>Circulars</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.serviceBtn} onPress={() => onNavigate && onNavigate('ptc')}>
              <View style={[styles.serviceIconBg, { backgroundColor: '#EDE9FE' }]}>
                <Text style={styles.serviceIcon}>🤝</Text>
              </View>
              <Text style={styles.serviceLabel}>Book PTC</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.serviceBtn} onPress={() => onNavigate && onNavigate('datesheet')}>
              <View style={[styles.serviceIconBg, { backgroundColor: '#F0FDF4' }]}>
                <Text style={styles.serviceIcon}>📅</Text>
              </View>
              <Text style={styles.serviceLabel}>Datesheet</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.serviceBtn} onPress={() => onNavigate && onNavigate('certificates')}>
              <View style={[styles.serviceIconBg, { backgroundColor: '#FCE7F3' }]}>
                <Text style={styles.serviceIcon}>📜</Text>
              </View>
              <Text style={styles.serviceLabel}>Certificates</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.serviceBtn} onPress={() => onNavigate && onNavigate('holidays')}>
              <View style={[styles.serviceIconBg, { backgroundColor: '#FEF3C7' }]}>
                <Text style={styles.serviceIcon}>🏖️</Text>
              </View>
              <Text style={styles.serviceLabel}>Holidays</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.serviceBtn} onPress={() => onNavigate && onNavigate('gallery')}>
              <View style={[styles.serviceIconBg, { backgroundColor: '#FCE7F3' }]}>
                <Text style={styles.serviceIcon}>📸</Text>
              </View>
              <Text style={styles.serviceLabel}>Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.serviceBtn} onPress={() => onNavigate && onNavigate('teachers')}>
              <View style={[styles.serviceIconBg, { backgroundColor: '#ECFDF5' }]}>
                <Text style={styles.serviceIcon}>👩‍🏫</Text>
              </View>
              <Text style={styles.serviceLabel}>Teachers</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.serviceBtn} onPress={() => onNavigate && onNavigate('profile')}>
              <View style={[styles.serviceIconBg, { backgroundColor: '#F1F5F9' }]}>
                <Text style={styles.serviceIcon}>👤</Text>
              </View>
              <Text style={styles.serviceLabel}>Profile</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={styles.moreServicesBtn}
          onPress={() => setShowAllServices(!showAllServices)}
          activeOpacity={0.7}
        >
          <Text style={styles.moreServicesText}>
            {showAllServices ? 'Show Less ▴' : 'View All Services ▾'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── 5. VISUAL SUBJECT MASTERY PROGRESS ── */}
      {subjects.length > 0 && (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Subject Performance</Text>
            <TouchableOpacity onPress={() => onNavigate && onNavigate('report')}>
              <Text style={styles.sectionLink}>Details ›</Text>
            </TouchableOpacity>
          </View>

          <View style={{ gap: 10, marginTop: 10 }}>
            {subjects.slice(0, 4).map((sub, idx) => {
              const score = sub.score != null ? sub.score : (sub.percentage || 0);
              const barColor = score >= 85 ? '#10B981' : score >= 70 ? theme.colors.primary : '#F59E0B';
              const grade = sub.grade || (score >= 90 ? 'A+' : score >= 80 ? 'A' : 'B');

              return (
                <View key={idx} style={styles.subjectItem}>
                  <View style={styles.subjectTop}>
                    <Text style={styles.subjectTitle}>{sub.name || sub.subject_name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.subjectScore, { color: barColor }]}>{score}%</Text>
                      <View style={[styles.subjectGradePill, { backgroundColor: barColor + '1A' }]}>
                        <Text style={[styles.subjectGradeText, { color: barColor }]}>{grade}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.subjectBarBg}>
                    <View style={[styles.subjectBarFill, { width: `${score}%`, backgroundColor: barColor }]} />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* ── 6. COMPACT WHATSAPP HELPDESK ── */}
      <TouchableOpacity
        style={styles.whatsappBar}
        onPress={() => {
          const schoolPhone = activeChild?.school_phone || data?.school?.phone || '';
          if (!schoolPhone) { Alert.alert('Not Available', 'School WhatsApp number is not configured.'); return; }
          const cleanPhone = String(schoolPhone).replace(/[^0-9]/g, '');
          const msg = encodeURIComponent(`Hello ${activeChild?.school_name || data?.school?.name || 'School Office'}, I am reaching out regarding ${activeChild?.name || 'my child'}.`);
          const targetPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
          Linking.openURL(`https://wa.me/${targetPhone}?text=${msg}`).catch(() => {
            Alert.alert('WhatsApp Error', 'Could not open WhatsApp.');
          });
        }}
        activeOpacity={0.85}
      >
        <View style={styles.whatsappIconCircle}>
          <Text style={{ fontSize: 16 }}>💬</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.whatsappBarTitle}>School WhatsApp Support</Text>
          <Text style={styles.whatsappBarSub}>Contact school office via WhatsApp</Text>
        </View>
        <Text style={styles.whatsappBarArrow}>Chat →</Text>
      </TouchableOpacity>

      {/* White-Label Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerBrand}>{data?.school?.name || activeChild?.school_name || ''}</Text>
        <Text style={styles.footerVersion}>School Management System</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
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
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0A2540',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  linkChildBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  linkChildBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(99, 91, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarImg: {
    width: 48,
    height: 48,
    borderRadius: 14,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0A2540',
  },
  verifiedBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  verifiedText: {
    color: '#15803D',
    fontSize: 10,
    fontWeight: '800',
  },
  studentMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  schoolName: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
    marginTop: 2,
  },
  birthdayBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1F2',
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#FECDD3',
    shadowColor: '#F43F5E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  birthdayIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFE4E6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FDA4AF',
  },
  birthdayBadge: {
    fontSize: 9,
    fontWeight: '900',
    color: '#E11D48',
    letterSpacing: 0.8,
  },
  birthdayTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#9F1239',
    marginTop: 2,
  },
  birthdaySub: {
    fontSize: 11,
    color: '#BE123C',
    marginTop: 2,
    lineHeight: 15,
    fontStyle: 'italic',
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  metricTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  metricDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  metricIcon: {
    fontSize: 11,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  metricSub: {
    fontSize: 9.5,
    color: '#64748B',
    fontWeight: '600',
  },
  pulseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  pulseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  pulseTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0A2540',
  },
  pulseDate: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  pulseContentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pulseStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 6,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  pulseStatusText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#047857',
  },
  pulseLink: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  teacherNotePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  teacherNoteIcon: {
    fontSize: 12,
    marginRight: 6,
  },
  teacherNoteText: {
    flex: 1,
    fontSize: 11,
    color: '#475569',
    fontStyle: 'italic',
  },
  teacherNoteChevron: {
    fontSize: 14,
    color: '#94A3B8',
    marginLeft: 4,
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 10,
  },
  noticeBannerLeft: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeBannerPill: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  noticeBannerPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  noticeBannerDate: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  noticeBannerTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  noticeBannerChevron: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3B82F6',
  },
  servicesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  servicesHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0A2540',
    marginBottom: 12,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  serviceBtn: {
    width: '22%',
    alignItems: 'center',
  },
  serviceIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  serviceIcon: {
    fontSize: 22,
  },
  serviceLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
  },
  moreServicesBtn: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    alignItems: 'center',
  },
  moreServicesText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0A2540',
  },
  sectionLink: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  subjectItem: {
    gap: 4,
  },
  subjectTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subjectTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  subjectScore: {
    fontSize: 12,
    fontWeight: '800',
  },
  subjectGradePill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  subjectGradeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  subjectBarBg: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  subjectBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  whatsappBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D366' + '12',
    borderWidth: 1,
    borderColor: '#25D366' + '40',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  whatsappIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsappBarTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#075E54',
  },
  whatsappBarSub: {
    fontSize: 10.5,
    color: '#128C7E',
  },
  whatsappBarArrow: {
    fontSize: 12,
    fontWeight: '800',
    color: '#075E54',
  },
  footer: {
    alignItems: 'center',
    marginTop: 8,
  },
  footerBrand: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  footerVersion: {
    fontSize: 10,
    color: '#CBD5E1',
    marginTop: 1,
  },
  // Multi-child switcher bar styles
  childBarContainer: {
    marginBottom: 12,
  },
  childBarScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  childChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  childChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  childChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
  },
  childChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  childChipTextActive: {
    color: theme.colors.primary,
    fontWeight: '800',
  },
  childChipCheck: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  pendingChip: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  pendingChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  addChildChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  addChildChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  pendingAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  pendingAlertTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#92400E',
  },
  pendingAlertSub: {
    fontSize: 10.5,
    color: '#B45309',
    marginTop: 2,
    lineHeight: 14,
  },
});
