import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  FlatList, ActivityIndicator, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { parentApi, formatUserError } from '../api';
import { theme } from '../theme';

export default function NotificationCenterModal({ visible, onClose }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'HOMEWORK' | 'ATTENDANCE' | 'FEES'

  useEffect(() => {
    if (visible) {
      loadNotifications();
    }
  }, [visible]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const data = await parentApi.getNotifications(false, 40);
      setNotifications(data || []);
    } catch (err) {
      console.warn('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await parentApi.markNotificationRead(id);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n)
      );
    } catch (err) {
      console.warn('Failed to mark read:', err);
    }
  };

  const getEventIcon = (eventType) => {
    switch ((eventType || '').toUpperCase()) {
      case 'HOMEWORK_ASSIGNED':
      case 'HOMEWORK':
        return '📚';
      case 'ATTENDANCE_CHECKIN':
      case 'ATTENDANCE_ALERT':
      case 'ABSENCE_ALERT':
        return '🏫';
      case 'GATE_PASS_APPROVED':
      case 'GATE_PASS':
        return '🎫';
      case 'FEE_RECEIPT':
      case 'FEE_DUE':
        return '💳';
      case 'ACTIVITY_PUBLISHED':
      case 'ANNOUNCEMENT':
      case 'BROADCAST_ALERT':
        return '📢';
      case 'TEST_ALERT':
        return '🔔';
      case 'PROFILE_APPROVED':
      case 'PROFILE_UPDATED':
        return '📱';
      default:
        return '🔔';
    }
  };

  const filteredList = notifications.filter(n => {
    if (filter === 'ALL') return true;
    const type = (n.event_type || '').toUpperCase();
    if (filter === 'HOMEWORK') return type.includes('HOMEWORK');
    if (filter === 'ATTENDANCE') return type.includes('ATTENDANCE') || type.includes('ABSENCE');
    if (filter === 'FEES') return type.includes('FEE');
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read_at).length;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <View style={styles.titleRow}>
                <Text style={styles.headerTitle}>Notifications</Text>
                {unreadCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unreadCount} NEW</Text>
                  </View>
                )}
              </View>
              <Text style={styles.headerSub}>Live campus notices, homework & check-ins</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Filters */}
          <View style={styles.filterRow}>
            {['ALL', 'HOMEWORK', 'ATTENDANCE', 'FEES'].map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.filterChip, filter === cat && styles.filterChipActive]}
                onPress={() => setFilter(cat)}
              >
                <Text style={[styles.filterChipText, filter === cat && styles.filterChipTextActive]}>
                  {cat === 'ALL' ? 'All Alerts' : cat.charAt(0) + cat.slice(1).toLowerCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* List */}
          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Fetching updates...</Text>
            </View>
          ) : filteredList.length === 0 ? (
            <View style={styles.centered}>
              <Text style={styles.emptyIcon}>🎉</Text>
              <Text style={styles.emptyTitle}>You're all caught up!</Text>
              <Text style={styles.emptySub}>No notifications in this category.</Text>
            </View>
          ) : (
            <FlatList
              data={filteredList}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const isUnread = !item.read_at;
                return (
                  <TouchableOpacity
                    style={[styles.card, isUnread && styles.cardUnread]}
                    onPress={() => handleMarkRead(item.id)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.iconCircle}>
                        <Text style={styles.eventEmoji}>{getEventIcon(item.event_type)}</Text>
                      </View>
                      <View style={styles.titleArea}>
                        <Text style={[styles.cardTitle, isUnread && styles.cardTitleUnread]}>
                          {item.title}
                        </Text>
                        <Text style={styles.cardTime}>
                          {item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'}
                        </Text>
                      </View>
                      {isUnread && <View style={styles.unreadDot} />}
                    </View>
                    <Text style={styles.cardMessage}>{item.message}</Text>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
  },
  headerSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  badge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: '#cbd5e1',
    fontSize: 16,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#1e293b',
  },
  filterChipActive: {
    backgroundColor: '#6366f1',
  },
  filterChipText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 12,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  emptySub: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 4,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardUnread: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventEmoji: {
    fontSize: 18,
  },
  titleArea: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#cbd5e1',
  },
  cardTitleUnread: {
    color: '#ffffff',
    fontWeight: '800',
  },
  cardTime: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6366f1',
  },
  cardMessage: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
    paddingLeft: 48,
  },
});
