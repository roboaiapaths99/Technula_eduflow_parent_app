import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Image
} from 'react-native';
import { theme } from '../theme';
import { parentApi, getApiBase } from '../api';

export default function ActivitiesScreen({ user, activeChild, onNavigate }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const schoolId = activeChild?.school_id || user?.school_id || 1;

  const loadActivities = async () => {
    try {
      const res = await parentApi.getCampusActivities(schoolId);
      setActivities(Array.isArray(res) ? res : (res?.activities || []));
    } catch (e) {
      console.warn('Failed to load activities:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, [schoolId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadActivities();
  };

  const getFullImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${getApiBase()}${url}`;
  };

  const getCategoryColor = (cat) => {
    switch ((cat || '').toUpperCase()) {
      case 'SPORTS': return { bg: '#FEF3C7', text: '#B45309' };
      case 'ACADEMIC': return { bg: '#EEF2FF', text: '#4F46E5' };
      case 'CULTURAL': return { bg: '#FCE7F3', text: '#BE185D' };
      case 'SCIENCE': return { bg: '#ECFDF5', text: '#059669' };
      default: return { bg: '#F1F5F9', text: '#475569' };
    }
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
        <Text style={styles.headerTitle}>Campus Activity Timeline</Text>
        <Text style={styles.headerSub}>
          Latest events, workshops, inter-school tournaments & academic milestones
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {activities.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 36, marginBottom: 10 }}>🚩</Text>
            <Text style={styles.emptyTitle}>No Activities Posted</Text>
            <Text style={styles.emptySub}>School events and updates will be highlighted here as they occur.</Text>
          </View>
        ) : (
          activities.map((act) => {
            const catColors = getCategoryColor(act.category);
            const imageUri = getFullImageUrl(act.banner_url || act.image_url);

            return (
              <View key={act.id} style={styles.activityCard}>
                {imageUri && (
                  <Image source={{ uri: imageUri }} style={styles.activityBanner} />
                )}

                <View style={styles.activityBody}>
                  <View style={styles.activityTopRow}>
                    <View style={[styles.catBadge, { backgroundColor: catColors.bg }]}>
                      <Text style={[styles.catBadgeText, { color: catColors.text }]}>
                        {(act.category || 'EVENT').toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.activityDate}>
                      {act.event_date ? new Date(act.event_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent'}
                    </Text>
                  </View>

                  <Text style={styles.activityTitle}>{act.title}</Text>
                  <Text style={styles.activityDesc}>{act.description}</Text>

                  {act.album_id && (
                    <TouchableOpacity
                      style={styles.albumLinkBtn}
                      onPress={() => onNavigate && onNavigate('gallery')}
                    >
                      <Text style={styles.albumLinkText}>📸 View Album Photos ›</Text>
                    </TouchableOpacity>
                  )}
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
  scrollContent: { padding: 16, gap: 14 },
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
  activityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  activityBanner: { width: '100%', height: 160, backgroundColor: '#E2E8F0' },
  activityBody: { padding: 16 },
  activityTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  catBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.sm },
  catBadgeText: { fontSize: 10, fontWeight: '800' },
  activityDate: { fontSize: 12, color: theme.colors.textMuted },
  activityTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary },
  activityDesc: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 6, lineHeight: 20 },
  albumLinkBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
  },
  albumLinkText: { fontSize: 12, fontWeight: '700', color: theme.colors.primary },
});
