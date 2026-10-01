import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, ScrollView
} from 'react-native';
import { theme } from '../theme';
import { parentApi } from '../api';

export default function LinkChildModal({ visible, user, onClose, onLinked }) {
  const [loading, setLoading] = useState(false);

  // School Selection
  const [schoolQuery, setSchoolQuery] = useState(user?.school_name || '');
  const [selectedSchool, setSelectedSchool] = useState({
    id: user?.school_id || '',
    name: user?.school_name || '',
  });
  const [schoolResults, setSchoolResults] = useState([]);
  const [searchingSchools, setSearchingSchools] = useState(false);

  // Class & Section Selection
  const [availableClasses, setAvailableClasses] = useState([]);
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedSection, setSelectedSection] = useState('A');
  const [loadingClasses, setLoadingClasses] = useState(false);

  // Student Selection
  const [classStudents, setClassStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [searchStudentQuery, setSearchStudentQuery] = useState('');

  // Manual fallback mode
  const [manualMode, setManualMode] = useState(false);
  const [admissionNo, setAdmissionNo] = useState('');
  const [parentCode, setParentCode] = useState('');

  // Relation
  const [relation, setRelation] = useState('Father');

  // Auto-search schools when query changes
  useEffect(() => {
    if (!schoolQuery.trim() || schoolQuery === selectedSchool.name) {
      setSchoolResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingSchools(true);
      try {
        const res = await parentApi.searchSchools(schoolQuery.trim());
        setSchoolResults(res || []);
      } catch (e) {
        console.warn('Failed to search schools:', e);
      } finally {
        setSearchingSchools(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [schoolQuery]);

  // Sync school with active user when modal opens
  useEffect(() => {
    if (visible && user?.school_id) {
      setSelectedSchool({
        id: user.school_id,
        name: user.school_name || 'School',
      });
      setSchoolQuery(user.school_name || '');
    }
  }, [visible, user?.school_id]);

  // When school is chosen, fetch its classes & sections (only if modal is open)
  useEffect(() => {
    if (!visible || !selectedSchool.id) {
      setAvailableClasses([]);
      setSelectedGrade('');
      setClassStudents([]);
      setSelectedStudent(null);
      return;
    }

    let isMounted = true;
    const fetchClasses = async () => {
      setLoadingClasses(true);
      try {
        const res = await parentApi.getSchoolClasses(selectedSchool.id);
        if (isMounted) {
          const classes = res.classes || [];
          setAvailableClasses(classes);
          if (classes.length > 0) {
            const firstGrade = classes[0].grade;
            setSelectedGrade(firstGrade);
            setSelectedSection(classes[0].sections[0] || 'A');
          }
        }
      } catch (e) {
        console.warn('Failed to load school classes:', e);
      } finally {
        if (isMounted) setLoadingClasses(false);
      }
    };
    fetchClasses();
    return () => { isMounted = false; };
  }, [visible, selectedSchool.id]);

  // When grade or section is chosen, fetch students in that class (only if modal is open)
  useEffect(() => {
    if (!visible || !selectedSchool.id || !selectedGrade) {
      setClassStudents([]);
      setSelectedStudent(null);
      return;
    }

    let isMounted = true;
    const fetchStudents = async () => {
      setLoadingStudents(true);
      try {
        const students = await parentApi.getClassStudents(
          selectedSchool.id,
          selectedGrade,
          selectedSection
        );
        if (isMounted) {
          setClassStudents(students || []);
          setSelectedStudent(null);
        }
      } catch (e) {
        console.warn('Failed to load class students:', e);
      } finally {
        if (isMounted) setLoadingStudents(false);
      }
    };
    fetchStudents();
    return () => { isMounted = false; };
  }, [visible, selectedSchool.id, selectedGrade, selectedSection]);

  const handleLink = async () => {
    const schoolIdToUse = selectedSchool.id || user?.school_id;
    if (!schoolIdToUse) {
      Alert.alert('School Required', 'Please search and select your child\'s school institution from the list.');
      return;
    }

    if (!manualMode && !selectedStudent) {
      Alert.alert('Select Student', 'Please select your child from the class list, or switch to manual admission number entry.');
      return;
    }

    if (manualMode && !admissionNo.trim()) {
      Alert.alert('Admission Number Required', 'Please enter your child\'s admission number.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        parentUserId: user.id,
        schoolId: schoolIdToUse,
        studentId: selectedStudent?.student_id || selectedStudent?.id,
        admissionNo: manualMode ? admissionNo.trim() : (selectedStudent?.admission_no || admissionNo.trim()),
        studentName: selectedStudent?.name,
        verificationCode: parentCode.trim().toUpperCase(),
        relation,
      };

      const res = await parentApi.linkChild(payload);
      if (res?.status === 'pending_approval' || res?.verified === false) {
        Alert.alert(
          'Link Request Submitted ⏳',
          `Your request to link ${selectedStudent ? selectedStudent.name : 'your child'} has been submitted to the school administration. Once verified by the school office, the student records will appear automatically in your app.`
        );
      } else {
        Alert.alert(
          'Child Linked Successfully! 🎉',
          `Connected ${selectedStudent ? selectedStudent.name : 'your child'} to your parent portal.`
        );
      }
      setAdmissionNo('');
      setParentCode('');
      setSelectedStudent(null);
      onClose();
      if (onLinked) onLinked();
    } catch (err) {
      Alert.alert('Linking Failed', err.message || 'Could not link student. Please verify student details.');
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = classStudents.filter(s => {
    if (!searchStudentQuery.trim()) return true;
    const q = searchStudentQuery.toLowerCase();
    return (
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.roll_no && String(s.roll_no).includes(q)) ||
      (s.admission_no && s.admission_no.toLowerCase().includes(q))
    );
  });

  const currentGradeObj = availableClasses.find(c => c.grade === selectedGrade);
  const currentSections = currentGradeObj?.sections || ['A'];

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>Link Your Child</Text>
              <Text style={styles.subtitle}>Select School → Grade → Child or enter Admission ID</Text>
            </View>
            <TouchableOpacity onPress={onClose} disabled={loading}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 480 }} showsVerticalScrollIndicator={false}>
            {/* Step 1: School Search */}
            <Text style={styles.label}>1. Search & Select School *</Text>
            <TextInput
              style={styles.input}
              placeholder="Search school name (e.g. Delhi Public, Modern...)"
              placeholderTextColor={theme.colors.textMuted}
              value={schoolQuery}
              onChangeText={(text) => {
                setSchoolQuery(text);
                if (selectedSchool.name && text !== selectedSchool.name) {
                  setSelectedSchool({ id: '', name: '' });
                }
              }}
            />

            {searchingSchools && (
              <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 6 }} />
            )}

            {schoolResults.length > 0 && (
              <View style={styles.searchResultsBox}>
                {schoolResults.map((sch) => (
                  <TouchableOpacity
                    key={sch.id}
                    style={styles.searchResultItem}
                    onPress={() => {
                      setSelectedSchool({ id: sch.id, name: sch.name });
                      setSchoolQuery(sch.name);
                      setSchoolResults([]);
                    }}
                  >
                    <Text style={styles.searchResultTitle}>{sch.name}</Text>
                    <Text style={styles.searchResultSub}>{sch.city || 'Affiliated'} • {sch.board || 'CBSE'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {selectedSchool.id ? (
              <View style={styles.selectedSchoolPill}>
                <Text style={styles.selectedSchoolPillText}>✓ Selected: {selectedSchool.name}</Text>
              </View>
            ) : null}

            {/* Mode Toggle */}
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, !manualMode && styles.toggleBtnActive]}
                onPress={() => setManualMode(false)}
              >
                <Text style={[styles.toggleText, !manualMode && styles.toggleTextActive]}>
                  📋 Pick from Class Roster
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, manualMode && styles.toggleBtnActive]}
                onPress={() => setManualMode(true)}
              >
                <Text style={[styles.toggleText, manualMode && styles.toggleTextActive]}>
                  🔢 Direct Admission No
                </Text>
              </TouchableOpacity>
            </View>

            {!manualMode ? (
              <>
                {/* Step 2: Class & Section */}
                <Text style={styles.label}>2. Grade / Class</Text>
                {loadingClasses ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 6 }} />
                ) : availableClasses.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }}>
                    <View style={styles.pillRow}>
                      {availableClasses.map((c) => (
                        <TouchableOpacity
                          key={c.grade}
                          style={[styles.gradePill, selectedGrade === c.grade && styles.gradePillActive]}
                          onPress={() => {
                            setSelectedGrade(c.grade);
                            setSelectedSection(c.sections[0] || 'A');
                          }}
                        >
                          <Text style={[styles.gradePillText, selectedGrade === c.grade && styles.gradePillTextActive]}>
                            Class {c.grade}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                ) : (
                  <Text style={styles.helperText}>Select a school first to see available grades.</Text>
                )}

                {/* Section selection */}
                {currentSections.length > 0 && (
                  <>
                    <Text style={styles.label}>Section</Text>
                    <View style={styles.pillRow}>
                      {currentSections.map((sec) => (
                        <TouchableOpacity
                          key={sec}
                          style={[styles.secPill, selectedSection === sec && styles.secPillActive]}
                          onPress={() => setSelectedSection(sec)}
                        >
                          <Text style={[styles.secPillText, selectedSection === sec && styles.secPillTextActive]}>
                            Sec {sec}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                {/* Step 3: Student Selection */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                  <Text style={styles.label}>3. Select Child from Class {selectedGrade}-{selectedSection}</Text>
                  {classStudents.length > 0 && (
                    <Text style={styles.counterText}>{filteredStudents.length} students</Text>
                  )}
                </View>

                {classStudents.length > 4 && (
                  <TextInput
                    style={[styles.input, { paddingVertical: 6, fontSize: 13, marginBottom: 8 }]}
                    placeholder="Search by student name or roll number..."
                    placeholderTextColor={theme.colors.textMuted}
                    value={searchStudentQuery}
                    onChangeText={setSearchStudentQuery}
                  />
                )}

                {loadingStudents ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 12 }} />
                ) : filteredStudents.length > 0 ? (
                  <View style={styles.studentList}>
                    {filteredStudents.map((s) => {
                      const isSelected = selectedStudent?.student_id === s.student_id;
                      return (
                        <TouchableOpacity
                          key={s.student_id}
                          style={[styles.studentCard, isSelected && styles.studentCardActive]}
                          onPress={() => setSelectedStudent(s)}
                        >
                          <View style={[styles.studentAvatar, isSelected && { backgroundColor: theme.colors.primary }]}>
                            <Text style={[styles.studentAvatarText, isSelected && { color: '#FFFFFF' }]}>
                              {s.roll_no ? `#${s.roll_no}` : s.name.charAt(0)}
                            </Text>
                          </View>
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={[styles.studentName, isSelected && { color: theme.colors.primary, fontWeight: '800' }]}>
                              {s.name}
                            </Text>
                            <Text style={styles.studentSub}>
                              Roll No: {s.roll_no || 'N/A'} • Adm: {s.admission_no || '—'}
                            </Text>
                          </View>
                          {isSelected && (
                            <Text style={styles.checkmark}>✓</Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : selectedSchool.id ? (
                  <View style={styles.emptyStudentBox}>
                    <Text style={styles.emptyStudentText}>No students listed in Class {selectedGrade}-{selectedSection}.</Text>
                    <TouchableOpacity onPress={() => setManualMode(true)}>
                      <Text style={styles.emptyStudentLink}>Enter Admission Number Manually →</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </>
            ) : (
              <>
                {/* Manual Admission No Input */}
                <Text style={styles.label}>Admission Number *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter Admission Number"
                  placeholderTextColor={theme.colors.textMuted}
                  value={admissionNo}
                  onChangeText={setAdmissionNo}
                  autoCapitalize="characters"
                />
              </>
            )}

            {/* Optional Verification Code for Instant Auto-Approval */}
            <Text style={[styles.label, { marginTop: 14 }]}>Parent Link Code (Optional)</Text>
            <TextInput
              style={[styles.input, { marginBottom: 6 }]}
              placeholder="e.g. STU-A3X7K9 (for instant auto-approval)"
              placeholderTextColor={theme.colors.textMuted}
              value={parentCode}
              onChangeText={setParentCode}
              autoCapitalize="characters"
            />
            <Text style={[styles.helperText, { marginBottom: 12 }]}>
              If provided by your school office or on fee receipts, entering it auto-approves this link immediately without admin wait.
            </Text>

            {/* Step 4: Relation */}
            <Text style={styles.label}>Your Relationship to Child</Text>
            <View style={styles.relationRow}>
              {['Father', 'Mother', 'Guardian'].map((rel) => (
                <TouchableOpacity
                  key={rel}
                  style={[styles.relOption, relation === rel && styles.relOptionActive]}
                  onPress={() => setRelation(rel)}
                >
                  <Text style={[styles.relOptionText, relation === rel && styles.relOptionTextActive]}>
                    {rel}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.submitBtn,
                (!selectedSchool.id || (!manualMode && !selectedStudent) || (manualMode && !admissionNo)) && { opacity: 0.6 }
              ]}
              onPress={handleLink}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitText}>
                  {selectedStudent ? `Link ${selectedStudent.name.split(' ')[0]} →` : 'Link Child →'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
    maxHeight: '92%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  closeText: {
    fontSize: 18,
    color: theme.colors.textMuted,
    padding: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginBottom: 6,
    marginTop: 8,
  },
  counterText: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.colors.textPrimary,
    backgroundColor: '#FFFFFF',
  },
  helperText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
    marginVertical: 4,
  },
  searchResultsBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    marginTop: 4,
    marginBottom: 8,
    maxHeight: 160,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  searchResultItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  searchResultTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  searchResultSub: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  selectedSchoolPill: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginVertical: 6,
  },
  selectedSchoolPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  toggleBtnActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  toggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  toggleTextActive: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  pillRow: {
    flexDirection: 'row',
    gap: 6,
  },
  gradePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#F8FAFC',
  },
  gradePillActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  gradePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  gradePillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  secPill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#F8FAFC',
  },
  secPillActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  secPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  secPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  studentList: {
    gap: 6,
    marginVertical: 4,
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#FAFAFA',
  },
  studentCardActive: {
    borderColor: theme.colors.primary,
    backgroundColor: '#EFF6FF',
  },
  studentAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentAvatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  studentName: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  studentSub: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  checkmark: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.colors.primary,
    paddingHorizontal: 6,
  },
  emptyStudentBox: {
    padding: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 6,
  },
  emptyStudentText: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  emptyStudentLink: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '700',
    marginTop: 4,
  },
  relationRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 6,
  },
  relOption: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  relOptionActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  relOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  relOptionTextActive: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  submitBtn: {
    flex: 2,
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
