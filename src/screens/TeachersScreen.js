import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Linking, Alert
} from 'react-native';
import { theme } from '../theme';
import { parentApi } from '../api';

export default function TeachersScreen({ user, activeChild }) {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const studentId = activeChild?.student_id;

  const loadTeachers = async () => {
    if (!studentId) {
      setLoading(false);
      return;
    }
    try {
      const res = await parentApi.getStudentTeachers(studentId);
      setTeachers(Array.isArray(res) ? res : (res?.teachers || []));
    } catch (e) {
      console.warn('Failed to load student teachers:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTeachers();
  }, [studentId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTeachers();
  };

  const handleContactTeacher = (email, name) => {
    if (!email) {
      Alert.alert('Contact Protected', `${name} can be reached via official school queries.`);
      return;
    }
    Linking.openURL(`mailto:${email}?subject=Inquiry regarding ${activeChild?.name || 'Student'}`).catch(() => {
      Alert.alert('Email Notice', 'Unable to launch email client on this device.');
    });
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
      {/* Top Banner */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Teachers & Class Faculty</Text>
        <Text style={styles.headerSub}>
          Teachers for Grade {activeChild?.grade}-{activeChild?.section}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {teachers.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 36, marginBottom: 10 }}>👩‍🏫</Text>
            <Text style={styles.emptyTitle}>Faculty List Being Finalized</Text>
            <Text style={styles.emptySub}>
              Subject teachers and class teacher details for Grade {activeChild?.grade}-{activeChild?.section} will appear here once term timetables are assigned.
            </Text>
          </View>
        ) : (
          teachers.map((teacher, i) => {
            const isClassTeacher = teacher.is_class_teacher || teacher.role === 'Class Teacher';
            const initials = (teacher.name || 'Teacher')
              .split(' ')
              .map(p => p[0])
              .slice(0, 2)
              .join('')
              .toUpperCase();

            return (
              <View key={teacher.id || i} style={styles.teacherCard}>
                <View style={styles.cardTop}>
                  <View style={[styles.avatarCircle, isClassTeacher && styles.avatarClassTeacher]}>
                    <Text style={styles.avatarText}>{initials}</Text>
                  </View>

                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={styles.teacherName}>{teacher.name}</Text>
                      {isClassTeacher && (
                        <View style={styles.classTeacherPill}>
                          <Text style={styles.classTeacherPillText}>Class Teacher</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.subjectText}>{teacher.subject || 'All Core Subjects'}</Text>
                    <Text style={styles.qualificationText}>
                      {teacher.qualification ? `${teacher.qualification} • ` : ''}
                      {teacher.experience_years ? `${teacher.experience_years} yrs exp` : 'Academic Faculty'}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.emailText} numberOfLines={1}>
                    ✉️ {teacher.email || 'Contact via School Office'}
                  </Text>
                  <TouchableOpacity
                    style={styles.contactBtn}
                    onPress={() => handleContactTeacher(teacher.email, teacher.name)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.contactBtnText}>Message Teacher</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
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
  emptySub: { fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 6 },
  teacherCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  avatarClassTeacher: { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' },
  avatarText: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary },
  teacherName: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary },
  classTeacherPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
  },
  classTeacherPillText: { fontSize: 10, fontWeight: '800', color: '#B45309' },
  subjectText: { fontSize: 13, fontWeight: '600', color: theme.colors.primary, marginTop: 2 },
  qualificationText: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  emailText: { fontSize: 12, color: theme.colors.textSecondary, flex: 1, marginRight: 10 },
  contactBtn: {
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
  },
  contactBtnText: { fontSize: 12, fontWeight: '700', color: theme.colors.primary },
});
