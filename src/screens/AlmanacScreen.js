import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Linking, Alert, Modal
} from 'react-native';
import { theme } from '../theme';
import { parentApi, getApiBase } from '../api';

export default function AlmanacScreen({ user, activeChild }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState('ALL');
  const [selectedDoc, setSelectedDoc] = useState(null);

  const schoolId = activeChild?.school_id || user?.school_id || 1;

  const loadAlmanac = async () => {
    try {
      const res = await parentApi.getSchoolAlmanac(schoolId);
      setDocuments(Array.isArray(res) ? res : (res?.documents || []));
    } catch (e) {
      console.warn('Failed to load school almanac:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAlmanac();
  }, [schoolId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAlmanac();
  };

  const handleOpenPdf = (fileUrl) => {
    if (!fileUrl) {
      Alert.alert('Digital Text Only', 'Full text is visible in the view dialog.');
      return;
    }
    const fullUrl = fileUrl.startsWith('http') ? fileUrl : `${getApiBase()}${fileUrl}`;
    Linking.openURL(fullUrl).catch(() => {
      Alert.alert('Document Notice', 'Unable to open file attachment on this device.');
    });
  };

  const categories = ['ALL', 'Academic Calendar', 'Rules & Conduct', 'Exam Policy', 'General Handbook'];

  const filteredDocs = documents.filter(d => {
    if (category === 'ALL') return true;
    return (d.category || '').toLowerCase() === category.toLowerCase();
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header Banner */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>School Almanac & Handbooks</Text>
        <Text style={styles.headerSub}>
          Verified school policies, annual academic guidebooks & operational rules
        </Text>
      </View>

      {/* Category Pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
        {categories.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.catPill, category === c && styles.catPillActive]}
            onPress={() => setCategory(c)}
          >
            <Text style={[styles.catPillText, category === c && styles.catPillTextActive]}>
              {c}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {filteredDocs.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 36, marginBottom: 10 }}>📘</Text>
            <Text style={styles.emptyTitle}>No Published Documents</Text>
            <Text style={styles.emptySub}>
              No verified almanac documents found for this category within the active validity window.
            </Text>
          </View>
        ) : (
          filteredDocs.map((doc) => (
            <TouchableOpacity
              key={doc.id}
              style={styles.docCard}
              onPress={() => setSelectedDoc(doc)}
              activeOpacity={0.85}
            >
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docCategory}>{doc.category || 'School Rulebook'}</Text>
                  <Text style={styles.docTitle}>{doc.title}</Text>
                </View>
                <View style={styles.validBadge}>
                  <Text style={styles.validText}>Active</Text>
                </View>
              </View>

              <Text style={styles.docDesc} numberOfLines={2}>
                {doc.description || 'Official school handbook entry and academic reference guide.'}
              </Text>

              <View style={styles.cardFooter}>
                <Text style={styles.validityWindow}>
                  📅 Valid: {doc.valid_from || 'Current'} — {doc.valid_to || 'Indefinite'}
                </Text>
                <Text style={styles.actionPrompt}>Read Guide ›</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Document View Modal */}
      <Modal visible={!!selectedDoc} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalCategory}>{selectedDoc?.category}</Text>
                <Text style={styles.modalTitle}>{selectedDoc?.title}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedDoc(null)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedDoc && (
              <ScrollView contentContainerStyle={styles.modalBody}>
                <View style={styles.validityBox}>
                  <Text style={styles.validityLabel}>Enforcement Window:</Text>
                  <Text style={styles.validityVal}>
                    {selectedDoc.valid_from ? new Date(selectedDoc.valid_from).toLocaleDateString() : 'Active'} to{' '}
                    {selectedDoc.valid_to ? new Date(selectedDoc.valid_to).toLocaleDateString() : 'Year End'}
                  </Text>
                </View>

                <Text style={styles.fullContent}>
                  {selectedDoc.content || selectedDoc.description || 'Full handbook details verified by the school board.'}
                </Text>

                {selectedDoc.file_url && (
                  <TouchableOpacity
                    style={styles.openPdfBtn}
                    onPress={() => handleOpenPdf(selectedDoc.file_url)}
                  >
                    <Text style={styles.openPdfText}>📥 Download / Open Official Document PDF</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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
  catScroll: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
    maxHeight: 52,
  },
  catPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
  },
  catPillActive: { backgroundColor: theme.colors.primary },
  catPillText: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },
  catPillTextActive: { color: '#FFFFFF', fontWeight: '700' },
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
  docCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  docCategory: { fontSize: 11, fontWeight: '800', color: theme.colors.primary, textTransform: 'uppercase' },
  docTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary, marginTop: 2 },
  validBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
  },
  validText: { fontSize: 11, fontWeight: '800', color: '#15803D' },
  docDesc: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 8, lineHeight: 18 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  validityWindow: { fontSize: 11, color: theme.colors.textMuted },
  actionPrompt: { fontSize: 12, fontWeight: '700', color: theme.colors.primary },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(10, 37, 64, 0.65)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalCategory: { fontSize: 11, fontWeight: '800', color: theme.colors.primary, textTransform: 'uppercase' },
  modalTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.textPrimary },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 18, color: theme.colors.textSecondary, fontWeight: '700' },
  modalBody: { padding: 20 },
  validityBox: {
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: theme.radius.md,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  validityLabel: { fontSize: 11, color: theme.colors.textMuted },
  validityVal: { fontSize: 12, fontWeight: '700', color: theme.colors.textPrimary, marginTop: 2 },
  fullContent: { fontSize: 14, color: theme.colors.textSecondary, lineHeight: 22 },
  openPdfBtn: {
    backgroundColor: theme.colors.primary,
    marginTop: 20,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    alignItems: 'center',
  },
  openPdfText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});
