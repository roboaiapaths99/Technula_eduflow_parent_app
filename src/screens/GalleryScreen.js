import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Image, Modal, Dimensions
} from 'react-native';
import { theme } from '../theme';
import { parentApi, getApiBase } from '../api';

const { width, height } = Dimensions.get('window');

export default function GalleryScreen({ user, activeChild }) {
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  const schoolId = activeChild?.school_id || user?.school_id || 1;

  const loadAlbums = async () => {
    try {
      const res = await parentApi.getGalleryAlbums(schoolId);
      setAlbums(Array.isArray(res) ? res : (res?.albums || []));
    } catch (e) {
      console.warn('Failed to load gallery albums:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAlbums();
  }, [schoolId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAlbums();
  };

  const getFullImageUrl = (url) => {
    if (!url) return 'https://images.unsplash.com/photo-1577896851231-70ef18881754?w=600';
    if (url.startsWith('http')) return url;
    return `${getApiBase()}${url}`;
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
        <Text style={styles.headerTitle}>Campus Moments & Gallery</Text>
        <Text style={styles.headerSub}>
          Official photos from school events, sports days, celebrations & competitions
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {albums.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 36, marginBottom: 10 }}>📸</Text>
            <Text style={styles.emptyTitle}>No Albums Published</Text>
            <Text style={styles.emptySub}>School administrators haven't shared photo albums yet.</Text>
          </View>
        ) : (
          <View style={styles.albumsGrid}>
            {albums.map((album) => {
              const photoCount = (album.photos || []).length;
              const coverPhoto = album.cover_image_url || (album.photos && album.photos[0]?.photo_url);

              return (
                <TouchableOpacity
                  key={album.id}
                  style={styles.albumCard}
                  onPress={() => setSelectedAlbum(album)}
                  activeOpacity={0.85}
                >
                  <Image
                    source={{ uri: getFullImageUrl(coverPhoto) }}
                    style={styles.albumCover}
                  />
                  <View style={styles.albumMeta}>
                    <View style={styles.countBadge}>
                      <Text style={styles.countBadgeText}>{photoCount} Photos</Text>
                    </View>
                    <Text style={styles.albumTitle} numberOfLines={1}>{album.title}</Text>
                    <Text style={styles.albumDate}>
                      {album.event_date ? new Date(album.event_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Campus Event'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Album Photos View Modal */}
      <Modal visible={!!selectedAlbum} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.albumModalBox}>
            <View style={styles.albumModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.albumModalTitle} numberOfLines={1}>{selectedAlbum?.title}</Text>
                <Text style={styles.albumModalSub}>
                  {(selectedAlbum?.photos || []).length} photos • {selectedAlbum?.event_date || 'Event'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedAlbum(null)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.photosGrid}>
              {(selectedAlbum?.photos || []).map((photo, i) => (
                <TouchableOpacity
                  key={photo.id || i}
                  style={styles.photoThumbWrap}
                  onPress={() => setSelectedPhoto(photo)}
                  activeOpacity={0.85}
                >
                  <Image
                    source={{ uri: getFullImageUrl(photo.photo_url) }}
                    style={styles.photoThumb}
                  />
                  {photo.caption && (
                    <Text style={styles.photoCaption} numberOfLines={1}>{photo.caption}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Full-Screen Photo Lightbox */}
      <Modal visible={!!selectedPhoto} transparent animationType="fade">
        <View style={styles.lightboxOverlay}>
          <TouchableOpacity
            style={styles.lightboxCloseBtn}
            onPress={() => setSelectedPhoto(null)}
          >
            <Text style={styles.lightboxCloseText}>✕ Close</Text>
          </TouchableOpacity>

          {selectedPhoto && (
            <View style={styles.lightboxContent}>
              <Image
                source={{ uri: getFullImageUrl(selectedPhoto.photo_url) }}
                style={styles.lightboxImage}
                resizeMode="contain"
              />
              {selectedPhoto.caption && (
                <View style={styles.lightboxCaptionBox}>
                  <Text style={styles.lightboxCaptionText}>{selectedPhoto.caption}</Text>
                </View>
              )}
            </View>
          )}
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
  emptySub: { fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 6 },
  albumsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  albumCard: {
    width: (width - 46) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  albumCover: { width: '100%', height: 110, backgroundColor: '#E2E8F0' },
  albumMeta: { padding: 10 },
  countBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
    marginBottom: 4,
  },
  countBadgeText: { fontSize: 10, fontWeight: '800', color: theme.colors.primary },
  albumTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },
  albumDate: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(10, 37, 64, 0.7)', justifyContent: 'flex-end' },
  albumModalBox: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: height * 0.85,
  },
  albumModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  albumModalTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary },
  albumModalSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 18, color: theme.colors.textSecondary, fontWeight: '700' },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 10,
  },
  photoThumbWrap: {
    width: (width - 44) / 3,
    height: (width - 44) / 3,
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
  },
  photoThumb: { width: '100%', height: '100%' },
  photoCaption: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: '#FFFFFF',
    fontSize: 10,
    padding: 2,
    textAlign: 'center',
  },

  // Lightbox
  lightboxOverlay: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    zIndex: 10,
  },
  lightboxCloseText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  lightboxContent: { width: '100%', height: '80%', justifyContent: 'center', alignItems: 'center' },
  lightboxImage: { width: '100%', height: '100%' },
  lightboxCaptionBox: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 12,
    borderRadius: theme.radius.md,
  },
  lightboxCaptionText: { color: '#FFFFFF', fontSize: 13, textAlign: 'center' },
});
